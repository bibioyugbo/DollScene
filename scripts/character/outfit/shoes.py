"""
Shoes as reusable, recolourable pieces (primary = upper, secondary = sole, accent = heel / beads).
Each shoe is modelled on feet posed for it:

    arch   the foot bones are pitched toes-down by `arch` radians about the ankle and the toe bones
           pitched back by the same, so the toes stay flat on the floor (a real foot in a heel)
    lift   how far the doll stands up off the floor in them (sole + heel), metres

Both go to the catalog; the app poses the feet and raises the doll by the same amounts, so the shoe
it shows is exactly the shoe modelled here.

The shoe is a LAST lofted around the posed foot, not a copy of the foot's skin (which would show
every toe): the foot is cut into slices across its length; each slice gets a superellipse section
(flat bottom, rounded top) grown until it holds every foot vertex in that slice, and the sections
are smoothed along the foot. Past the toes the section tapers to a round or pointed toe box.
Styles cut that surface with a topline (heel counter, sides, vamp), keep only bands of it (straps),
or only its front (mules). A sole slab follows the bottom of the sections, a heel column goes from
the sole to the floor. Shoes are stiff: everything rides the Foot bone (the app's arch pose is the
pose they were built in), ankle straps and boot shafts ride the Leg.
"""

import math

import bpy
import numpy as np
from mathutils import Matrix, Vector, geometry

import garmentkit as gk
from garmentkit import smoothstep

SIDES = ("Left", "Right")
P_EXP = 2.6  # superellipse exponent of the sections: boxy enough to hold the toes, round on top
EASE = 0.0032  # room between foot and upper
STEP = 0.005  # slice spacing along the foot (m)
K = 9  # columns per side of a section (bottom edge -> top centre)


def pose_feet(base, arch):
    rig = base.rig
    mw = rig.matrix_world
    for side in SIDES:
        for name, ang in ((f"mixamorig:{side}Foot", arch), (f"mixamorig:{side}ToeBase", -arch)):
            pb = rig.pose.bones[name]
            m = mw @ pb.matrix
            h = m.translation.copy()
            r = Matrix.Rotation(ang, 4, "X")
            pb.matrix = mw.inverted() @ (Matrix.Translation(h) @ r @ Matrix.Translation(-h) @ m)
            bpy.context.view_layer.update()
    body = base.body
    masks = [m for m in body.modifiers if m.type == "MASK"]
    for m in masks:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.array([list(ev.matrix_world @ v.co) for v in me.vertices])
    ev.to_mesh_clear()
    for m in masks:
        m.show_viewport = True
    D = {}
    for side in SIDES:
        for b in ("Foot", "ToeBase", "Leg"):
            pb = rig.pose.bones[f"mixamorig:{side}{b}"]
            D[f"{side}{b}"] = (mw @ pb.matrix) @ (mw @ pb.bone.matrix_local).inverted()
    return co, D


def reset_pose(base):
    for pb in base.rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def gauss_smooth(a, sigma):
    if sigma <= 0 or len(a) < 3:
        return a
    r = int(math.ceil(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(a, (r, r), mode="edge")
    return np.convolve(pad, k, mode="valid")


class Last:
    """The sections of one posed foot: per slice centre c (lateral), half width a, height b above
    the bottom zb, at forward distance x (from the back of the heel)."""

    def __init__(self, base, co, side, toe_ext, pointy):
        sgn = 1 if side == "Left" else -1
        self.side = side
        ankle = np.array(base.rig.matrix_world @ base.rig.pose.bones[f"mixamorig:{side}Foot"].head)
        self.ankle = ankle
        fw = base.wsum(f"{side}Foot", f"{side}ToeBase", exact=True)
        m = base.in_body & (base.co[:, 0] * sgn > 0.03) & (fw > 0.25) & (co[:, 2] < ankle[2] + 0.005)
        p = co[m]
        heel = p[np.argmax(p[:, 1])]
        toe = p[np.argmin(p[:, 1])]
        f = toe - heel
        f[2] = 0
        self.f = f / np.linalg.norm(f)
        self.l = np.cross(np.array([0, 0, 1.0]), self.f)
        self.o = heel.copy()
        X = (p - self.o) @ self.f
        Lx = (p - self.o) @ self.l
        Z = p[:, 2]
        self.length = float(X.max())
        self.zmin = float(Z.min())
        xs = np.arange(0.012, self.length - 0.004, STEP)
        c, a, b, zb = [], [], [], []
        win = []
        for x in xs:
            sel = np.abs(X - x) < STEP * 0.9
            if sel.sum() < 4:
                sel = np.abs(X - x) < STEP * 2
            lx, z = Lx[sel], Z[sel]
            zb_ = z.min() - 0.0015
            c_ = 0.5 * (lx.min() + lx.max())
            c.append(c_)
            a.append(0.5 * (lx.max() - lx.min()) + EASE)
            b.append(z.max() - zb_ + EASE)
            zb.append(zb_)
            win.append((lx, z))
        c, zb = gauss_smooth(np.array(c), 2.0), np.array(zb)
        a, b = np.array(a), np.array(b)
        # zb under every point of its slice (then smoothed downward only), then grow the sections
        # until they hold their points, smoothing between rounds so the upper has no lumps
        for i, (lx, z) in enumerate(win):
            zb[i] = min(zb[i], z.min() - 0.0012)
        zr = zb.copy()
        for _ in range(8):  # smooth lower envelope
            zb = np.minimum(zr, gauss_smooth(zb, 2.0))
        zb = gauss_smooth(zb, 1.0) - 0.0006

        def need(a, b):
            out = np.ones(len(a))
            for i, (lx, z) in enumerate(win):
                dl = np.abs(lx - c[i]) / a[i]
                dz = np.clip(z - zb[i], 0, None) / b[i]
                out[i] = max(1.0, float(((dl ** P_EXP + dz ** P_EXP) ** (1 / P_EXP)).max()) * 1.01)
            return out

        a, b = gauss_smooth(a, 2.5), gauss_smooth(b, 2.5)
        for _ in range(3):
            s = need(a, b)
            s = np.array([s[max(0, i - 2):i + 3].max() for i in range(len(s))])  # widen, then smooth
            s = gauss_smooth(s, 2.0)
            a, b = a * s, b * s
        s = need(a, b)
        a, b = a * s, b * s
        # heel back: round the first few millimetres in plan
        xb = np.linspace(-0.004, xs[0] + 0.006, 7)[:-1]
        sb = np.sqrt(np.clip(1 - (1 - (xb + 0.004) / (xs[0] + 0.01)) ** 2, 0.0, 1))
        k0 = int(np.searchsorted(xs, xs[0] + 0.006))
        xs, c, a, b, zb = xs[k0:], c[k0:], a[k0:], b[k0:], zb[k0:]
        # toe box past the toes
        xt = np.linspace(xs[-1], self.length + toe_ext, 9)[1:]
        st = (xt - xs[-1]) / (xt[-1] - xs[-1])
        if pointy:
            wa = np.clip(1 - st, 0.0, 1) ** 0.9
        else:
            wa = np.sqrt(np.clip(1 - st ** 2, 0, 1))
        wb = 1 - 0.72 * st ** 1.5
        self.x = np.concatenate([xb, xs, xt])
        self.c = np.concatenate([np.full(len(xb), c[0]), c, np.full(len(xt), c[-1])])
        self.a = np.concatenate([a[0] * sb, a, a[-1] * wa])
        self.b = np.concatenate([np.full(len(xb), b[0]), b, b[-1] * wb])
        self.zb = np.concatenate([np.full(len(xb), zb[0]), zb, np.full(len(xt), zb[-1])])
        self.a = np.maximum(self.a, 0.0004)
        self.b = np.maximum(self.b, 0.0004)
        self.n = len(self.x)
        self.t = self.x / self.length

    def point(self, i, theta):
        """Section i at angle theta (pi = outer-left bottom, pi/2 = top centre, 0 = right bottom)."""
        ct, st = math.cos(theta), math.sin(theta)
        lx = self.c[i] + self.a[i] * math.copysign(abs(ct) ** (2 / P_EXP), ct)
        z = self.zb[i] + self.b[i] * abs(st) ** (2 / P_EXP)
        p = self.o + self.f * self.x[i] + self.l * lx
        return np.array([p[0], p[1], z])

    def theta_cut(self, i, h):
        """Angle (from the bottom) at which section i reaches height h above its bottom."""
        if h >= self.b[i] * 0.999:
            return math.pi / 2
        if h <= 0:
            return 0.0
        return math.asin((h / self.b[i]) ** (P_EXP / 2))

    def inside(self, P, margin=0.0):
        """Per point: normalised section radius (<1 inside), section index, height above bottom."""
        X = (P - self.o) @ self.f
        i = np.clip(np.searchsorted(self.x, X), 0, self.n - 1)
        lx = (P - self.o) @ self.l
        dl = np.abs(lx - self.c[i]) / self.a[i]
        dz = np.clip(P[:, 2] - self.zb[i], 0, None) / self.b[i]
        return (dl ** P_EXP + dz ** P_EXP) ** (1 / P_EXP), i, P[:, 2] - self.zb[i]

    def sole_bottom(self, i, sole_t, platform):
        return self.zb[i] - sole_t - platform * smoothstep(0.42, 0.62, self.t[i])


class Mesh:
    """Verts / faces / uvs / bone per vertex, in the posed space."""

    def __init__(self):
        self.v, self.f, self.uv, self.bone = [], [], [], []

    def add(self, p, bone):
        self.v.append(tuple(float(x) for x in p))
        self.bone.append(bone)
        return len(self.v) - 1

    def quad(self, a, b, c, d, uv):
        self.f.append((a, b, c, d))
        self.uv.append(uv if isinstance(uv[0], tuple) else [uv] * 4)

    def tri(self, a, b, c, uv):
        self.f.append((a, b, c))
        self.uv.append([uv] * 3)


def orient(mesh, start, center_fn):
    """Flip faces [start:] so they point away from center_fn(face centre)."""
    s = 0.0
    for fi in range(start, len(mesh.f)):
        f = mesh.f[fi]
        P = [np.array(mesh.v[i]) for i in f]
        n = np.cross(P[1] - P[0], P[2] - P[0])
        if len(P) == 4:
            n = n + np.cross(P[2] - P[0], P[3] - P[0])
        cen = np.mean(P, axis=0)
        s += float(n @ (cen - center_fn(cen)))
    if s < 0:
        for fi in range(start, len(mesh.f)):
            mesh.f[fi] = tuple(reversed(mesh.f[fi]))
            mesh.uv[fi] = list(reversed(mesh.uv[fi]))


def loft(mesh, last, i0, i1, h_top, bone="Foot"):
    """The last's surface over sections i0..i1, cut at height h_top(i) on each side (closed over the
    top where the section is lower than that)."""
    start = len(mesh.f)
    rows = []
    for i in range(i0, i1 + 1):
        tc = last.theta_cut(i, h_top(i))
        left = [math.pi - tc * k / K for k in range(K + 1)]
        right = [tc * k / K for k in range(K + 1)]
        if tc < math.pi / 2:
            # a sliver of an opening (just before the vamp closes) reads as a crack: close it
            gap = np.linalg.norm(last.point(i, math.pi - tc) - last.point(i, tc))
            if gap < 0.007 and last.t[i] > 0.3:
                tc = math.pi / 2
                left = [math.pi - tc * k / K for k in range(K + 1)]
                right = [tc * k / K for k in range(K + 1)]
        L = [mesh.add(last.point(i, th), bone) for th in left]
        if last.a[i] < 0.0025:
            R = L  # the back of the heel: both sides are one seam
        elif tc >= math.pi / 2 - 1e-6:
            R = [mesh.add(last.point(i, th), bone) for th in right[:-1]] + [L[-1]]
        else:
            R = [mesh.add(last.point(i, th), bone) for th in right]
        rows.append((i, L, R))
    for (i, L0, R0), (j, L1, R1) in zip(rows, rows[1:]):
        for k in range(K):
            u0 = 0.05 + 0.6 * last.t[i] / (last.t[-1] + 1e-6)
            u1 = 0.05 + 0.6 * last.t[j] / (last.t[-1] + 1e-6)
            for side, A, B in ((0, L0, L1), (1, R0, R1)):
                v0 = 0.35 + 0.3 * k / K + 0.3 * side
                v1 = 0.35 + 0.3 * (k + 1) / K + 0.3 * side
                if A[k + 1] == A[k] or B[k] == B[k + 1]:
                    continue
                if side == 0:
                    mesh.quad(A[k], B[k], B[k + 1], A[k + 1], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
                else:  # the right half runs the other way round the section
                    mesh.quad(A[k], A[k + 1], B[k + 1], B[k], [(u0, v0), (u0, v1), (u1, v1), (u1, v0)])
    def ctr(q):
        i = min(last.n - 1, max(0, int(np.searchsorted(last.x, (q - last.o) @ last.f))))
        p = last.o + last.f * last.x[i] + last.l * last.c[i]
        return np.array([p[0], p[1], last.zb[i] + last.b[i] * 0.35])

    orient(mesh, start, ctr)


def sole(mesh, last, sole_t, platform, welt=0.0025, n_across=6):
    """A slab under the sections: top at their bottom, bottom sole_t (+ platform) lower."""
    start = len(mesh.f)
    top_rows, bot_rows = [], []
    for i in range(last.n):
        pl = last.point(i, math.pi)
        pr = last.point(i, 0.0)
        pl = pl - last.l * welt * min(1.0, last.a[i] / 0.01)
        pr = pr + last.l * welt * min(1.0, last.a[i] / 0.01)
        zt = last.zb[i] + 0.0006
        zbt = last.sole_bottom(i, sole_t, platform)
        T, B = [], []
        for k in range(n_across + 1):
            q = pl + (pr - pl) * (k / n_across)
            T.append(mesh.add((q[0], q[1], zt), "Foot"))
            B.append(mesh.add((q[0], q[1], zbt), "Foot"))
        top_rows.append(T)
        bot_rows.append(B)
    uv = (0.35, 0.15)
    for r in range(last.n - 1):
        for k in range(n_across):
            mesh.quad(top_rows[r][k], top_rows[r][k + 1], top_rows[r + 1][k + 1], top_rows[r + 1][k], uv)
            mesh.quad(bot_rows[r][k], bot_rows[r + 1][k], bot_rows[r + 1][k + 1], bot_rows[r][k + 1], uv)
        for k in (0, n_across):
            mesh.quad(top_rows[r][k], top_rows[r + 1][k], bot_rows[r + 1][k], bot_rows[r][k], uv)
    for r in (0, last.n - 1):
        for k in range(n_across):
            mesh.quad(top_rows[r][k], bot_rows[r][k], bot_rows[r][k + 1], top_rows[r][k + 1], uv)

    def ctr(q):
        i = min(last.n - 1, max(0, int(np.searchsorted(last.x, (q - last.o) @ last.f))))
        p = last.o + last.f * last.x[i] + last.l * last.c[i]
        return np.array([p[0], p[1], 0.5 * (last.zb[i] + last.sole_bottom(i, sole_t, platform))])

    orient(mesh, start, ctr)


HEELS = {  # half-sizes (lateral, forward) at the top and at the floor
    "stiletto": (0.010, 0.012, 0.0035, 0.0035),
    "kitten": (0.009, 0.010, 0.0045, 0.005),
    "block": (0.017, 0.018, 0.014, 0.014),
    "chunky": (0.022, 0.024, 0.020, 0.022),
}


def heel_column(mesh, last, shape, sole_t, floor, n=18):
    start = len(mesh.f)
    rx_t, ry_t, rx_b, ry_b = HEELS[shape]
    i_c = int(np.searchsorted(last.x, 0.032))
    cen_top = last.o + last.f * 0.034 + last.l * last.c[i_c]
    cen_bot = last.o + last.f * (0.036 if shape != "stiletto" else 0.040) + last.l * last.c[i_c]
    rows = []
    nz = 8
    for k in range(nz + 1):
        t = k / nz
        tt = t ** (0.75 if shape in ("stiletto", "kitten") else 1.0)
        rx = rx_t + (rx_b - rx_t) * tt
        ry = ry_t + (ry_b - ry_t) * tt
        row = []
        for j in range(n):
            ang = 2 * math.pi * j / n
            c = cen_top + (cen_bot - cen_top) * t
            p = c + last.f * (ry * math.cos(ang)) + last.l * (rx * math.sin(ang))
            X = float((p - last.o) @ last.f)
            ii = min(last.n - 1, max(0, int(np.searchsorted(last.x, X))))
            z_top = last.sole_bottom(ii, sole_t, 0.0) + 0.002
            z = z_top + (floor - z_top) * t
            row.append(mesh.add((p[0], p[1], z), "Foot"))
        rows.append(row)
    uv = (0.85, 0.5)
    for r0, r1 in zip(rows, rows[1:]):
        for j in range(n):
            jj = (j + 1) % n
            mesh.quad(r0[j], r1[j], r1[jj], r0[jj], uv)
    cb = np.mean([mesh.v[i] for i in rows[-1]], axis=0)
    cap = mesh.add(cb, "Foot")
    for j in range(n):
        mesh.tri(rows[-1][j], cap, rows[-1][(j + 1) % n], uv)
    c_axis = lambda q: np.array([cen_top[0] + (cen_bot[0] - cen_top[0]) * 0.5, cen_top[1] + (cen_bot[1] - cen_top[1]) * 0.5, q[2] + 0.0])

    def ctr(q):
        c = c_axis(q)
        return np.array([c[0], c[1], q[2] + (0.004 if abs(q[2] - floor) < 1e-4 else 0.0)])

    orient(mesh, start, ctr)


def leg_ring(base, co, side, z0, z1, ease=0.0025, n=28, bone="Leg", flare=0.0):
    """Bands round the leg between heights z0..z1: the convex hull of the leg in each slab."""
    sgn = 1 if side == "Left" else -1
    m = base.in_body & (base.co[:, 0] * sgn > 0.03)
    if z1 - z0 < 0.025:  # a strap: one section (at its middle), repeated
        mid = leg_ring(base, co, side, (z0 + z1) / 2, (z0 + z1) / 2 + 0.03, ease, n, bone)
        ring = mid[0]
        return [[np.array([p[0], p[1], z]) for p in ring] for z in (z0, (z0 + z1) / 2, z1)]
    zs = np.linspace(z0, z1, max(2, int(round((z1 - z0) / 0.008)) + 1))
    R = np.zeros((len(zs), n))
    C = np.zeros((len(zs), 2))
    dirs = np.array([[math.cos(2 * math.pi * j / n), math.sin(2 * math.pi * j / n)] for j in range(n)])
    for zi, z in enumerate(zs):
        w = 0.008
        sel = m & (np.abs(co[:, 2] - z) < w)
        while sel.sum() < 10 and w < 0.05:
            w *= 1.5
            sel = m & (np.abs(co[:, 2] - z) < w)
        pts = co[sel][:, :2]
        hp = pts[geometry.convex_hull_2d([Vector(p) for p in pts])]
        C[zi] = hp.mean(axis=0)
        R[zi] = ((hp - C[zi]) @ dirs.T).max(axis=0)
    # a smooth tube: each ring is an ellipse-ish superellipse (centre, half-widths along x/y) fitted
    # to the hull, smoothed up the leg, then grown until it holds the hull again
    ex = np.maximum(R[:, [0]], R[:, [n // 2]])[:, 0]
    ey = np.maximum(R[:, [n // 4]], R[:, [3 * n // 4]])[:, 0]
    cx = C[:, 0] + (R[:, 0] - R[:, n // 2]) / 2
    cy = C[:, 1] + (R[:, n // 4] - R[:, 3 * n // 4]) / 2
    sig = 3.0 if len(zs) > 4 else 0.0
    cx, cy, ex, ey = (gauss_smooth(v, sig) for v in (cx, cy, ex, ey))
    C = np.stack([cx, cy], 1)
    Rf = np.zeros_like(R)
    for zi in range(len(zs)):
        for j in range(n):
            d = dirs[j]
            Rf[zi, j] = 1.0 / math.sqrt((d[0] / ex[zi]) ** 2 + (d[1] / ey[zi]) ** 2)
    # hull points relative to the new centre must fit
    for zi in range(len(zs)):
        pass
    scale = np.ones(len(zs))
    for zi in range(len(zs)):
        need = (R[zi] + ((C[zi] - np.array([cx[zi], cy[zi]])) @ dirs.T) * 0) / Rf[zi]
        scale[zi] = max(1.0, float(need.max()))
    scale = gauss_smooth(np.array([scale[max(0, i - 1):i + 2].max() for i in range(len(scale))]), sig) if sig else scale
    R = Rf * scale[:, None] + ease
    if flare:  # the bottom of a boot shaft opens out over the foot part
        R = R * (1 + flare * np.clip(1 - (zs - z0) / 0.025, 0, 1) ** 2)[:, None]
    rows = []
    for zi, z in enumerate(zs):
        rows.append([np.array([C[zi][0] + dirs[j][0] * R[zi][j], C[zi][1] + dirs[j][1] * R[zi][j], z]) for j in range(n)])
    return rows


def add_rings(mesh, rows, bone, uv=(0.3, 0.6)):
    start = len(mesh.f)
    n = len(rows[0])
    idx = [[mesh.add(p, bone) for p in row] for row in rows]
    for r0, r1 in zip(idx, idx[1:]):
        for j in range(n):
            jj = (j + 1) % n
            mesh.quad(r0[j], r0[jj], r1[jj], r1[j], uv)
    cs = [np.mean(row, axis=0) for row in rows]
    orient(mesh, start, lambda q: np.array([*min(cs, key=lambda c: abs(c[2] - q[2]))[:2], q[2]]))


def beads_on(mesh, last, i, sole_t):
    """Coral beads across the top of section i (traditional sandals)."""
    for k in range(9):
        th = math.pi * (0.12 + 0.76 * k / 8)
        p = last.point(i, th)
        nrm = p - np.array([*(last.o + last.f * last.x[i] + last.l * last.c[i])[:2], last.zb[i]])
        nrm = nrm / (np.linalg.norm(nrm) + 1e-9)
        c = p + nrm * 0.0045
        r = 0.0046
        o = len(mesh.v)
        for a_ in range(8):
            for b_ in range(5):
                th2, ph = 2 * math.pi * a_ / 8, math.pi * (b_ + 0.5) / 5
                mesh.add(c + np.array([math.cos(th2) * math.sin(ph), math.sin(th2) * math.sin(ph), math.cos(ph)]) * r, "Foot")
        start = len(mesh.f)
        for a_ in range(8):
            for b_ in range(4):
                i0 = o + a_ * 5 + b_
                i1 = o + ((a_ + 1) % 8) * 5 + b_
                mesh.quad(i0, i0 + 1, i1 + 1, i1, (0.85, 0.85))
        orient(mesh, start, lambda q, c=c: c)


def build_shoe(base, Piece, pid, name, store, colors, arch, kind, sole_t=0.007, platform=0.0, heel_shape="block", vamp=0.6, back=0.042, side_h=0.024, pointy=0.0, straps=(), ankle=None, boot_top=None, beads=False, finish="leather", toe_ext=0.008):
    """kind: pump (closed, topline cut), mule (front only), boot (closed + shaft), sandal (straps)."""
    piece = Piece(base, pid, name, "shoes", store, colors, finish=finish)
    floor0 = float(base.co[base.in_body, 2].min())
    co, Dm = pose_feet(base, arch)
    meshes = []
    floor = None
    for side in SIDES:
        last = Last(base, co, side, pointy if pointy else toe_ext, pointy > 0)
        m = Mesh()
        idx = lambda t: int(np.clip(np.searchsorted(last.t, t), 0, last.n - 1))
        BIG = 1.0
        if kind == "pump":
            def h_top(i, last=last):
                t = last.t[i]
                h = side_h + (back - side_h) * (1 - smoothstep(0.0, 0.36, t))
                return h + BIG * smoothstep(vamp - 0.1, vamp + 0.03, t) ** 3
            loft(m, last, 0, last.n - 1, h_top)
        elif kind == "boot":
            # the shaft (leg rings) takes over above the ankle; the foot part stops under it
            loft(m, last, 0, last.n - 1, lambda i, last=last: (last.ankle[2] + 0.012 - last.zb[i]) + BIG * smoothstep(0.38, 0.5, last.t[i]))
        elif kind == "mule":
            i0 = idx(vamp - 0.06)
            loft(m, last, i0, last.n - 1, lambda i, last=last, t0=last.t[i0]: 0.012 + BIG * smoothstep(t0, t0 + 0.1, last.t[i]))
        for (t0, t1) in straps:
            loft(m, last, idx(t0), max(idx(t1), idx(t0) + 1), lambda i: BIG)
        if beads and straps:
            beads_on(m, last, (idx(straps[0][0]) + idx(straps[0][1])) // 2, sole_t)
        sole(m, last, sole_t, platform)
        f = min(last.sole_bottom(i, sole_t, platform) for i in range(last.n))
        floor = f if floor is None else min(floor, f)
        meshes.append((side, last, m))
    for side, last, m in meshes:
        if arch > 0.05 and heel_shape:
            heel_column(m, last, heel_shape, sole_t, floor)
        if ankle:
            z = last.ankle[2] + ankle[0]
            add_rings(m, leg_ring(base, co, side, z - ankle[1] / 2, z + ankle[1] / 2), "Leg")
        if boot_top:
            add_rings(m, leg_ring(base, co, side, last.ankle[2] + 0.004, boot_top, ease=0.005, flare=0.16), "Leg")
    lift = floor0 - floor

    # texture atlas: upper (u < .7, v > .3) / sole (u < .7, v < .3) / accent (u > .7), leather grain
    S = 512
    ys, xs = np.mgrid[0:S, 0:S].astype(np.float64)
    grain = 0.72 + 0.05 * gk.value_noise((S, S), 8, 3) - 0.03 * (gk.value_noise((S, S), 2, 4) > 0.7)
    W2 = ((xs < S * 0.7) & (ys < S * 0.3)).astype(float)
    W3 = (xs > S * 0.7).astype(float)
    rgba = np.dstack([grain, W2, W3, np.ones((S, S))])
    nrmmap = gk.normal_from_height(gk.value_noise((S, S), 3, 5), 0.8 if finish == "patent" else 1.4)
    mi = piece._material(finish, rgba, nrmmap)

    for side, last, m in meshes:
        part = gk.Part(mi)
        for p, bone in zip(m.v, m.bone):
            bn = f"{side}{bone}"
            q = Dm[bn].inverted() @ Vector(p)
            part.verts.append(tuple(q))
            part.src.append(-1)
            part.weights.append({f"mixamorig:{bn}": 1.0})
        part.faces = m.f
        part.uvs = m.uv
        piece.parts.append(part)
        # hide the skin well inside the closed upper (never near its edges)
        if kind in ("pump", "boot", "mule"):
            sgn = 1 if side == "Left" else -1
            fw = base.wsum(f"{side}Foot", f"{side}ToeBase", exact=True)
            cand = np.nonzero(base.in_body & (base.co[:, 0] * sgn > 0.03) & (fw > 0.5))[0]
            r, ii, h = last.inside(co[cand])
            t = last.t[ii]
            if kind == "pump":
                top = side_h + (back - side_h) * (1 - smoothstep(0.0, 0.36, t)) + 1.0 * smoothstep(vamp - 0.1, vamp + 0.03, t) ** 3
                ok = (r < 1.0) & (h < top - 0.014) & (t > 0.06)
            elif kind == "mule":
                ok = (r < 1.0) & (t > vamp + 0.06)
            else:
                ok = (r < 1.0) & (t > 0.04)
            piece.hide |= set(int(v) for v in cand[ok])
    reset_pose(base)
    piece.extra = {"arch": round(arch, 4), "lift": round(lift, 4)}
    piece.save(thickness=0.0012, even=False)


def S(pid, name, store, colors, arch, kind, **kw):
    return lambda base, Piece: build_shoe(base, Piece, pid, name, store, colors, arch, kind, **kw)


SHOES = {
    "shoes_pumps": S("shoes_pumps", "Pointy pumps", "moncherie", ["#111111", "#2A1A14", "#111111"], 0.5, "pump", heel_shape="stiletto", vamp=0.64, pointy=0.034, finish="patent"),
    "shoes_block_heels": S("shoes_block_heels", "Block heels", "dopebyfabby", ["#D9B35B", "#2A1A14", "#D9B35B"], 0.42, "sandal", heel_shape="block", straps=((0.8, 0.9), (0.6, 0.66)), ankle=(0.012, 0.012)),
    "shoes_mules": S("shoes_mules", "Heeled mules", "moncherie", ["#F2B8C6", "#2A1A14", "#F2B8C6"], 0.36, "mule", heel_shape="block", vamp=0.6, toe_ext=0.012),
    "shoes_strappy": S("shoes_strappy", "Strappy sandals", "booty", ["#C9A04A", "#2A1A14", "#C9A04A"], 0.5, "sandal", heel_shape="stiletto", straps=((0.86, 0.89), (0.74, 0.77), (0.62, 0.65)), ankle=(0.012, 0.008), sole_t=0.006),
    "shoes_ankle_strap": S("shoes_ankle_strap", "Ankle-strap heels", "dopebyfabby", ["#B0124A", "#2A1A14", "#D9B35B"], 0.46, "pump", heel_shape="stiletto", vamp=0.68, side_h=0.02, pointy=0.02, ankle=(0.014, 0.012), finish="patent"),
    "shoes_heel_boots": S("shoes_heel_boots", "Heeled boots", "tolaptsd", ["#141414", "#141414", "#8A8A8A"], 0.34, "boot", heel_shape="chunky", boot_top=0.3, sole_t=0.009),
    "shoes_platforms": S("shoes_platforms", "Platform heels", "okrika", ["#E07AA6", "#FFFFFF", "#E07AA6"], 0.42, "sandal", heel_shape="chunky", platform=0.024, straps=((0.76, 0.9),), ankle=(0.014, 0.014), sole_t=0.01),
    "shoes_kitten": S("shoes_kitten", "Kitten heels", "thai", ["#F4EFE6", "#2A1A14", "#C9A04A"], 0.2, "pump", heel_shape="kitten", vamp=0.62, side_h=0.024, pointy=0.026),
    "shoes_beaded_sandals": S("shoes_beaded_sandals", "Coral beaded heels", "dejideji", ["#C9A04A", "#5A3A22", "#E4572E"], 0.3, "sandal", heel_shape="block", straps=((0.66, 0.76), (0.5, 0.56)), ankle=(0.012, 0.012), beads=True, sole_t=0.009),
}

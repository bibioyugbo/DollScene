"""
The store outfits, built on the base female (see garmentkit.py for how garments are made).

    /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/character/outfit/build_outfits.py [-- <id> ...]

With ids, only those outfits are (re)built. Every design here is original artwork (prints,
graphics, butterflies): no logos and no brand marks; the store names in the game are only where
the pieces are sold. OUTFIT_SAMPLES=6 renders the preview sheets faster.

Stores (src/studio/stores.ts lists them for the app):
  Kai Collective   kai_butterfly_red, kai_butterfly_blue, kai_garden_set
  Mon Cherrie      mc_corset_mini, mc_slip_dress
  Dope by Fabby    dbf_sequin_mini, dbf_flare_set
  Deeji            deeji_iro_buba, deeji_ankara_set
  Bolaptsd         bola_distressed, bola_rock_set
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402

import garmentkit as gk  # noqa: E402
from garmentkit import hexrgb, smoothstep  # noqa: E402

T = 2048  # body-UV parts
TT = 1024  # tube parts

# name, store: what the build writes to character.json
CATALOG = {
    "kai_butterfly_red": ("Butterfly tank, red", "kai"),
    "kai_butterfly_blue": ("Butterfly tank, blue", "kai"),
    "kai_garden_set": ("Garden cami & midi", "kai"),
    "mc_corset_mini": ("Blush corset set", "moncherrie"),
    "mc_slip_dress": ("Lilac slip dress", "moncherrie"),
    "dbf_sequin_mini": ("Gold sequin mini", "dopebyfabby"),
    "dbf_flare_set": ("Emerald flare set", "dopebyfabby"),
    "deeji_iro_buba": ("Adire iro & buba", "deeji"),
    "deeji_ankara_set": ("Ankara peplum set", "deeji"),
    "bola_distressed": ("No Rules distressed set", "bolaptsd"),
    "bola_rock_set": ("Tartan rock set", "bolaptsd"),
}


def mix(a, b, t):
    t = np.asarray(t, dtype=np.float64)
    if t.ndim and np.ndim(a) > t.ndim:
        t = t[..., None]
    return a * (1 - t) + b * t


def col3(h):
    return hexrgb(h)[None, None]


# ----------------------------------------------------------------------------- fields


def top_field(base, hem_z, neck_front=0.03, neck_back=0.08, neck_w=0.075, curve_k=22.0, strap=(0.05, 0.105), sleeve_len=None, armhole_x=0.135, strapless=False, front_line=None, back_line=None):
    """Signed field (> 0 inside, ~metres) of a top from hem_z up: a scooped (curve_k > 0) or
    straight (curve_k 0) or V (curve_k < 0) neckline, straps, sleeves down to sleeve_len (0
    shoulder joint .. 1 wrist), or strapless with its own upper edge (front_line(x) / back_line(x)
    give the z of the top edge). Returns (field, allowed)."""
    co = base.co
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    zc = base.z_chest
    front = y < -0.005
    f_hem = z - hem_z
    allowed = (base.w_head < 0.3) & (base.w_hand < 0.05) & (base.w_foot < 0.1)
    if strapless:
        edge = np.where(front, front_line(x), back_line(x))
        F = np.minimum(f_hem, edge - z)
        return F, allowed & ~base.is_arm & (z < zc + 0.06)
    if curve_k >= 0:
        cf = zc + neck_front + curve_k * x * x
    else:
        cf = zc + neck_front + (-curve_k) * ax  # V
    curve = np.where(front, cf, zc + neck_back + 18 * x * x)
    width = np.where(front, neck_w, neck_w * 0.95)
    neck = np.maximum(curve - z, ax - width)
    if sleeve_len is None:
        armpit = zc - 0.025
        xl = np.where(z < armpit, armhole_x, armhole_x - (z - armpit) * (armhole_x - strap[1]) / 0.07)
        # the armhole only shapes the top near the armpit; lower down the sides follow the body
        # (a fixed width there cut holes in the sides of curvy and plus bodies at the waist)
        arm = np.where(z < armpit - 0.1, 1.0, np.maximum(xl, strap[1]) - ax)
        band = np.minimum(ax - strap[0], strap[1] - ax)
        neck = np.maximum(neck, band)  # straps run up through the neckline
        upper = np.maximum.reduce([band, curve - z, (armpit + 0.06) - z])
        F = np.minimum.reduce([f_hem, neck, arm, upper])
        allowed &= ~base.is_arm
    else:
        sleeve = np.where(base.arm_d < 0.1, (sleeve_len - base.arm_t) * 0.5, 1.0)
        F = np.minimum.reduce([f_hem, neck, sleeve])
    return F, allowed


def legs_field(base, top_z, hem_z, rise_back=0.015):
    co = base.co
    z = co[:, 2]
    top = top_z + np.where(co[:, 1] > 0, rise_back, 0.0)
    return np.minimum(top - z, z - hem_z), (~base.is_arm) & (base.w_foot < 0.35)


def covered(F, margin=0.015):
    return set(int(i) for i in np.nonzero(F > margin)[0])


# ----------------------------------------------------------------------------- painting


def around(P):
    """Cylindrical print coordinates on the body: (metres around from the front centre, z). Legs and
    arms use their own axis so an all-over print doesn't smear."""
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    ang = np.arctan2(x, -y)
    return ang * 0.16, z


def paint_shell(base, faces, colour_fn, height_fn, strength=2.5, alpha_fn=None):
    P, N, C = gk.position_map(base, faces, T)
    col = np.clip(colour_fn(P, N, C), 0, 1)
    hgt = height_fn((T, T))
    a = alpha_fn(P, N, C) if alpha_fn else np.ones((T, T))
    col = gk.dilate_fill(col, C, it=12)
    a = np.where(C > 0, a, 1.0)
    if alpha_fn:
        a = gk.dilate_fill(np.dstack([a, a, a]), C, it=12)[..., 0]
    rgba = np.dstack([col, a])
    return rgba, gk.normal_from_height(hgt, strength)


def paint_tube(part, colour_fn, height_fn, strength=2.5, alpha_fn=None):
    """colour_fn(U, V, ang) with U metres around from the front centre, V metres down from the top."""
    umax, vmax = part.dims
    ys, xs = np.mgrid[0:TT, 0:TT].astype(np.float64)
    u = (xs + 0.5) / TT
    v = (ys + 0.5) / TT
    U = u * umax
    V = (1 - v) * vmax
    ang = u * 2 * math.pi
    col = np.clip(colour_fn(U, V, ang), 0, 1)
    a = alpha_fn(U, V, ang) if alpha_fn else np.ones((TT, TT))
    return np.dstack([col, a]), gk.normal_from_height(height_fn((TT, TT)), strength)


def save_tex(oid, name, rgba, nrm):
    t = gk.save_rgba(rgba, os.path.join(gk.TEX_DIR, f"{oid}_{name}.png"))
    n = gk.save_rgba(nrm, os.path.join(gk.TEX_DIR, f"{oid}_{name}_n.png"))
    return t, n


FINISH = {  # material name -> (roughness, metallic) for the Blender preview; the app maps the same names
    "Fabric": (0.8, 0.0),
    "Fabric_satin": (0.38, 0.0),
    "Fabric_sequin": (0.3, 0.35),
    "Fabric_denim": (0.9, 0.0),
    "Fabric_net": (0.7, 0.0),
    "Fabric_leather": (0.45, 0.0),
}


class Design:
    """One outfit: parts, materials, hidden skin."""

    def __init__(self, base, oid):
        self.base = base
        self.id = oid
        self.parts = []
        self.mats = []
        self.hide = set()
        self.ease = 0.0
        self.n = 0

    def material(self, finish, tex, nrm, alpha=False):
        r, m = FINISH[finish]
        self.mats.append(gk.material(finish, tex, nrm, alpha=alpha or finish == "Fabric_net", roughness=r, metallic=m))
        return len(self.mats) - 1

    def shell(self, F, ok, offset, colour, height, finish="Fabric", inflate=20, strength=2.4, alpha=None, hide=True, rate=0.6):
        base = self.base
        faces = base.faces_field(F, ok)
        rgba, nrm = paint_shell(base, faces, colour, height, strength, alpha)
        self.n += 1
        t, n = save_tex(self.id, f"p{self.n}", rgba, nrm)
        mi = self.material(finish, t, n, alpha=alpha is not None)
        part = gk.shell(base, faces, offset, inflate=inflate, inflate_rate=rate, mat=mi, field=F)
        self.parts.append(part)
        if hide:
            self.hide |= covered(F) & set(i for f in faces for i in base.faces[f])
        return part

    def tube(self, rings, colour, height, finish="Fabric", follow=0.6, radial=None, slit=None, strength=2.4, under=()):
        base = self.base
        part = gk.tube(base, rings, mat=0, radial=radial, slit=slit)
        if under:
            gk.over(part, list(under))
        rgba, nrm = paint_tube(part, colour, height, strength)
        self.n += 1
        t, n = save_tex(self.id, f"p{self.n}", rgba, nrm)
        part.mat = self.material(finish, t, n)
        gk.tube_weights(base, part, follow)
        self.parts.append(part)
        # how far the skirt stands off the hips where the hands hang (the app opens the arms that much)
        for z, c, r in part.rings:
            if 0.6 < z < 0.9:
                hull = gk.hull_ring(base, z)[1]
                self.ease = max(self.ease, float(np.max(r - hull)))
        return part

    def save(self):
        obj = gk.finish(self.base, self.id, self.parts, self.mats, self.hide, ease=self.ease)
        gk.render_sheet(self.base, self.id, obj)


# ----------------------------------------------------------------------------- fabrics and prints


def jersey(colour, shade=0.12, wash=0.0):
    c = hexrgb(colour)

    def f(P, N, C):
        g = gk.noise3(P, 0.09, seed=3) * 0.5 + 0.5
        out = c[None, None] * (1 - shade * 0.5 + shade * g[..., None])
        if wash:
            w = np.clip(gk.noise3(P, 0.18, seed=8) * 0.5 + 0.5, 0, 1)
            out = mix(out, np.clip(c * 1.6 + 0.12, 0, 1)[None, None], w * wash)
        return out

    return f


def tube_solid(colour, shade=0.1, seed=1):
    c = hexrgb(colour)

    def f(U, V, ang):
        g = gk.value_noise(U.shape, 80, seed) - 0.5
        return c[None, None] * (1 + shade * g[..., None])

    return f


def waistband(f, colour, depth=0.03):
    c = hexrgb(colour)

    def g(U, V, ang):
        out = f(U, V, ang)
        band = smoothstep(depth + 0.002, depth - 0.002, V)
        out = mix(out, c[None, None] * 0.92, band * 0.9)
        seam = np.abs(V - depth) < 0.0016
        return mix(out, c[None, None] * 0.7, seam * 0.8)

    return g


def flowers(U, V, base_c, cols, scale=0.11, seed=4):
    """An original scattered floral: five-petal blooms with a centre, small leaves between."""
    rng = np.random.default_rng(seed)
    out = np.broadcast_to(base_c, U.shape + (3,)).copy()
    cell = scale
    gx = np.floor(U / cell)
    gy = np.floor(V / cell)
    for jx in (-1, 0, 1):
        for jy in (-1, 0, 1):
            cx_i = gx + jx
            cy_i = gy + jy
            h = (np.sin(cx_i * 127.1 + cy_i * 311.7) * 43758.5453) % 1
            h2 = (np.sin(cx_i * 269.5 + cy_i * 183.3) * 43758.5453) % 1
            px = (cx_i + 0.2 + 0.6 * h) * cell
            py = (cy_i + 0.2 + 0.6 * h2) * cell
            dx, dy = U - px, V - py
            r = np.sqrt(dx * dx + dy * dy)
            th = np.arctan2(dy, dx) + h * 6.28
            size = cell * (0.22 + 0.12 * h2)
            petal = r < size * (0.62 + 0.38 * np.abs(np.cos(th * 2.5)))
            ci = (np.floor(h * len(cols)) % len(cols)).astype(int)
            pc = np.stack([np.choose(ci, [c[k] for c in cols]) for k in range(3)], axis=-1)
            out = np.where(petal[..., None], pc * (0.85 + 0.15 * (r / size)[..., None]), out)
            centre = r < size * 0.22
            out = np.where(centre[..., None], np.array([0.98, 0.82, 0.3]), out)
            # a leaf off to one side
            lx, ly = dx - size * 1.25 * np.cos(h * 9), dy - size * 1.25 * np.sin(h * 9)
            a_ = h * 9
            lu = lx * np.cos(a_) + ly * np.sin(a_)
            lv = -lx * np.sin(a_) + ly * np.cos(a_)
            leaf = (lu / (size * 0.55)) ** 2 + (lv / (size * 0.2)) ** 2 < 1
            out = np.where((leaf & ~petal)[..., None], np.array([0.35, 0.55, 0.36]), out)
    return out


def adire(U, V, ink, light, gold, tile=0.085):
    """An original resist-dye inspired tile: concentric circles, ladder stripes and dotted crosses,
    alternating per tile, with a soft indigo bleed."""
    tx, ty = np.floor(U / tile), np.floor(V / tile)
    fx, fy = U / tile - tx, V / tile - ty
    kind = ((tx + ty) % 3).astype(int)
    dx, dy = fx - 0.5, fy - 0.5
    r = np.sqrt(dx * dx + dy * dy)
    rings = (np.sin(r * 2 * math.pi * 4) > 0.3) & (r < 0.45)
    ladder = (np.abs(dx) < 0.32) & (np.sin(fy * 2 * math.pi * 6) > 0.4) | (np.abs(np.abs(dx) - 0.36) < 0.03)
    dots = ((np.abs(dx) < 0.04) | (np.abs(dy) < 0.04)) & (np.sin((fx + fy) * 40) > 0) | (r < 0.08)
    mark = np.choose(kind, [rings, ladder, dots])
    edge = (fx < 0.03) | (fy < 0.03)
    out = mix(col3(ink[0:7]) if isinstance(ink, str) else ink, hexrgb(light)[None, None], mark * 0.85)
    out = mix(out, hexrgb(gold)[None, None], edge * 0.8)
    bleed = gk.value_noise(U.shape, 12, 7)[..., None] * 0.12
    return np.clip(out * (0.94 + bleed), 0, 1)


def ankara(U, V, cols, tile=0.12):
    """An original wax-print: big bullseyes on a leaf-and-dot ground, offset rows."""
    c0, c1, c2, c3 = [hexrgb(c) for c in cols]
    row = np.floor(V / tile)
    shift = (row % 2) * 0.5
    fx = U / tile + shift
    tx = np.floor(fx)
    lx, ly = fx - tx - 0.5, V / tile - row - 0.5
    r = np.sqrt(lx * lx + ly * ly)
    out = np.broadcast_to(c0, U.shape + (3,)).copy()
    # ground: little leaves and dots
    lf = (np.sin(U * 160) * np.cos(V * 160)) > 0.75
    out = np.where(lf[..., None], c3, out)
    bulls = r < 0.42
    ringsel = (np.floor(r / 0.085) % 2 == 0)
    out = np.where((bulls & ringsel)[..., None], c1, out)
    out = np.where((bulls & ~ringsel)[..., None], c2, out)
    out = np.where((r < 0.08)[..., None], c3, out)
    # wax crackle
    crack = gk.value_noise(U.shape, 9, 3)
    out = out * (0.92 + 0.08 * (crack[..., None] > 0.62))
    return out


def tartan(U, V, base_c, line_c, dark_c, sett=0.07):
    """An original tartan sett: broad dark bands, a fine bright line, on a strong base colour."""
    def bands(t):
        f = (t / sett) % 1
        return (f < 0.32).astype(float), (np.abs(f - 0.66) < 0.025).astype(float), (np.abs(f - 0.5) < 0.06).astype(float)
    d1, l1, m1 = bands(U)
    d2, l2, m2 = bands(V)
    out = np.broadcast_to(hexrgb(base_c), U.shape + (3,)).copy()
    dark = np.clip(d1 * 0.5 + d2 * 0.5, 0, 1)
    out = mix(out, hexrgb(dark_c)[None, None], dark * 0.85)
    out = mix(out, hexrgb(line_c)[None, None], np.maximum(l1, l2))
    out = mix(out, hexrgb(dark_c)[None, None] * 0.6, m1 * m2 * 0.6)
    twill = (np.sin((U + V) * 2600) > 0) * 0.06
    return out * (0.97 + twill[..., None])


def denim(base, colour="#4A6FA5", fade=0.35, rips=None, dark_wash=False):
    c = hexrgb(colour)
    hi = np.clip(c * 1.55 + 0.08, 0, 1)
    lo = c * 0.55
    thread = np.array([0.86, 0.62, 0.28])

    def full(P, N, C):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        g = gk.noise3(P, 0.05, seed=5)
        front = smoothstep(-0.1, -0.6, N[..., 1])
        thigh = front * smoothstep(base.z_knee - 0.05, base.z_knee + 0.12, z) * smoothstep(base.z_hip - 0.02, base.z_hip - 0.12, z)
        knee = front * np.exp(-((z - base.z_knee - 0.01) / 0.05) ** 2)
        whisk = front * np.exp(-((z - (base.z_hip - 0.035)) / 0.02) ** 2) * (0.5 + 0.5 * np.sin(np.abs(x) * 260))
        f_ = np.clip(fade * (thigh * 0.8 + knee * 0.6 + whisk * 0.5) + 0.08 * g, 0, 1)
        col = mix(c[None, None], hi[None, None], f_)
        outer = smoothstep(0.75, 0.95, np.abs(N[..., 0])) * (np.sign(N[..., 0]) == np.sign(x))
        col = mix(col, lo[None, None], smoothstep(0.985, 0.995, np.abs(N[..., 0])) * outer * 0.8)
        zt = float(z[C > 0].max())
        band = smoothstep(zt - 0.037, zt - 0.033, z)
        col = mix(col, lo[None, None] * 1.1, band * 0.55)
        stitch = (np.abs(z - (zt - 0.036)) < 0.0012) | (np.abs(z - (zt - 0.004)) < 0.0012)
        dash = np.sin((x + y) * 900) > 0
        col = mix(col, thread[None, None], (stitch & dash & (C > 0)) * 0.9)
        for lx in (-0.13, -0.06, 0.06, 0.13):
            loop = (np.abs(x - lx) < 0.005) & (z > zt - 0.04) & (y < 0.02)
            col = mix(col, lo[None, None] * 0.9, loop * 0.7)
        fly = (np.abs(x - 0.012) < 0.0012) & (z < zt - 0.04) & (z > zt - 0.16) & (y < 0)
        col = mix(col, thread[None, None], fly * (np.sin(z * 900) > 0) * 0.9)
        btn = np.sqrt(x ** 2 + (z - (zt - 0.02)) ** 2) < 0.007
        col = mix(col, np.array([0.75, 0.62, 0.35])[None, None], (btn & (y < 0)) * 1.0)
        for s in (1, -1):
            r = np.sqrt((x - s * 0.135) ** 2 + (z - zt) ** 2)
            pk = (np.abs(r - 0.075) < 0.0014) & (y < 0) & (x * s > 0.06) & (z < zt - 0.035)
            col = mix(col, thread[None, None], pk * 0.9)
            bx, bz = x - s * 0.085, z - (zt - 0.11)
            inside = (np.abs(bx) < 0.06 - np.maximum(0, -(bz + 0.03)) * 0.6) & (bz > -0.08) & (bz < 0.03) & (y > 0.02)
            edge = inside & ~((np.abs(bx) < 0.054 - np.maximum(0, -(bz + 0.03)) * 0.6) & (bz > -0.074) & (bz < 0.024))
            col = mix(col, lo[None, None] * 0.85, inside * 0.25)
            col = mix(col, thread[None, None], edge * 0.9)
        if dark_wash:
            col = col * 0.5
        if rips:
            hole, fray = rip_field(P, N, rips)
            weft = (np.sin(z * 2600) > 0.2) * fray
            col = mix(col, np.array([0.93, 0.92, 0.88])[None, None], np.clip(weft + fray * 0.6, 0, 1))
        return np.clip(col, 0, 1)

    return full


def rip_field(P, N, rips):
    """Rips: (x_sign, z, half_width, half_height). Returns (hole 0..1, frayed edge 0..1)."""
    x, z = P[..., 0], P[..., 2]
    front = smoothstep(-0.2, -0.6, N[..., 1])
    hole = np.zeros(x.shape)
    fray = np.zeros(x.shape)
    for s, zc, w, h in rips:
        cx = s * 0.1
        n_ = gk.noise3(P, 0.012, seed=int(zc * 1000)) * 0.25
        d = np.sqrt(((x - cx) / w) ** 2 + ((z - zc) / h) ** 2) + n_
        hole = np.maximum(hole, (d < 0.75) * front)
        fray = np.maximum(fray, smoothstep(1.15, 0.85, d) * (d >= 0.75) * front)
    return hole, fray


def lightning(x, z, size=0.1):
    """An original zig-zag bolt (a filled polygon), centred, size = height in metres."""
    pts = np.array([(0.15, 0.5), (-0.2, 0.02), (0.02, 0.02), (-0.15, -0.5), (0.22, 0.08), (0.0, 0.08), (0.18, 0.5)]) * size
    inside = np.zeros(x.shape, dtype=bool)
    n = len(pts)
    for i in range(n):
        (x0, z0), (x1, z1) = pts[i], pts[(i + 1) % n]
        cond = ((z0 > z) != (z1 > z)) & (x < (x1 - x0) * (z - z0) / (z1 - z0 + 1e-12) + x0)
        inside ^= cond
    return inside.astype(float)


def star(x, z, r=0.03, points=5):
    th = np.arctan2(z, x)
    rr = np.sqrt(x * x + z * z)
    lim = r * (0.5 + 0.5 * np.abs(np.cos(th * points / 2))) ** 3 * 1.0 + r * 0.38
    return (rr < lim).astype(float)


# ----------------------------------------------------------------------------- parts used by several designs


def jeans(d, colour="#4A6FA5", fade=0.35, rips=None, flare=0.0, dark=False, top_off=0.04, finish="Fabric_denim"):
    base = d.base
    F, ok = legs_field(base, base.z_waist - top_off, base.z_ankle + 0.03)
    k = base.z_knee

    def off(idx):
        z = base.co[idx, 2]
        o = 0.0045 + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, z)
        if flare:
            o = o + flare * smoothstep(k + 0.02, base.z_ankle + 0.03, z) ** 1.6
        return o

    alpha = (lambda P, N, C: 1.0 - rip_field(P, N, rips)[0]) if rips else None
    part = d.shell(F, ok, off, denim(base, colour, fade, rips, dark), lambda s: gk.twill(s, 2.2), finish="Fabric_net" if rips else finish, inflate=10, rate=0.5, strength=2.6, alpha=alpha, hide=True)
    if rips:
        co = base.co
        for s, zc, w, h in rips:
            near = np.nonzero((np.abs(co[:, 0] - s * 0.1) < w * 1.4) & (np.abs(co[:, 2] - zc) < h * 1.4) & (co[:, 1] < 0))[0]
            d.hide -= set(int(i) for i in near)
    return part


def butterfly_tank(d, tank, wing, vein, outline, hem, tucked=False):
    base = d.base
    zc = base.z_chest
    F, ok = top_field(base, hem, neck_front=0.035, neck_back=0.09, neck_w=0.062, strap=(0.045, 0.1))
    if tucked:
        off = 0.0035
    else:
        off = lambda i: 0.0035 + 0.0085 * smoothstep(hem + 0.08, hem, base.co[i, 2])
    c_vein, c_out = hexrgb(vein), hexrgb(outline)

    def colour(P, N, C):
        col = jersey(tank, 0.12)(P, N, C)
        x, z, front = gk.front_torso(P, N, 0.0, zc - 0.05)
        fill, lines, ant = gk.butterfly(x, z, size=0.115)
        edge = np.clip(gk.blur(fill.astype(np.float64), 2) * (1 - fill) * 4 + ant, 0, 1)
        f = fill * front
        r_ = np.sqrt((x / 0.115) ** 2 + (z / 0.115) ** 2)
        wing_col = mix(hexrgb(wing)[None, None], c_vein[None, None], np.clip((r_ - 0.35) * 1.1, 0, 1) * 0.55)
        col = mix(col, wing_col, f)
        col = mix(col, c_vein[None, None], lines * f * 0.85)
        col = mix(col, c_out[None, None], edge * front)
        return col * (1 - 0.05 * f[..., None] * (gk.noise3(P, 0.004, 9)[..., None] * 0.5 + 0.5))

    return d.shell(F, ok, off, colour, lambda s: gk.knit(s, 2.4), inflate=30, strength=2.2)


# ----------------------------------------------------------------------------- the designs


def kai_butterfly_red(base):
    d = Design(base, "kai_butterfly_red")
    j = jeans(d, "#3E5F8F", 0.4)
    t = butterfly_tank(d, "#C8102E", "#FFC72C", "#E07B00", "#2A1200", base.z_waist - 0.12)
    d.save()


def kai_butterfly_blue(base):
    d = Design(base, "kai_butterfly_blue")
    t = butterfly_tank(d, "#14213D", "#8EC9FF", "#3F7FD0", "#0A1020", base.z_waist - 0.085, tucked=True)
    zt = base.z_waist - 0.04
    rings = [(zt, 0.006, 0.0), (zt - 0.05, 0.008, 0.0), (base.z_hip + 0.06, 0.01, 0.004), (base.z_hip - 0.01, 0.012, 0.014), (base.z_hip - 0.07, 0.012, 0.026), (base.z_hip - 0.12, 0.012, 0.034)]
    white = waistband(lambda U, V, a: np.broadcast_to(hexrgb("#EEEBE3"), U.shape + (3,)) * (0.96 + 0.04 * gk.twill(U.shape, 2.0)[..., None]), "#E2DED3", 0.035)
    d.tube(rings, white, lambda s: gk.twill(s, 2.0), finish="Fabric_denim", under=[t])
    d.save()


def kai_garden_set(base):
    d = Design(base, "kai_garden_set")
    zc = base.z_chest
    F, ok = top_field(base, base.z_waist - 0.02, neck_front=-0.01, neck_back=-0.03, neck_w=0.2, curve_k=0.0, strap=(0.075, 0.09))
    cami = d.shell(F, ok, 0.003, jersey("#9CB89A", 0.06), lambda s: gk.satin(s), finish="Fabric_satin", inflate=30, strength=1.2)
    zt = base.z_waist + 0.01
    rings = [(zt - i * 0.06, 0.006 + min(i, 3) * 0.002, 0.11 * (i / 12) ** 1.5) for i in range(13)]
    waves = lambda ang, k: 0.012 * k * k * np.sin(ang * 9)
    print_ = lambda U, V, a: flowers(U, V, hexrgb("#F6EFE3"), [hexrgb("#E8735A"), hexrgb("#F2B5A7"), hexrgb("#8FB3DE")], 0.1)
    d.tube(rings, waistband(print_, "#9CB89A", 0.035), lambda s: gk.satin(s) * 0.6, finish="Fabric", follow=0.45, radial=waves, under=[cami])
    d.save()


def sweetheart_front(zc):
    return lambda x: zc + 0.008 - 0.042 * np.exp(-(x / 0.022) ** 2) - 1.6 * np.maximum(np.abs(x) - 0.08, 0) ** 2


def mc_corset_mini(base):
    d = Design(base, "mc_corset_mini")
    zc = base.z_chest
    pink = hexrgb("#F2B8C6")
    zt = base.z_waist - 0.03
    rings = [(zt, 0.006, 0.0), (zt - 0.05, 0.008, 0.0), (base.z_hip + 0.05, 0.01, 0.006), (base.z_hip - 0.02, 0.011, 0.02), (base.z_hip - 0.08, 0.011, 0.032), (base.z_hip - 0.13, 0.011, 0.04)]
    skirt = d.tube(rings, waistband(tube_solid("#EBA9BA", 0.12), "#E39AAD", 0.02), lambda s: gk.satin(s), finish="Fabric_satin", radial=lambda a, k: 0.006 * k * np.sin(a * 14))
    F, ok = top_field(base, base.z_waist - 0.07, strapless=True, front_line=sweetheart_front(zc), back_line=lambda x: zc - 0.035 + 0 * x)

    def corset(P, N, C):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        ang = np.arctan2(x, -y)
        col = np.broadcast_to(pink, x.shape + (3,)).copy() * (0.95 + 0.05 * gk.noise3(P, 0.07, 2)[..., None])
        # boning channels: vertical seams every ~30 degrees, with a sheen either side
        ph = (ang / (math.pi / 6)) % 1
        seam = np.abs(ph - 0.5) < 0.04
        col = mix(col, pink * 0.78, seam * 0.9)
        col = mix(col, np.clip(pink * 1.12, 0, 1), smoothstep(0.12, 0.0, np.abs(ph - 0.5) - 0.05) * 0.4)
        # lace-like scallop trim along the top edge
        topz = np.where(y < -0.005, sweetheart_front(zc)(x), zc - 0.035)
        dz = topz - z
        scallop = (dz < 0.012 + 0.003 * np.sin(ang * 60)) & (dz > 0)
        col = mix(col, np.array([0.98, 0.95, 0.94]), scallop * 0.85)
        # back lacing
        back = y > 0.02
        lace = back & (np.abs(x) < 0.03) & (np.abs(((z * 60) % 1) - 0.5) < 0.12) & (np.abs(np.abs(x) - 0.02) < 0.012 + 0.0 * x)
        col = mix(col, np.array([0.98, 0.95, 0.96]), lace * 0.9)
        return col

    top = d.shell(F, ok, 0.004, corset, lambda s: gk.satin(s), finish="Fabric_satin", inflate=35, strength=1.4)
    gk.drape_over(top, skirt, margin=0.004)
    d.save()


def mc_slip_dress(base):
    d = Design(base, "mc_slip_dress")
    lil = "#C9A7D8"
    F, ok = top_field(base, base.z_waist - 0.03, neck_front=-0.035, neck_back=0.0, neck_w=0.11, curve_k=-0.55, strap=(0.068, 0.082))
    bod = d.shell(F, ok, 0.003, jersey(lil, 0.06), lambda s: gk.satin(s), finish="Fabric_satin", inflate=35, strength=1.0)
    zt = base.z_waist + 0.0
    rings = [(zt - i * 0.066, 0.006 + min(i, 3) * 0.003, 0.06 * (i / 11) ** 1.6) for i in range(12)]
    sheen = lambda U, V, a: hexrgb(lil)[None, None] * (0.93 + 0.07 * np.sin(a * 3 + V * 1.5)[..., None] + 0.03 * gk.value_noise(U.shape, 60, 2)[..., None])
    d.tube(rings, sheen, lambda s: gk.satin(s), finish="Fabric_satin", follow=0.5, radial=lambda a, k: 0.008 * k * np.sin(a * 7), slit=(60, 9, base.z_knee + 0.12), under=[bod])
    d.save()


def dbf_sequin_mini(base):
    d = Design(base, "dbf_sequin_mini")
    gold = hexrgb("#D9B35B")

    def seq_col(shape_fn):
        def f(*a):
            hgt, sp = gk.sequins(a[0].shape[:2], 7.0)
            base_c = gold[None, None] * (0.78 + 0.35 * sp[..., None])
            return np.clip(base_c * (0.75 + 0.35 * hgt[..., None]), 0, 1)
        return f

    F, ok = top_field(base, base.z_hip + 0.04, neck_front=-0.03, neck_back=0.03, neck_w=0.1, curve_k=-0.5, strap=(0.05, 0.085))
    top = d.shell(F, ok, 0.003, seq_col(None), lambda s: gk.sequins(s, 7.0)[0], finish="Fabric_sequin", inflate=25, strength=3.0)
    rings = [(base.z_hip + 0.07, 0.004, 0.0), (base.z_hip + 0.02, 0.004, 0.0), (base.z_hip - 0.04, 0.004, 0.0), (base.z_hip - 0.1, 0.004, 0.0), (base.z_hip - 0.17, 0.004, 0.0)]
    d.tube(rings, seq_col(None), lambda s: gk.sequins(s, 7.0)[0], finish="Fabric_sequin", follow=0.7, under=[top], strength=3.0)
    d.save()


def dbf_flare_set(base):
    d = Design(base, "dbf_flare_set")
    zc = base.z_chest
    em = "#0B6E4F"
    F, ok = top_field(base, zc - 0.1, strapless=True, front_line=lambda x: zc - 0.005 + 0 * x, back_line=lambda x: zc - 0.04 + 0 * x)
    d.shell(F, ok, 0.003, jersey(em, 0.06), lambda s: gk.satin(s), finish="Fabric_satin", inflate=30, strength=1.0)

    def crepe(P, N, C):
        col = jersey(em, 0.08)(P, N, C)
        x, y = P[..., 0], P[..., 1]
        s = np.sign(x)
        crease = (np.abs(x - s * 0.095) < 0.0015) & (y < -0.04) & (P[..., 2] < d.base.z_hip - 0.05)
        return mix(col, hexrgb(em)[None, None] * 1.25, crease * 0.7)

    F2, ok2 = legs_field(base, base.z_waist + 0.0, base.z_ankle - 0.01)
    k = base.z_knee
    off = lambda idx: 0.005 + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, base.co[idx, 2]) + 0.042 * smoothstep(k + 0.04, base.z_ankle, base.co[idx, 2]) ** 1.5
    d.shell(F2, ok2, off, crepe, lambda s: gk.knit(s, 1.6) * 0.3, finish="Fabric", inflate=10, rate=0.5, strength=1.0)
    d.save()


def deeji_iro_buba(base):
    d = Design(base, "deeji_iro_buba")
    ink, light, gold = "#1E2A5C", "#7E9BD6", "#D9A441"
    pr = lambda U, V: adire(U, V, hexrgb(ink)[None, None], light, gold)
    zt = base.z_waist - 0.02
    rings = [(zt - i * 0.08, 0.016 + min(i, 2) * 0.002, 0.012 * (i / 11)) for i in range(12)]
    iro_print = lambda U, V, a: mix(pr(U, V), hexrgb(gold)[None, None], (np.abs(V - (rings[0][0] - rings[-1][0]) + 0.03) < 0.012) * 0.9)

    def wrap(U, V, a):
        out = iro_print(U, V, a)
        # the wrapper's overlapping edge runs down the front left, with a fold shadow
        fold = np.abs(a - 0.55) < 0.012
        out = mix(out, np.array([0.05, 0.06, 0.12]), fold * 0.55)
        return out

    iro = d.tube(rings, wrap, lambda s: gk.twill(s, 3.0) * 0.5, finish="Fabric", follow=0.35)
    F, ok = top_field(base, base.z_waist - 0.09, neck_front=0.06, neck_back=0.11, neck_w=0.072, sleeve_len=0.72)
    arm = base.arm_d < 0.1

    def off(idx):
        bell = np.where(arm[idx], 0.065 * smoothstep(0.2, 0.72, base.arm_t[idx]) ** 1.3, 0.0)
        return 0.011 + bell

    buba = d.shell(F, ok, off, lambda P, N, C: pr(*around(P)), lambda s: gk.twill(s, 3.0) * 0.5, finish="Fabric", inflate=45, rate=0.6, strength=1.2)
    gk.drape_over(buba, iro, margin=0.006, band=0.05)
    d.save()


def deeji_ankara_set(base):
    d = Design(base, "deeji_ankara_set")
    cols = ("#F2A33A", "#1B7F79", "#E4572E", "#2B1F3A")
    pr = lambda U, V: ankara(U, V, cols)
    F, ok = top_field(base, base.z_waist - 0.03, neck_front=0.03, neck_back=0.08, neck_w=0.085, curve_k=4.0, strap=(0.05, 0.12))
    bod = d.shell(F, ok, 0.004, lambda P, N, C: pr(*around(P)), lambda s: gk.twill(s, 2.4) * 0.4, inflate=30, strength=1.0)
    zt = base.z_waist + 0.0
    sk_rings = [(zt - i * 0.04, 0.01, 0.0) for i in range(16)]
    skirt = d.tube(sk_rings, lambda U, V, a: pr(U, V), lambda s: gk.twill(s, 2.4) * 0.4, follow=0.75, under=[bod])
    pep_rings = [(zt + 0.01 - i * 0.035, 0.016 + i * 0.002, 0.05 * (i / 4) ** 1.4) for i in range(5)]
    d.tube(pep_rings, lambda U, V, a: pr(U + 0.03, V), lambda s: gk.twill(s, 2.4) * 0.4, follow=0.2, radial=lambda a, k: 0.014 * k * np.sin(a * 8), under=[skirt, bod])
    d.save()


def bola_distressed(base):
    d = Design(base, "bola_distressed")
    j = jeans(d, "#2A2A30", 0.25, rips=[(1, base.z_knee + 0.02, 0.045, 0.03), (-1, base.z_knee - 0.01, 0.05, 0.035), (1, base.z_hip - 0.12, 0.03, 0.022)], dark=False)
    zc = base.z_chest
    F, ok = top_field(base, base.z_hip + 0.02, neck_front=0.075, neck_back=0.11, neck_w=0.07, sleeve_len=0.36)

    def tee(P, N, C):
        col = jersey("#232323", 0.1, wash=0.18)(P, N, C)
        x, z, front = gk.front_torso(P, N, 0.0, zc - 0.07)
        ink = np.clip(gk.stroke_text(x, z + 0.075, "NO RULES", height=0.04, weight=0.2) + lightning(x + 0.0, z - 0.03, 0.12) + star(x - 0.07, z - 0.06, 0.018) + star(x + 0.075, z - 0.01, 0.012), 0, 1) * front
        crackle = (gk.noise3(P, 0.003, 4) > -0.3)
        col = mix(col, np.array([0.92, 0.9, 0.84]), ink * crackle * 0.95)
        # frayed hem: light threads in the last 2 cm
        hem = smoothstep(d.base.z_hip + 0.045, d.base.z_hip + 0.02, P[..., 2])
        col = mix(col, np.array([0.45, 0.45, 0.45]), hem * (np.sin(P[..., 0] * 900) > 0.6) * 0.7)
        return col

    def holes(P, N, C):
        h = np.zeros(P.shape[:2])
        for (cx, cz, r) in ((0.06, zc - 0.2, 0.012), (-0.09, zc - 0.28, 0.009), (0.11, zc - 0.05, 0.007)):
            dd = np.sqrt((P[..., 0] - cx) ** 2 + (P[..., 2] - cz) ** 2) + gk.noise3(P, 0.006, 2) * 0.004
            h = np.maximum(h, (dd < r) * smoothstep(-0.2, -0.6, N[..., 1]))
        return 1 - h

    off = lambda i: 0.016 + 0.006 * smoothstep(d.base.z_hip + 0.15, d.base.z_hip + 0.02, base.co[i, 2])
    d.shell(F, ok, off, tee, lambda s: gk.knit(s, 2.0), finish="Fabric_net", inflate=60, rate=0.65, strength=2.0, alpha=holes)
    d.save()


def bola_rock_set(base):
    d = Design(base, "bola_rock_set")
    zc = base.z_chest
    Fn, okn = legs_field(base, base.z_waist + 0.01, base.z_ankle + 0.005)

    def net_alpha(P, N, C):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        s = np.sign(x)
        ang = np.arctan2(x - s * 0.09, -y)
        u = ang * 0.065
        cell = 0.011
        a = np.abs(((u + z) / cell) % 1 - 0.5)
        b = np.abs(((u - z) / cell) % 1 - 0.5)
        line = (a > 0.42) | (b > 0.42)
        top = z > d.base.z_waist - 0.03  # a solid waistband
        return np.where(line | top, 1.0, 0.0)

    tights = d.shell(Fn, okn, 0.0012, lambda P, N, C: np.broadcast_to(np.array([0.04, 0.04, 0.045]), P.shape), lambda s: np.zeros(s), finish="Fabric_net", inflate=0, alpha=net_alpha, hide=False)
    F, ok = top_field(base, zc - 0.13, neck_front=0.07, neck_back=0.11, neck_w=0.07, sleeve_len=0.22)

    def crop(P, N, C):
        col = jersey("#6E6E72", 0.1, wash=0.3)(P, N, C)
        x, z, front = gk.front_torso(P, N, 0.0, zc - 0.06)
        ink = np.clip(gk.stroke_text(x, z, "WILD", height=0.05, weight=0.22) + star(x - 0.085, z + 0.0, 0.016) + star(x + 0.085, z + 0.0, 0.016), 0, 1) * front
        return mix(col, np.array([0.08, 0.08, 0.08]), ink * 0.95)

    top = d.shell(F, ok, 0.012, crop, lambda s: gk.knit(s, 2.0), inflate=50, rate=0.65, strength=2.0)
    zt = base.z_waist - 0.04
    rings = [(zt, 0.006, 0.0), (zt - 0.05, 0.008, 0.0), (base.z_hip + 0.06, 0.01, 0.006), (base.z_hip - 0.01, 0.012, 0.018), (base.z_hip - 0.07, 0.012, 0.03), (base.z_hip - 0.12, 0.012, 0.04)]
    pleats = lambda a, k: 0.009 * (0.3 + 0.7 * k) * np.abs(((a / (2 * math.pi) * 28) % 1) - 0.5) * 2
    tart = lambda U, V, a: tartan(U, V, "#A61E22", "#F2C14E", "#141414")
    d.tube(rings, waistband(tart, "#141414", 0.03), lambda s: gk.twill(s, 2.0) * 0.5, finish="Fabric", radial=pleats, under=[tights])
    d.save()


DESIGNS = {
    "kai_butterfly_red": kai_butterfly_red,
    "kai_butterfly_blue": kai_butterfly_blue,
    "kai_garden_set": kai_garden_set,
    "mc_corset_mini": mc_corset_mini,
    "mc_slip_dress": mc_slip_dress,
    "dbf_sequin_mini": dbf_sequin_mini,
    "dbf_flare_set": dbf_flare_set,
    "deeji_iro_buba": deeji_iro_buba,
    "deeji_ankara_set": deeji_ankara_set,
    "bola_distressed": bola_distressed,
    "bola_rock_set": bola_rock_set,
}


def build(ids):
    for oid in ids or DESIGNS:
        base = gk.Base()
        DESIGNS[oid](base)
    with open(os.path.join(gk.ART, "outfits", "catalog.json"), "w") as f:
        json.dump({k: {"name": n, "store": s} for k, (n, s) in CATALOG.items()}, f, indent=2)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    build(args)

"""
Shared helpers for the hand-built store outfits (Kai Collective, Mon Cherrie, Dope by Fabby, Deeji,
Bolaptsd). Run inside Blender 4.5 with MPFB 2, headless:

    Blender -b --python scripts/character/outfit/build_outfits.py [-- <id> ...]

Every garment is built on the base female in her REST pose (A-pose, exactly what the app skins):

  * shell parts (tops, jeans, tights, sleeves, bodices) are the body's own faces copied, pushed out
    along the skin normal and given a cloth thickness. Each vertex remembers the body vertex it came
    from (int attribute "_src"), takes that vertex's skin weights and, in build_character.py, that
    vertex's morph deltas. So a shell follows every body shape and pose exactly: it cannot clip.
    Loose fits are "inflated": smoothed outward only, so fabric bridges the hollows under the bust
    and between the shoulder blades the way real cloth does.
  * tube parts (skirts, wrappers, peplums) are rings around the body's own cross-section (convex
    hull of the hips and both legs at each height, plus ease and flare), skinned to the hips and
    upper legs. "_src" is -1: the build gives them the morph deltas of the nearest skin.

Textures are painted procedurally in numpy. Shell parts keep the body's UV layout, so their texture
is painted from a position map (each texel knows where on the body it is): prints land on the chest,
seams on the side of the leg, rips on the knees. Tube parts get their own cylindrical UVs and
texture. Material names carry the finish the app renders: Fabric, Fabric_satin, Fabric_sequin,
Fabric_denim, Fabric_leather, Fabric_net (alpha).

Each outfit is saved as art/blender/outfits/outfit_<id>.blend with one object "Outfit_<id>",
skinned to the mixamo rig, plus a custom property "hide_src" (JSON list of base-mesh vertex
indices the garment covers, for the app's skin-hide mask) and "ease" (extra metres at the hips, so
the relaxed arms clear a full skirt). Preview sheets go to art/screens/outfits/<id>.png.

Blender space: Z up, the character faces -Y, her left is +X. Units: metres.
"""

import json
import math
import os

import addon_utils
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ART = os.path.join(ROOT, "art", "blender")
BASE_BLEND = os.path.join(ART, "base", "base_female_mixamo.blend")
TEX_DIR = os.path.join(ROOT, "art", "outfit_tex")
SCREENS = os.path.join(ROOT, "art", "screens", "outfits")

addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True)


def log(*a):
    print("[outfit]", *a, flush=True)


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


srgb2lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
lin2srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0), 1 / 2.4) - 0.055)

# ----------------------------------------------------------------------------- the base body


class Base:
    """The base female at rest: positions, normals, UVs, skin weights and body landmarks."""

    def __init__(self):
        bpy.ops.wm.open_mainfile(filepath=BASE_BLEND)
        self.body = bpy.data.objects["Body"]
        self.rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
        me = self.body.data
        k = self.body.shape_key_add(name="__mix", from_mix=True) if me.shape_keys else None
        src = k.data if k else me.vertices
        self.co = np.array([list(d.co) for d in src], dtype=np.float64)
        if k:
            self.body.shape_key_remove(k)
        assert np.allclose(np.array(self.body.matrix_world), np.eye(4))
        gi = self.body.vertex_groups["body"].index
        self.in_body = np.array([any(g.group == gi and g.weight > 0.5 for g in v.groups) for v in me.vertices])
        nv = len(self.co)
        self.nv = nv
        # Clothes rest on a smooth bust: the nipple and five rings around it are relaxed flat for
        # the garments' benefit only (the body itself is unchanged), so fitted tops, corsets and
        # dresses never show points poking through the fabric.
        if "nipple" in self.body.vertex_groups:
            ni = self.body.vertex_groups["nipple"].index
            ring = np.array([any(g.group == ni and g.weight > 0.3 for g in v.groups) for v in me.vertices])
            ee = np.empty(len(me.edges) * 2, dtype=np.int64)
            me.edges.foreach_get("vertices", ee)
            ee = ee.reshape(-1, 2)
            for _ in range(5):
                r2 = ring.copy()
                r2[ee[ring[ee[:, 0]], 1]] = True
                r2[ee[ring[ee[:, 1]], 0]] = True
                ring = r2
            deg = np.bincount(ee.ravel(), minlength=nv).astype(np.float64)
            for _ in range(90):
                acc = np.zeros_like(self.co)
                np.add.at(acc, ee[:, 0], self.co[ee[:, 1]])
                np.add.at(acc, ee[:, 1], self.co[ee[:, 0]])
                self.co[ring] += (acc[ring] / np.maximum(deg[ring], 1)[:, None] - self.co[ring]) * 0.7
        # topology + normals of the mixed rest shape (helpers dropped so normals are the skin's)
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        for v in bm.verts:
            v.co = Vector(self.co[v.index])
        bm.normal_update()
        self.normal = np.array([list(v.normal) for v in bm.verts])
        bm.free()
        self.faces = [tuple(p.vertices) for p in me.polygons]
        self.face_loops = [tuple(range(p.loop_start, p.loop_start + p.loop_total)) for p in me.polygons]
        uv = np.empty(len(me.loops) * 2)
        me.uv_layers.active.data.foreach_get("uv", uv)
        self.loop_uv = uv.reshape(-1, 2)
        lv = np.empty(len(me.loops), dtype=np.int64)
        me.loops.foreach_get("vertex_index", lv)
        self.loop_vert = lv
        e = np.empty(len(me.edges) * 2, dtype=np.int64)
        me.edges.foreach_get("vertices", e)
        self.edges = e.reshape(-1, 2)
        # skin weights over the deform bones
        self.bones = [b.name for b in self.rig.data.bones if b.use_deform]
        col = {self.body.vertex_groups[n].index: j for j, n in enumerate(self.bones) if n in self.body.vertex_groups}
        W = np.zeros((nv, len(self.bones)))
        for v in me.vertices:
            for g in v.groups:
                j = col.get(g.group)
                if j is not None:
                    W[v.index, j] = g.weight
        s = W.sum(axis=1, keepdims=True)
        self.W = np.where(s > 0, W / np.maximum(s, 1e-12), 0.0)
        self.joint = {b.name.replace("mixamorig:", ""): (np.array(self.rig.matrix_world @ b.head_local), np.array(self.rig.matrix_world @ b.tail_local)) for b in self.rig.data.bones}
        z = lambda n: float(self.joint[n][0][2])
        # landmark heights (rest): neck base, chest, waist, hip joint, crotch, knee, ankle
        self.z_neck = z("Neck")
        self.z_chest = z("Spine2")
        self.z_waist = z("Spine1") - 0.03
        self.z_hip = z("LeftUpLeg")
        self.z_knee = z("LeftLeg")
        self.z_ankle = z("LeftFoot")
        legs = self.in_body & (np.abs(self.co[:, 0]) < 0.03) & (self.co[:, 2] < self.z_hip) & (self.co[:, 2] > self.z_knee)
        self.z_crotch = float(self.co[legs, 2].max()) if legs.any() else self.z_hip - 0.07
        self.height = float(self.co[self.in_body, 2].max())
        # body parts by weight
        self.w_arm = self.wsum("Arm", "ForeArm", "Hand")  # the whole arm chain incl. fingers
        self.w_upper = self.wsum("LeftArm", "RightArm", exact=True)
        self.w_fore = self.wsum("LeftForeArm", "RightForeArm", exact=True)
        self.w_hand = self.wsum("Hand")
        self.w_head = self.wsum("Head", "Neck", exact=True)
        self.w_foot = self.wsum("Foot", "ToeBase")
        # geometric arm test (skin weights bleed far into the chest): for each vertex, the position
        # along shoulder -> elbow -> wrist (arm_t: 0 at the shoulder joint, 1 at the wrist, negative
        # toward the torso) and the distance from that line
        self.arm_t = np.full(nv, -9.0)
        self.arm_d = np.full(nv, 9.0)
        for side, sgn in (("Left", 1), ("Right", -1)):
            S_, E_, W_ = self.joint[f"{side}Arm"][0], self.joint[f"{side}ForeArm"][0], self.joint[f"{side}Hand"][0]
            L1, L2 = np.linalg.norm(E_ - S_), np.linalg.norm(W_ - E_)
            best_d = np.full(nv, 9.0)
            best_t = np.full(nv, -9.0)
            for (A, B, t0, L) in ((S_, E_, 0.0, L1), (E_, W_, L1, L2)):
                ab = B - A
                u = ((self.co - A) @ ab) / (ab @ ab)
                uc = np.clip(u, 0 if t0 > 0 else -0.6, 1)
                dist = np.linalg.norm(self.co - (A + uc[:, None] * ab), axis=1)
                tt = (t0 + u * L) / (L1 + L2)
                better = dist < best_d
                best_d = np.where(better, dist, best_d)
                best_t = np.where(better, tt, best_t)
            side_m = (self.co[:, 0] * sgn) > 0
            self.arm_t = np.where(side_m, best_t, self.arm_t)
            self.arm_d = np.where(side_m, best_d, self.arm_d)
        self.is_arm = ((self.arm_t > -0.02) & (self.arm_d < 0.075)) | (self.w_hand > 0.3)
        log("base", nv, "verts; neck %.3f chest %.3f waist %.3f hip %.3f crotch %.3f knee %.3f ankle %.3f height %.3f" % (self.z_neck, self.z_chest, self.z_waist, self.z_hip, self.z_crotch, self.z_knee, self.z_ankle, self.height))

    def wsum(self, *parts, exact=False):
        idx = []
        for j, n in enumerate(self.bones):
            short = n.replace("mixamorig:", "")
            if exact:
                if short in parts:
                    idx.append(j)
            elif any(p in short for p in parts):
                idx.append(j)
        return self.W[:, idx].sum(axis=1) if idx else np.zeros(self.nv)

    def faces_field(self, F, allowed=None):
        """Faces with at least one corner inside the field (> 0) and every corner real skin."""
        ok = self.in_body if allowed is None else (self.in_body & allowed)
        return [i for i, f in enumerate(self.faces) if all(ok[v] for v in f) and any(F[v] > 0 for v in f)]

    def faces_where(self, vmask):
        """Indices of body faces whose vertices are all in vmask (and are real skin)."""
        m = vmask & self.in_body
        return [i for i, f in enumerate(self.faces) if all(m[v] for v in f)]


# ----------------------------------------------------------------------------- garment parts


class Part:
    """Geometry being assembled for one material: verts, faces (vertex index tuples), loop UVs."""

    def __init__(self, mat):
        self.mat = mat
        self.verts = []
        self.src = []
        self.weights = []  # per vertex: dict bone -> weight
        self.faces = []
        self.uvs = []  # per face: list of (u, v)


def shell(base, face_ids, offset, inflate=0, inflate_rate=0.5, mat=0, smooth_tangent=0.15, field=None):
    """Copy body faces, push each vertex out along the normal by offset(i) metres (i = body index,
    or an array), inflate concavities outward-only, keep the body UVs and weights.
    field: the garment's signed cut field over body vertices (> 0 inside). Faces are taken when any
    corner is inside (Base.faces_field); corners outside slide along their edges onto the zero
    line, so hems and necklines are clean curves instead of the mesh's stair steps."""
    used = sorted({v for fi in face_ids for v in base.faces[fi]})
    remap = {v: j for j, v in enumerate(used)}
    off = offset(np.array(used)) if callable(offset) else np.full(len(used), float(offset))
    loc_edges = set()
    for fi in face_ids:
        f = [remap[v] for v in base.faces[fi]]
        for a, b in zip(f, f[1:] + f[:1]):
            loc_edges.add((min(a, b), max(a, b)))
    E = np.array(sorted(loc_edges))
    deg = np.bincount(E.ravel(), minlength=len(used)).astype(np.float64)
    co = base.co[used].copy()
    if field is not None:
        F = field[used]
        acc = np.zeros_like(co)
        cnt = np.zeros(len(used))
        for a, b in E:
            fa, fb = F[a], F[b]
            if (fa > 0) == (fb > 0):
                continue
            o, i = (a, b) if fa <= 0 else (b, a)  # o outside, i inside
            t = F[o] / (F[o] - F[i])  # from o toward i, where the field crosses 0
            acc[o] += co[o] + (co[i] - co[o]) * min(max(t, 0.0), 0.95)
            cnt[o] += 1
        moved = cnt > 0
        co[moved] = acc[moved] / cnt[moved][:, None]
        # relax the hem line along itself (keeps the curve, removes the scallops between snapped corners)
        from collections import Counter

        ec = Counter()
        for fi in face_ids:
            f = [remap[v] for v in base.faces[fi]]
            for a, b in zip(f, f[1:] + f[:1]):
                ec[(min(a, b), max(a, b))] += 1
        BE = np.array([e for e, n_ in ec.items() if n_ == 1])
        if len(BE):
            for _ in range(10):
                acc = np.zeros_like(co)
                cnt = np.zeros(len(used))
                np.add.at(acc, BE[:, 0], co[BE[:, 1]])
                np.add.at(acc, BE[:, 1], co[BE[:, 0]])
                np.add.at(cnt, BE[:, 0], 1)
                np.add.at(cnt, BE[:, 1], 1)
                on = cnt == 2
                co[on] = co[on] * 0.5 + 0.5 * acc[on] / 2
    P = co + base.normal[used] * off[:, None]
    N = base.normal[used].copy()
    # inflate: outward-only smoothing (cloth bridges hollows), plus a little tangential relax
    if inflate:
        rest = P.copy()
        for _ in range(inflate):
            acc = np.zeros_like(P)
            np.add.at(acc, E[:, 0], P[E[:, 1]])
            np.add.at(acc, E[:, 1], P[E[:, 0]])
            avg = acc / np.maximum(deg, 1)[:, None]
            d = avg - P
            dn = (d * N).sum(axis=1)
            out = np.maximum(dn, 0)[:, None] * N * inflate_rate
            tang = (d - dn[:, None] * N) * smooth_tangent
            P = P + out + tang
            # never inside the starting surface
            below = ((P - rest) * N).sum(axis=1)
            P = P - np.minimum(below, 0)[:, None] * N
    if field is not None and len(BE):
        # once more after inflating (it moves hem vertices unevenly): a smooth hem, never inward
        rest = co + base.normal[used] * off[:, None]
        for _ in range(8):
            acc = np.zeros_like(P)
            cnt = np.zeros(len(used))
            np.add.at(acc, BE[:, 0], P[BE[:, 1]])
            np.add.at(acc, BE[:, 1], P[BE[:, 0]])
            np.add.at(cnt, BE[:, 0], 1)
            np.add.at(cnt, BE[:, 1], 1)
            on = cnt == 2
            P[on] = P[on] * 0.5 + 0.5 * acc[on] / 2
            below = ((P - rest) * N).sum(axis=1)
            P = P - np.minimum(below, 0)[:, None] * N
    part = Part(mat)
    part.verts = [tuple(p) for p in P]
    part.src = list(used)
    part.weights = [None] * len(used)  # filled from the body by finish()
    for fi in face_ids:
        part.faces.append(tuple(remap[v] for v in base.faces[fi]))
        part.uvs.append([tuple(base.loop_uv[l]) for l in base.face_loops[fi]])
    part.body_uv = True
    return part


def _convex_hull(pts):
    """2D convex hull (Andrew's monotone chain), counter-clockwise."""
    P = sorted(set(map(tuple, np.round(pts, 6))))
    if len(P) < 3:
        return np.array(P)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in P:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(P):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return np.array(lower[:-1] + upper[:-1])


def hull_ring(base, z, n=72, band=0.012, exclude_arms=True, centre=None, min_r=0.0):
    """Convex outline of the body at height z (hips and both legs), sampled at n angles from its
    centre: returns (centre_xy, radii[n])."""
    m = base.in_body & (np.abs(base.co[:, 2] - z) < band)
    if exclude_arms:
        m &= ~base.is_arm
    pts = base.co[m][:, :2]
    if len(pts) < 8:
        raise ValueError(f"no body section at z={z:.3f}")
    c = pts.mean(axis=0) if centre is None else np.asarray(centre)
    ang = np.linspace(0, 2 * math.pi, n, endpoint=False)
    dirs = np.stack([np.sin(ang), -np.cos(ang)], axis=1)  # angle 0 = front (-Y), 90 deg = her left (+X)
    hull = _convex_hull(pts)
    # radius of the hull boundary along each ray from the centre (cloth spans the hollows: between
    # the legs, the small of the back, under the belly)
    r = np.empty(n)
    for i, d in enumerate(dirs):
        best = 0.0
        for k in range(len(hull)):
            p0, p1 = hull[k] - c, hull[(k + 1) % len(hull)] - c
            e = p1 - p0
            den = d[0] * e[1] - d[1] * e[0]
            if abs(den) < 1e-12:
                continue
            t = (p0[0] * e[1] - p0[1] * e[0]) / den
            u = (p0[0] * d[1] - p0[1] * d[0]) / den
            if t > 0 and -1e-9 <= u <= 1 + 1e-9:
                best = max(best, t)
        r[i] = max(best, min_r)
    return c, r


def tube(base, rings, mat=1, n=72, radial=None, slit=None):
    """A skirt-like tube. rings: [(z, ease_m, flare_m)] from top to bottom. Each ring = the body
    outline at that z (never narrower than the ring above, less 1.5%: skirts don't tuck back in) +
    ease + flare. radial(ang, k) -> extra metres (pleats, waves; k = 0 top .. 1 hem).
    slit = (centre_deg, half_width_deg, z_top): no faces there below z_top.
    UVs are normalised; part.dims = (metres around the widest ring, metres top to hem)."""
    part = Part(mat)
    prev = None
    rows = []
    vlen = 0.0
    last_pts = None
    ang = np.linspace(0, 2 * math.pi, n, endpoint=False)
    dirs = np.stack([np.sin(ang), -np.cos(ang)], axis=1)  # angle 0 = front (-Y), 90 deg = her left (+X)
    part.rings = []
    zs = [z for z, _e, _f in rings]
    for zi, (z, ease, flare) in enumerate(rings):
        # each ring covers the body halfway to its neighbours: straight panels between rings must
        # never cut inside a curve (glutes, thighs) and let the skin poke through
        gap = max([abs(z - zs[k]) for k in (zi - 1, zi + 1) if 0 <= k < len(zs)] or [0.0])
        band = max(0.012, gap * 0.6)
        try:
            c, r = hull_ring(base, z, n=n, band=band)
        except ValueError:
            c, r = prev
        if prev is not None:
            pc, pr = prev
            if np.linalg.norm(c - pc) < 0.08:
                # keep the skirt hanging straight from the ring above: measure from that centre
                c = pc
                try:
                    r = hull_ring(base, z, n=n, band=band, centre=pc)[1]
                except ValueError:
                    r = pr
            r = np.maximum(r, pr * 0.985)
        prev = (c, r)
        k = zi / max(len(rings) - 1, 1)
        rr = r + ease + flare + (radial(ang, k) if radial else 0.0)
        part.rings.append([z, np.array(c, dtype=np.float64), rr.astype(np.float64)])
        xy = c + dirs * rr[:, None]
        pts = np.column_stack([xy, np.full(n, z)])
        if last_pts is not None:
            vlen += float(np.linalg.norm(pts - last_pts, axis=1).mean())
        last_pts = pts
        row = []
        for p in pts:
            part.verts.append(tuple(p))
            part.src.append(-1)
            part.weights.append(None)
            row.append(len(part.verts) - 1)
        circ = float(np.linalg.norm(np.roll(pts, -1, axis=0) - pts, axis=1).sum())
        rows.append((row, vlen, circ))
    for (r0, v0, c0), (r1, v1, c1), ring1 in zip(rows, rows[1:], part.rings[1:]):
        for i in range(n):
            if slit is not None:
                cdeg, hw, ztop = slit
                adeg = math.degrees(ang[i] + math.pi / n)
                dd = abs(((adeg - cdeg) + 180) % 360 - 180)
                if dd < hw and ring1[0] < ztop:
                    continue
            j = (i + 1) % n
            a, b, cc, d = r0[i], r0[j], r1[j], r1[i]
            part.faces.append((a, d, cc, b))  # outward-facing winding
            u0, u1 = i / n, (i + 1) / n
            part.uvs.append([(u0 * c0, -v0), (u0 * c1, -v1), (u1 * c1, -v1), (u1 * c0, -v0)])
    part.body_uv = False
    part.tube_rows = [r for r, _v, _c in rows]
    part.ang = ang
    umax = max(c for _r, _v, c in rows)
    vmax = max(rows[-1][1], 1e-6)
    part.uvs = [[(u / umax, 1 + v / vmax) for u, v in face] for face in part.uvs]
    part.dims = (umax, vmax)  # metres around (widest ring) and down (top to hem)
    return part


def _ring_at(tpart, z):
    """Interpolated (centre, radii) of a tube at height z, or None outside it."""
    R = tpart.rings
    if z > R[0][0] or z < R[-1][0]:
        return None
    for (z0, c0, r0), (z1, c1, r1) in zip(R, R[1:]):
        if z1 <= z <= z0:
            t = (z0 - z) / max(z0 - z1, 1e-9)
            return c0 * (1 - t) + c1 * t, r0 * (1 - t) + r1 * t
    return None


def _polar(c, p):
    dx, dy = p[0] - c[0], p[1] - c[1]
    return math.atan2(dx, -dy) % (2 * math.pi), math.hypot(dx, dy)


def drape_over(shell_part, tpart, margin=0.004, band=0.03):
    """Where a top hangs over a skirt's waist, push the top out past the skirt (plus margin), and
    ease that into the fabric above over `band` metres so it reads as cloth falling over a waistband."""
    n = len(tpart.ang)
    for i, p in enumerate(shell_part.verts):
        z = p[2]
        zz = min(z, tpart.rings[0][0])
        ring = _ring_at(tpart, zz)
        if ring is None:
            continue
        c, r = ring
        a, rad = _polar(c, p)
        f = a / (2 * math.pi) * n
        i0 = int(f) % n
        need = r[i0] * (1 - (f - int(f))) + r[(i0 + 1) % n] * (f - int(f)) + margin
        w = 1.0 if z <= tpart.rings[0][0] else float(np.clip(1 - (z - tpart.rings[0][0]) / band, 0, 1))
        if rad < need and w > 0:
            k = (rad + (need - rad) * w) / max(rad, 1e-6)
            shell_part.verts[i] = (c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, z)


def over(tpart, inner_parts, margin=0.004):
    """Push a tube's rings out past whatever it covers (tucked tops, tights, a skirt underneath)."""
    n = len(tpart.ang)
    pts = np.vstack([np.array(q.verts) for q in inner_parts]) if inner_parts else np.zeros((0, 3))
    for row, ring in zip(tpart.tube_rows, tpart.rings):
        z, c, r = ring
        sel = pts[np.abs(pts[:, 2] - z) < 0.012]
        if len(sel):
            dx, dy = sel[:, 0] - c[0], sel[:, 1] - c[1]
            a = np.arctan2(dx, -dy) % (2 * math.pi)
            rad = np.hypot(dx, dy)
            bins = (a / (2 * math.pi) * n).astype(int) % n
            need = np.zeros(n)
            np.maximum.at(need, bins, rad + margin)
            need = np.maximum(need, np.maximum(np.roll(need, 1), np.roll(need, -1)))
            r[:] = np.maximum(r, need)
        for i, vi in enumerate(row):
            tpart.verts[vi] = (c[0] + math.sin(tpart.ang[i]) * r[i], c[1] - math.cos(tpart.ang[i]) * r[i], z)


def tube_weights(base, part, follow_legs=0.7):
    """Skirt weights: the top rides the hips; lower down it blends into each upper leg on its own
    side (follow_legs at the hem), so the skirt moves with her stride but never splits."""
    hips = "mixamorig:Hips"
    for i, p in enumerate(part.verts):
        if part.weights[i] is not None:
            continue
        x, _y, z = p
        t = float(np.clip((base.z_hip + 0.03 - z) / max(base.z_hip - base.z_knee, 1e-3), 0, 1))
        legs = follow_legs * t * t * (3 - 2 * t)
        side = float(np.clip(0.5 + x / 0.16, 0, 1))  # +X = her left
        w = {hips: 1 - legs}
        if legs > 1e-3:
            w["mixamorig:LeftUpLeg"] = legs * side
            w["mixamorig:RightUpLeg"] = legs * (1 - side)
        part.weights[i] = w


# ----------------------------------------------------------------------------- textures


def position_map(base, face_ids, size, scalar=None):
    """Rasterise the chosen body faces in UV space: per texel (x, y, z) position, normal, coverage
    (and, with `scalar` (per body vertex), that value interpolated: e.g. the cut field, for hems)."""
    P = np.zeros((size, size, 3), dtype=np.float32)
    N = np.zeros((size, size, 3), dtype=np.float32)
    C = np.zeros((size, size), dtype=np.float32)
    Sm = np.zeros((size, size), dtype=np.float32) if scalar is not None else None
    for fi in face_ids:
        f = base.faces[fi]
        loops = base.face_loops[fi]
        for k in range(1, len(f) - 1):
            tri = (0, k, k + 1)
            uv = np.array([base.loop_uv[loops[t]] for t in tri]) * size - 0.5
            vp = base.co[[f[t] for t in tri]]
            vn = base.normal[[f[t] for t in tri]]
            x0, y0 = np.floor(uv.min(axis=0)).astype(int)
            x1, y1 = np.ceil(uv.max(axis=0)).astype(int)
            x0, y0 = max(x0, 0), max(y0, 0)
            x1, y1 = min(x1, size - 1), min(y1, size - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            (ax, ay), (bx, by), (cx, cy) = uv
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-12:
                continue
            l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
            l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
            l3 = 1 - l1 - l2
            inside = (l1 >= -0.03) & (l2 >= -0.03) & (l3 >= -0.03)
            if not inside.any():
                continue
            pos = l1[..., None] * vp[0] + l2[..., None] * vp[1] + l3[..., None] * vp[2]
            nrm = l1[..., None] * vn[0] + l2[..., None] * vn[1] + l3[..., None] * vn[2]
            P[y0:y1 + 1, x0:x1 + 1][inside] = pos[inside]
            N[y0:y1 + 1, x0:x1 + 1][inside] = nrm[inside]
            C[y0:y1 + 1, x0:x1 + 1][inside] = 1
            if Sm is not None:
                sv = scalar[[f[t] for t in tri]]
                Sm[y0:y1 + 1, x0:x1 + 1][inside] = (l1 * sv[0] + l2 * sv[1] + l3 * sv[2])[inside]
    n = np.linalg.norm(N, axis=2, keepdims=True)
    N = np.where(n > 0, N / np.maximum(n, 1e-9), 0)
    if Sm is not None:
        return P, N, C, Sm
    return P, N, C


def blur(a, r):
    for _ in range(3):
        for axis in (0, 1):
            c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(a.ndim)], mode="edge"), axis=axis)
            hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
            a = (hi - lo) / (2 * r + 1)
    return a


def dilate_fill(img, cov, it=10):
    """Spread colours past the covered texels so mip-maps and seams don't bleed black."""
    img = img.copy()
    cov = cov.copy()
    for _ in range(it):
        w = blur(cov, 1)
        acc = blur(img * cov[..., None], 1)
        fill = (cov < 0.5) & (w > 1e-4)
        img[fill] = acc[fill] / w[fill][..., None]
        cov = np.maximum(cov, (w > 1e-4).astype(np.float32))
    return img


def value_noise(shape, scale_px, seed=0, octaves=3):
    rng = np.random.default_rng(seed)
    h, w = shape
    out = np.zeros(shape)
    amp = 1.0
    tot = 0.0
    s = scale_px
    for _o in range(octaves):
        gh, gw = max(2, int(h / s) + 2), max(2, int(w / s) + 2)
        g = rng.random((gh, gw))
        ys = np.linspace(0, gh - 1.001, h)
        xs = np.linspace(0, gw - 1.001, w)
        y0 = ys.astype(int)
        x0 = xs.astype(int)
        fy = (ys - y0)[:, None]
        fx = (xs - x0)[None, :]
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]
        b = g[y0][:, x0 + 1]
        c = g[y0 + 1][:, x0]
        d = g[y0 + 1][:, x0 + 1]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
        tot += amp
        amp *= 0.5
        s /= 2
    return out / tot


def noise3(P, scale, seed=0):
    """Smooth-ish 3D noise at positions P (..., 3), scale in metres (sum of sines; cheap, seamless)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(P.shape[:-1])
    for _ in range(6):
        k = rng.normal(size=3)
        k /= np.linalg.norm(k)
        ph = rng.random() * 6.283
        out += np.sin((P @ k) * (2 * math.pi / scale) * (0.7 + rng.random() * 0.6) + ph)
    return out / 6


def save_rgba(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.dstack([arr, np.ones((h, w))])
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.clip(arr, 0, 1).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return path


def normal_from_height(hgt, strength=2.0):
    gx = np.gradient(hgt, axis=1) * strength
    gy = np.gradient(hgt, axis=0) * strength
    n = np.dstack([-gx, -gy, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


# -- weaves (height fields in texel space; detail only, the colour comes from the design)


def knit(shape, px=2.2, seed=1):
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w]
    rib = 0.5 + 0.5 * np.cos(xs * 2 * math.pi / px)
    loops = 0.5 + 0.5 * np.cos(ys * 2 * math.pi / (px * 1.4) + (xs // max(1, int(px))) % 2 * math.pi)
    return 0.6 * rib + 0.25 * loops + 0.15 * value_noise(shape, 6, seed)


def twill(shape, px=2.0, seed=2):
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w]
    d = 0.5 + 0.5 * np.cos((xs + ys) * 2 * math.pi / px)
    slub = value_noise(shape, 3, seed) * 0.4 + value_noise(shape, 40, seed + 1) * 0.6
    return 0.7 * d + 0.3 * slub


def satin(shape, seed=3):
    return 0.15 * value_noise(shape, 30, seed) + 0.05 * value_noise(shape, 3, seed + 1)


def sequins(shape, px=7.0, seed=4):
    """Overlapping round sequins on a hex grid: (height, per-sequin sparkle 0..1)."""
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    row = np.floor(ys / (px * 0.866))
    xo = xs / px + (row % 2) * 0.5
    cy = (row + 0.5) * px * 0.866
    cx = (np.floor(xo) + 0.5 - (row % 2) * 0.5) * px
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / (px * 0.55)
    hgt = np.clip(1 - d * d, 0, 1)
    rng = np.random.default_rng(seed)
    cell = (row * 7919 + np.floor(xo) * 104729).astype(np.int64)
    sparkle = (np.sin(cell * 12.9898) * 43758.5453) % 1.0
    return hgt, np.abs(sparkle)


# -- printed artwork (2D signed shapes in metres, on the front of the torso)


def butterfly(x, z, size=0.075, angle=0.0):
    """An original butterfly silhouette centred at (0, 0) in metres: four rounded wings, a slim body
    and two antennae. Returns (fill 0..1, vein lines 0..1) with soft edges."""
    ca, sa = math.cos(angle), math.sin(angle)
    X = (x * ca - z * sa) / size
    Z = (x * sa + z * ca) / size
    ax = np.abs(X)
    # wings as rotated ellipses (upper larger, lower rounder)
    def ell(px, pz, rx, rz, rot):
        c, s = math.cos(rot), math.sin(rot)
        u = (ax - px) * c - (Z - pz) * s
        v = (ax - px) * s + (Z - pz) * c
        return np.sqrt((u / rx) ** 2 + (v / rz) ** 2)
    up = ell(0.48, 0.32, 0.52, 0.36, -0.55)
    lo = ell(0.36, -0.30, 0.34, 0.30, 0.45)
    wing = np.minimum(up, lo)
    # scalloped trailing edge
    wing = wing + 0.05 * np.sin(np.arctan2(Z, ax) * 9)
    fill = smoothstep(1.02, 0.94, wing)
    body = smoothstep(1.0, 0.85, np.sqrt((X / 0.07) ** 2 + (Z / 0.55) ** 2))
    ant = np.zeros_like(X)
    for s_ in (1, -1):
        t = np.clip((Z - 0.45) / 0.4, 0, 1)
        cxv = s_ * (0.05 + 0.25 * t ** 1.4)
        ant = np.maximum(ant, smoothstep(0.035, 0.015, np.abs(X - cxv)) * (Z > 0.45) * (Z < 0.88))
        ant = np.maximum(ant, smoothstep(0.07, 0.04, np.sqrt((X - s_ * 0.29) ** 2 + (Z - 0.88) ** 2)))
    # veins: radial lines from the body inside the wings, plus an inner panel ring
    th = np.arctan2(Z, ax)
    veins = smoothstep(0.08, 0.02, np.abs(np.sin(th * 3.5 + 0.4))) * (ax > 0.12) * fill
    panel = smoothstep(0.06, 0.0, np.abs(wing - 0.72)) * fill
    spots = smoothstep(0.12, 0.08, ell(0.62, 0.38, 0.12, 0.12, 0)) + smoothstep(0.1, 0.06, ell(0.4, -0.3, 0.09, 0.09, 0))
    return np.clip(np.maximum(fill, body), 0, 1), np.clip(np.maximum(np.maximum(veins, panel * 0.8), np.maximum(ant, spots * fill)), 0, 1), ant


def stroke_text(x, z, text, height=0.035, weight=0.16):
    """Very small stroke font (block caps) for graphic tees: returns ink 0..1. Glyphs are line
    segments on a 4x6 grid; letters advance 5 units."""
    G = {
        "A": [(0, 0, 0, 4), (0, 4, 2, 6), (2, 6, 4, 4), (4, 4, 4, 0), (0, 3, 4, 3)],
        "B": [(0, 0, 0, 6), (0, 6, 3, 6), (3, 6, 4, 5), (4, 5, 3, 3), (0, 3, 3, 3), (3, 3, 4, 2), (4, 2, 4, 1), (4, 1, 3, 0), (3, 0, 0, 0)],
        "D": [(0, 0, 0, 6), (0, 6, 2, 6), (2, 6, 4, 4), (4, 4, 4, 2), (4, 2, 2, 0), (2, 0, 0, 0)],
        "E": [(4, 0, 0, 0), (0, 0, 0, 6), (0, 6, 4, 6), (0, 3, 3, 3)],
        "L": [(0, 6, 0, 0), (0, 0, 4, 0)],
        "N": [(0, 0, 0, 6), (0, 6, 4, 0), (4, 0, 4, 6)],
        "O": [(0, 1, 0, 5), (0, 5, 1, 6), (1, 6, 3, 6), (3, 6, 4, 5), (4, 5, 4, 1), (4, 1, 3, 0), (3, 0, 1, 0), (1, 0, 0, 1)],
        "R": [(0, 0, 0, 6), (0, 6, 3, 6), (3, 6, 4, 5), (4, 5, 4, 4), (4, 4, 3, 3), (3, 3, 0, 3), (2, 3, 4, 0)],
        "S": [(4, 6, 1, 6), (1, 6, 0, 5), (0, 5, 0, 4), (0, 4, 1, 3), (1, 3, 3, 3), (3, 3, 4, 2), (4, 2, 4, 1), (4, 1, 3, 0), (3, 0, 0, 0)],
        "T": [(0, 6, 4, 6), (2, 6, 2, 0)],
        "U": [(0, 6, 0, 1), (0, 1, 1, 0), (1, 0, 3, 0), (3, 0, 4, 1), (4, 1, 4, 6)],
        "W": [(0, 6, 1, 0), (1, 0, 2, 4), (2, 4, 3, 0), (3, 0, 4, 6)],
        "Y": [(0, 6, 2, 3), (4, 6, 2, 3), (2, 3, 2, 0)],
        "V": [(0, 6, 2, 0), (2, 0, 4, 6)],
        "C": [(4, 5, 3, 6), (3, 6, 1, 6), (1, 6, 0, 5), (0, 5, 0, 1), (0, 1, 1, 0), (1, 0, 3, 0), (3, 0, 4, 1)],
        "I": [(0, 6, 4, 6), (2, 6, 2, 0), (0, 0, 4, 0)],
        "!": [(2, 6, 2, 2), (2, 0.6, 2, 0)],
        " ": [],
    }
    unit = height / 6
    total = len(text) * 5 - 1
    X = x / unit + total / 2
    Z = z / unit + 3
    ink = np.zeros_like(X)
    w = weight * 6
    for k, ch in enumerate(text):
        ox = k * 5
        for (x0, z0, x1, z1) in G.get(ch, []):
            ax_, az_ = x0 + ox, z0
            bx_, bz_ = x1 + ox, z1
            dx, dz = bx_ - ax_, bz_ - az_
            L2 = dx * dx + dz * dz
            t = np.clip(((X - ax_) * dx + (Z - az_) * dz) / max(L2, 1e-9), 0, 1)
            d = np.sqrt((X - ax_ - t * dx) ** 2 + (Z - az_ - t * dz) ** 2)
            ink = np.maximum(ink, smoothstep(w * 0.55, w * 0.35, d))
    return ink


def front_torso(P, N, cx=0.0, cz=None):
    """Planar coordinates on the front of the torso: (x, z) from the chest centre, and a front mask."""
    front = smoothstep(-0.2, -0.55, N[..., 1])
    return P[..., 0] - cx, P[..., 2] - cz, front


# ----------------------------------------------------------------------------- assemble + save


def material(name, tex_path, nrm_path=None, alpha=False, roughness=0.75, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    img = bpy.data.images.load(tex_path, check_existing=True)
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha:
        nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
        mat.surface_render_method = "DITHERED"
    if nrm_path:
        nimg = bpy.data.images.load(nrm_path, check_existing=True)
        nimg.colorspace_settings.name = "Non-Color"
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = nimg
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def finish(base, outfit_id, parts, materials, hide_src, ease=0.0, thickness=0.0016, folder="outfits", prefix="Outfit", props=None, even=True):
    """Join the parts into Outfit_<id>, skin it, give it cloth thickness, save the .blend."""
    me = bpy.data.meshes.new(f"{prefix}_{outfit_id}")
    verts, faces, src, weights, mats, uvs = [], [], [], [], [], []
    for part in parts:
        o = len(verts)
        verts += part.verts
        src += part.src
        for i, s in enumerate(part.src):
            if part.weights[i] is not None:
                weights.append(part.weights[i])
            else:
                weights.append({base.bones[j]: float(base.W[s, j]) for j in np.nonzero(base.W[s] > 1e-4)[0]})
        for f, uv in zip(part.faces, part.uvs):
            faces.append(tuple(v + o for v in f))
            uvs.append(uv)
            mats.append(part.mat)
    me.from_pydata(verts, [], faces)
    me.update()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    uvl = me.uv_layers.new(name="UVMap")
    for p, uv in zip(me.polygons, uvs):
        for k in range(p.loop_total):
            uvl.data[p.loop_start + k].uv = uv[k]
        p.material_index = mats[p.index]
    obj = bpy.data.objects.new(f"{prefix}_{outfit_id}", me)
    bpy.context.scene.collection.objects.link(obj)
    for m in materials:
        me.materials.append(m)
    a = me.attributes.new("_src", "INT", "POINT")
    a.data.foreach_set("value", np.array(src, dtype=np.int32))
    # winding: shells copy the body's (outward); tube quads are wound outward by construction
    # skin
    obj.parent = base.rig
    groups = {}
    for i, w in enumerate(weights):
        tot = sum(w.values()) or 1.0
        for b, x in w.items():
            if x / tot < 1e-4:
                continue
            g = groups.get(b) or obj.vertex_groups.new(name=b)
            groups[b] = g
            g.add([i], x / tot, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = base.rig
    # cloth thickness (inward, so the outside stays where it was designed) with rims at the hems
    sol = obj.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = -1.0
    sol.use_rim = True
    sol.use_even_offset = even
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.view_layer.objects:
        o.select_set(o is obj)
    bpy.ops.object.modifier_move_to_index(modifier="Solidify", index=0)
    bpy.ops.object.modifier_apply(modifier="Solidify")
    obj["hide_src"] = json.dumps(sorted(int(i) for i in hide_src))
    obj["ease"] = float(ease)
    for k, v in (props or {}).items():
        obj[k] = v
    # keep only the outfit (and the rig/body it fits) in the saved file
    path = os.path.join(ART, folder, f"{prefix.lower()}_{outfit_id}.blend")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=path)
    log("saved", path, len(me.vertices), "verts", len(me.polygons), "faces")
    return obj


VIEWS = [("front", (0, -1, 0.05)), ("3/4 left", (0.75, -0.65, 0.08)), ("left", (1, 0, 0.03)), ("back", (0, 1, 0.05)), ("3/4 back right", (-0.7, 0.7, 0.08))]


def pose_arms_down(rig):
    """The app's relaxed pose (see src/studio/character/pose.ts)."""
    bpy.context.view_layer.update()
    for side, s in (("Left", 1), ("Right", -1)):
        for bn, tgt in ((f"mixamorig:{side}Arm", Vector((0.2 * s, 0.02, -1))), (f"mixamorig:{side}ForeArm", Vector((0.1 * s, -0.16, -1)))):
            pb = rig.pose.bones[bn]
            m = rig.matrix_world @ pb.matrix
            h = m.translation.copy()
            y = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
            r = y.rotation_difference(tgt.normalized()).to_matrix().to_4x4()
            pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(h) @ r @ Matrix.Translation(-h) @ m)
            bpy.context.view_layer.update()


def render_sheet(base, outfit_id, obj, size=420, skin=(0.36, 0.2, 0.12), center=0.86, ortho=1.85, before=None):
    """Five full-length views with the arms relaxed (Eevee), composed into one PNG. `center`/`ortho`
    frame a close-up (shoes); `before` poses anything else first (heeled feet)."""
    sc = bpy.context.scene
    pose_arms_down(base.rig)
    if before:
        before()
    if os.environ.get("OUTFIT_ENGINE") == "cycles":
        # CPU path tracing: slower, but never contends for the GPU with anything else running
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = int(os.environ.get("OUTFIT_SAMPLES", "24"))
        sc.cycles.use_denoising = True
    else:
        try:
            sc.render.engine = "BLENDER_EEVEE_NEXT"
        except TypeError:
            sc.render.engine = "BLENDER_EEVEE"
        sc.eevee.taa_render_samples = int(os.environ.get("OUTFIT_SAMPLES", "24"))
    sc.render.resolution_x = size
    sc.render.resolution_y = int(size * 1.6)
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    world = sc.world or bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.42, 0.45, 0.55, 1)
    bg.inputs["Strength"].default_value = 0.8
    for nm, rot, en in (("Key", (math.radians(50), 0, math.radians(-35)), 3.2), ("Rim", (math.radians(60), 0, math.radians(160)), 2.0), ("Fill", (math.radians(75), 0, math.radians(60)), 1.1)):
        ld = bpy.data.lights.new(nm, "SUN")
        ld.energy = en
        lo = bpy.data.objects.new(nm, ld)
        lo.rotation_euler = rot
        sc.collection.objects.link(lo)
    sk = bpy.data.materials.new("PreviewSkin")
    sk.use_nodes = True
    b = next(n for n in sk.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*skin, 1)
    b.inputs["Roughness"].default_value = 0.5
    base.body.data.materials.clear()
    base.body.data.materials.append(sk)
    for o in bpy.data.objects:
        if o.type == "MESH" and o not in (base.body, obj):
            o.hide_render = True
    cam_d = bpy.data.cameras.new("Cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = ortho
    cam = bpy.data.objects.new("Cam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    tmp = os.path.join(SCREENS, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    tiles = []
    for vi, (_name, d) in enumerate(VIEWS):
        dv = Vector(d).normalized()
        cam.location = Vector((0, 0, center)) + dv * 4
        cam.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
        fp = os.path.join(tmp, f"{outfit_id}_{vi}.png")
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        tiles.append(fp)
    W_, H_ = sc.render.resolution_x, sc.render.resolution_y
    sheet = np.zeros((H_, W_ * len(tiles), 4), dtype=np.float32)
    for vi, fp in enumerate(tiles):
        img = bpy.data.images.load(fp)
        a = np.empty(W_ * H_ * 4, dtype=np.float32)
        img.pixels.foreach_get(a)
        bpy.data.images.remove(img)
        sheet[:, vi * W_:(vi + 1) * W_] = a.reshape(H_, W_, 4)
        os.remove(fp)
    out = os.path.join(SCREENS, f"{outfit_id}.png")
    img = bpy.data.images.new(f"sheet_{outfit_id}", W_ * len(tiles), H_, alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = out
    img.file_format = "PNG"
    img.save()
    log("sheet", out)
    return out

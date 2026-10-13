"""
Shoulder-length hanging volumes (curls, braid_out): one closed, opaque shell per style.

Every column (one per azimuth) is a closed profile:
  crown pole -> OUTER surface over the skull (thickness T above the scalp) -> at the sides and back
  it carries on as a hanging OUTER curtain (draped under gravity, kept BODY_MARGIN + thickness off
  the posed body so it lies on top of clothing) -> rounded HEM -> INNER curtain back up (draped
  close to the neck/ears, clothing margin below the neck) -> the hairline on the skin.
At the face (|az| < face_az[0]) there is no hang: the outer surface tapers onto the hairline like an
afro edge. Between face_az[0] and face_az[1] the hang length grows so the hair frames the face.
The outer surface takes a displacement fn (curl clumps / crimp). Nothing is alpha-tested.
"""

import math
import os

import bmesh

from mathutils import Vector

import hairkit
from hairkit import smoothstep


def _resample(pts, n):
    """n points evenly spaced by arc length along pts (n >= 2)."""
    if len(pts) == 1:
        return [pts[0].copy() for _ in range(n)]
    acc = [0.0]
    for a, b in zip(pts, pts[1:]):
        acc.append(acc[-1] + (b - a).length)
    L = acc[-1]
    if L < 1e-6:
        return [pts[0].copy() for _ in range(n)]
    out = []
    j = 0
    for k in range(n):
        s = L * k / (n - 1)
        while j < len(acc) - 2 and acc[j + 1] < s:
            j += 1
        seg = acc[j + 1] - acc[j]
        t = 0.0 if seg < 1e-9 else (s - acc[j]) / seg
        out.append(pts[j].lerp(pts[j + 1], min(1.0, max(0.0, t))))
    return out


def outward(head, p):
    """Outward direction from a vertical axis through the skull centre (continuous over head and hang)."""
    q = Vector((0.0, head.c.y + 0.01, min(p.z, head.c.z)))
    d = p - q
    return d.normalized() if d.length > 1e-6 else Vector((0, 0, 1))


def drape_margin(head, start, d0, stop_z, hm, bm, step=0.008, spread=0.0, max_x=None, stiff=0.85, max_len=0.5, lean=0.0):
    """Drape a curve from start until z < stop_z; clearance hm on the head blending to bm below the
    neck. spread: outward lean (curly hair widens as it falls). max_x: keep |x| below (arms)."""
    pts = [Vector(start)]
    d = Vector(d0).normalized()
    n = int(max_len / step)
    for i in range(n):
        w = stiff * math.exp(-i * step / 0.04)
        o = outward(head, pts[-1])
        g = Vector((o.x * spread, o.y * spread + lean, -1.0)).normalized()
        d = (d * w + g * (1 - w)).normalized()
        p = pts[-1] + d * step
        for _ in range(3):
            q, nn, _i, _dd = head.bvh.find_nearest(p)
            t = smoothstep(head.z_skull, head.z_neck + 0.004, p.z)
            m = hm + (bm - hm) * t
            s = (p - q).dot(nn)
            if s < m:
                p = q + nn * m + (p - q - nn * s)
        if max_x is not None and abs(p.x) > max_x and p.z < head.z_neck + 0.03:
            p.x = math.copysign(max_x, p.x)
        seg = p - pts[-1]
        if seg.length > 1e-6:
            d = seg.normalized()
            p = pts[-1] + d * step
        pts.append(p)
        if p.z < stop_z:
            break
        # resting on the shoulder: stop instead of sliding along it
        if len(pts) > 8 and pts[-8].z - p.z < 0.006 and p.z < head.z_neck + 0.06:
            break
    return pts


def hanging_volume(head, b, thick_top, thick_hang, hem_z, disp=None, cols=96, n_cap=30, n_hang=18, n_hem=4, n_inner=10, face_az=(42, 78), ramp=22.0, min_thick=0.005, spread=0.15, max_x=0.17, uv_tile=0.06, mat=0, inner_lift=0.003):
    """Build the volume into Builder b. thick_top(az, el): outer thickness over the scalp;
    thick_hang: thickness of the hanging curtain; hem_z(az): hem height for full-length columns;
    disp(p, i, s) -> displacement (m) along the outward direction (i column, s 0..1 down the profile).
    Returns (rows, hem_info) where hem_info[i] = (outer hem point, weight of hang) per column."""
    c = head.c
    columns = []
    hem_info = []
    for i in range(cols):
        az = -180 + 360 * i / cols
        a = abs(((az + 180) % 360) - 180)
        eh = head.hairline(az)
        hw = smoothstep(face_az[0], face_az[1], a)
        T = thick_top(az, eh)
        t_edge = min_thick + (T - min_thick) * hw
        # outer cap, crown -> hairline
        cap = []
        h_max = 0.0
        for k in range(n_cap):
            el = 89.6 + (eh - 89.6) * k / (n_cap - 1)
            d = head.dir(az, el)
            ps, _n = head.surf(az, el)
            rs = (ps - c).length
            Tk = thick_top(az, el)
            u = min(1.0, max(0.0, (el - eh) / ramp))
            g = 1 - (1 - u) ** 1.8
            th = t_edge + (Tk - t_edge) * g
            p = head.push_out(c + d * (rs + th), min_thick, head_margin=min_thick)
            # hanging hair falls from the widest point of the head: below it, the outer surface
            # doesn't follow the skull back in (no ledge over the curtain)
            hx = Vector((p.x, p.y - c.y, 0.0))
            h = hx.length
            if el < 30 and h < h_max and hw > 0 and h > 1e-4:
                want = h + (h_max - h) * hw
                p = Vector((0, c.y, p.z)) + hx * (want / h)
            h_max = max(h_max, h)
            cap.append(p)
        p0 = cap[-1]
        tdir = (cap[-1] - cap[-2]).normalized()
        zh = hem_z(az)
        stop = p0.z + (zh - p0.z) * hw
        skin, sn = head.surf(az, eh)
        s0 = skin + sn * inner_lift
        if hw > 0.02 and stop < p0.z - 0.01:
            # side hair leans slightly forward next to the face, then backward behind the ear, so
            # neighbouring columns land coherently (none slides off the shoulder alone)
            lean = -0.12 * (1 - smoothstep(70, 95, a)) + 0.18 * smoothstep(85, 120, a) * (1 - smoothstep(150, 180, a))
            hang = drape_margin(head, p0, tdir, stop, T, hairkit.BODY_MARGIN + thick_hang, spread=spread, max_x=max_x, lean=lean)
            hang = [p for p in hang if p.z >= stop] + [hang[-1]] if len(hang) > 1 else hang
            # inner curtain: the outer one offset inward by the curtain thickness (hair hangs away
            # from the neck as a layer, not a wedge), kept clear of the body; starts at the hairline
            inner = [s0]
            for p in _resample(hang, n_inner + 2)[2:]:
                q = p - outward(head, p) * thick_hang
                inner.append(head.push_out(q, None, head_margin=inner_lift + 0.002))
        else:
            hang = [p0]
            inner = [s0]
        if os.environ.get("VOLDEBUG"):
            print("VOL", round(az), "hw %.2f" % hw, "p0", tuple(round(x, 3) for x in p0), "n", len(hang), "end", tuple(round(x, 3) for x in hang[-1]), "inner_end", tuple(round(x, 3) for x in inner[-1]))
        hang = _resample(hang, n_hang + 1)[1:]
        inner = _resample(inner, n_inner)
        o_end, i_end = hang[-1], inner[-1]
        hem = []
        span = (o_end - i_end).length
        for k in range(1, n_hem + 1):
            s = k / (n_hem + 1)
            hem.append(o_end.lerp(i_end, s) + Vector((0, 0, -1)) * math.sin(math.pi * s) * 0.5 * span)
        outer = cap + hang
        if disp is not None:
            hem = [p + outward(head, p) * disp(p, i, 1.0) * 0.8 * hw for p in hem]
            tot = len(outer)
            for k, p in enumerate(outer):
                sfrac = k / (tot - 1)
                amp = 1.0 if k >= n_cap - 1 else min(1.0, (cap[k] - head.surf(az, 89.6 + (eh - 89.6) * k / (n_cap - 1))[0]).length / max(T, 1e-3))
                if hw < 0.5 and k > n_cap * 0.7:
                    amp *= max(hw * 2, (n_cap - 1 - k) / (n_cap * 0.3))
                outer[k] = p + outward(head, p) * disp(p, i, sfrac) * amp
        # tip: 0 at the scalp edge / crown .. 1 at the hem
        prof = []
        zt = head.top
        for k, p in enumerate(outer):
            zf = smoothstep(head.z_skull + 0.06, zh, p.z) if hw > 0.02 else 0.0
            depth = 0.25 if k < n_cap else 0.0
            prof.append((p, max(depth, zf)))
        for p in hem:
            prof.append((p, 1.0 if hw > 0.02 else 0.0))
        for p in reversed(inner):
            prof.append((p, smoothstep(head.z_skull + 0.06, zh, p.z) if hw > 0.02 else 0.0))
        columns.append(prof)
        hem_info.append((o_end, hw, az))
    nrow = len(columns[0])
    arcs = []
    for prof in columns:
        s = [0.0]
        for (p0_, _), (p1_, _) in zip(prof, prof[1:]):
            s.append(s[-1] + (p1_ - p0_).length)
        arcs.append(s)
    ring = [columns[i][n_cap // 2][0] for i in range(cols)]
    around = sum((ring[(i + 1) % cols] - ring[i]).length for i in range(cols))
    du = around / cols / uv_tile
    rows, uvs = [], []
    pole = None
    for j in range(nrow):
        row, uvr = [], []
        for i in range(cols):
            p, tip = columns[i][j]
            if j == 0:
                if pole is None:
                    pp = Vector((0, 0, 0))
                    for prof in columns:
                        pp += prof[0][0]
                    pole = b.vert(pp / cols, 0.25)
                row.append(pole)
            else:
                row.append(b.vert(p, tip))
            uvr.append((i * du, arcs[i][j] / uv_tile))
        rows.append(row)
        uvs.append(uvr)
    before = set(b.bm.faces)
    b.grid(rows, uvs, mat=mat, wrap_u=du * cols)
    # rows run crown -> hem, columns by increasing azimuth: that winding faces inwards; flip it
    bmesh.ops.reverse_faces(b.bm, faces=[f for f in b.bm.faces if f not in before])
    return rows, hem_info


def ringlet(head, b, root, length, coil_r=0.007, pitch=0.016, tube_r=0.0038, sides=5, step=0.006, phase=0.0, mat=0, lean=None):
    """A hanging spiral curl (ringlet) from root: a helix around a gently falling axis."""
    axis_dir = Vector((0, 0, -1)) if lean is None else (Vector((0, 0, -1)) + lean).normalized()
    e1 = axis_dir.cross(Vector((0, 1, 0)) if abs(axis_dir.y) < 0.9 else Vector((1, 0, 0))).normalized()
    e2 = axis_dir.cross(e1).normalized()
    turns = length / pitch
    helix_len = turns * math.hypot(2 * math.pi * coil_r, pitch)
    n = max(4, int(helix_len / step))
    pts = []
    for k in range(n + 1):
        t = k / n
        th = phase + 2 * math.pi * turns * t
        r = coil_r * (0.4 + 0.6 * min(1.0, t * 4))
        p = Vector(root) + axis_dir * (length * t) + (e1 * math.cos(th) + e2 * math.sin(th)) * r
        pts.append(head.push_out(p, head.margin_at(p, 0.006) * 0.9 + 0.004))
    b.tube(pts, lambda s: tube_r * (1 - 0.45 * max(0.0, s - 0.8) / 0.2), sides=sides, mat=mat, tip_from=0.8, tip_to=1.0, root=Vector(root))
    return pts

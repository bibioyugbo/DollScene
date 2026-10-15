"""
Very long hanging strands (hip / thigh length braids) and parted root grids.

braidkit.hanging_strands drapes at most 1 m and keeps the clothing margin all the way down; that is
fine to mid-back. Strands that reach the thighs need more:

  * parted_roots: a brick grid of roots on each side of a centre part (a clean strip of scalp from
    the forehead to the crown), rows of constant elevation, so the part edges are straight;
  * hanging_long: braidkit's comb-back-then-fall drape (layering, lanes |x| <= lane_max so nothing
    crosses the spine or lands on the lowered arms) with an unlimited length and a larger body
    clearance from the small of the back down, so the braids ride over the buttocks (and stay
    clear of them on fuller body shapes, where the hanging lengths ride along rigidly) and then
    hang free behind the thighs;
  * front pieces (above / in front of the ears) fall in front of the shoulders, over the bust.
"""

import math

import numpy as np
from mathutils import Vector

import braidkit
import hairkit
from hairkit import smoothstep


def parted_roots(head, spacing_deg=9.0, part_deg=2.2, el_min_off=0.4, jitter=0.0, seed=0, el_top=87.0, part_back_az=125.0):
    """Roots (az, el) on both sides of a centre part. The part runs over the midline from the
    forehead to the crown (|az| < part_back_az at the top); behind it the grid closes over the
    back of the head. part_deg: half-width of the part in degrees of arc."""
    rng = np.random.default_rng(seed)
    lo = min(head.hairline(a) for a in range(0, 181, 5))
    rows = []
    el = el_top
    while el > lo:
        rows.append(el)
        el -= spacing_deg
    out = []
    for ri, el in enumerate(rows):
        ce = max(math.cos(math.radians(el)), 0.05)
        # half-part in azimuth at this elevation (the part is a strip of constant arc width)
        half = min(60.0, math.degrees(math.radians(part_deg) / ce))
        off = 0.5 if ri % 2 else 0.0
        for s in (1, -1):
            # azimuth span on this side: from the part to the back midline
            a0, a1 = half, 180.0
            span = a1 - a0
            n = max(1, int(round(span * ce / spacing_deg)))
            for k in range(n):
                az = a0 + span * (k + 0.5 + off * 0.5) / n
                if az >= 180.0:
                    continue
                if el < head.hairline(az) + el_min_off:
                    continue
                a = az + rng.uniform(-jitter, jitter) * spacing_deg / ce
                e = el + rng.uniform(-jitter, jitter) * spacing_deg
                a = min(max(a, half + 0.3), 179.5)
                out.append((s * a, min(e, 89.0)))
    return out


def even_roots(head, spacing_deg=10.0, part_deg=2.4, part_end=(180, 74), el_min_off=0.4, seed=0, edge_off=0.55, edge_spacing=0.75):
    """Evenly spaced roots (az, el) over the scalp (min angular distance ~spacing_deg) with a clean
    centre part from the forehead to part_end (a strip of half-width part_deg kept bare):
      1. a row along each side of the part, 2. a row just inside the hairline (clean edges),
      3. dart-throwing fill of the rest, then a few relaxation steps of the fill only."""
    from mathutils.kdtree import KDTree

    rng = np.random.default_rng(seed)
    D = head.dir
    sp = math.radians(spacing_deg)
    p0, p1 = D(0, head.hairline(0) + 0.5), D(*part_end)
    mid = D(90, 89.0)  # pass over the top (a great circle front -> back over the midline)
    mid = Vector((0, mid.y, mid.z)).normalized()

    def part_curve(n):
        a = [p0.lerp(mid, i / n).normalized() for i in range(n)]
        return a + [mid.lerp(p1, i / n).normalized() for i in range(n + 1)]

    pc = part_curve(400)

    def part_dist(d):
        return min(d.angle(q) for q in pc[::4])

    def in_part(d, extra=0.0):
        # within the part strip (only while the part runs: beyond part_end the scalp closes)
        if d.y > p1.y + 1e-3 and d.z < p1.z:
            return False
        return part_dist(d) < math.radians(part_deg) + extra

    def on_scalp(d, off):
        az, el = math.degrees(math.atan2(d.x, -d.y)), math.degrees(math.asin(max(-1, min(1, d.z))))
        return el >= head.hairline(az) + off, az, el

    pts = []
    fixed = []
    # 1. part rows
    for s in (1, -1):
        acc = 1e9
        prev = None
        for q in pc:
            if prev is not None:
                acc += q.angle(prev)
            prev = q
            if acc >= sp:
                acc = 0.0
                # offset sideways from the part by part + half spacing
                t = (Vector((s, 0, 0)) - q * q.x).normalized()
                d = (q * math.cos(math.radians(part_deg) + sp * 0.5) + t * math.sin(math.radians(part_deg) + sp * 0.5)).normalized()
                ok, az, el = on_scalp(d, el_min_off)
                if ok:
                    pts.append(d)
                    fixed.append(True)
    # 2. hairline row (all round), stepping in arc length
    acc = 0.0
    prev = None
    az = -179.0
    while az < 179.0:
        el = head.hairline(az) + spacing_deg * edge_off
        d = D(az, el)
        if prev is not None:
            acc += d.angle(prev)
        prev = d
        if (prev is not None and acc >= sp * edge_spacing) or not pts or az == -179.0:
            if not in_part(d, sp * 0.5) and all(d.angle(q) > sp * edge_spacing * 0.9 for q in pts):
                pts.append(d)
                fixed.append(True)
            acc = 0.0
        az += 0.25
    # 3. fill
    cand = []
    for _ in range(40000):
        z = rng.uniform(-0.95, 1.0)
        ph = rng.uniform(-math.pi, math.pi)
        r = math.sqrt(max(0.0, 1 - z * z))
        d = Vector((math.sin(ph) * r, -math.cos(ph) * r, z))
        ok, az, el = on_scalp(d, spacing_deg * edge_off + spacing_deg * 0.5)
        if ok and not in_part(d, sp * 0.5):
            cand.append(d)
    kd_pts = list(pts)
    for d in cand:
        if all(d.angle(q) >= sp * 0.92 for q in kd_pts):
            kd_pts.append(d)
            fixed.append(False)
    pts = kd_pts
    # relax the fill (push apart from neighbours closer than the spacing)
    for _ in range(6):
        kd = KDTree(len(pts))
        for i, q in enumerate(pts):
            kd.insert(q, i)
        kd.balance()
        new = []
        for i, q in enumerate(pts):
            if fixed[i]:
                new.append(q)
                continue
            push = Vector()
            for co, j, dist in kd.find_range(q, sp * 1.15):
                if j == i or dist < 1e-9:
                    continue
                push += (q - co).normalized() * (sp * 1.15 - dist) * 0.35
            nq = (q + push).normalized()
            ok, _a, _e = on_scalp(nq, spacing_deg * edge_off + spacing_deg * 0.3)
            if not ok or in_part(nq, sp * 0.45):
                nq = q
            new.append(nq)
        pts = new
    out = []
    for q in pts:
        az, el = math.degrees(math.atan2(q.x, -q.y)), math.degrees(math.asin(max(-1, min(1, q.z))))
        out.append((az, min(el, 89.5)))
    out.sort(key=lambda ae: (-round(ae[1] / spacing_deg), ae[0]))
    return out


def thin(pts, z_keep, max_seg=0.07, max_turn_deg=3.0, head=None, free=0.05):
    """Drop points on straight hanging stretches below z_keep (fewer rings, same shape). With
    `head`, points resting on the body (closer than `free`) are kept so no chord cuts into it."""
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p = pts[i]
        if p.z > z_keep or (head is not None and head.signed(p)[0] < free):
            out.append(p)
            continue
        a = (p - out[-1])
        b = (pts[i + 1] - p)
        if a.length >= max_seg - 1e-6 or (a.length > 1e-6 and math.degrees(a.angle(b, 0.0)) > max_turn_deg):
            out.append(p)
    out.append(pts[-1])
    return out


def front_gravity_long(head, lane_x, lean_top=-0.28, z0=1.22, z1=1.08, lean_low=-0.02, pull=9.0, max_pull=0.6):
    """Front pieces: like Head.lane_gravity(front=True) - forward over the collarbone and bust -
    then straight down below the bust (a forward lean all the way down reads as stiff rods)."""
    zs = head.z_skull + 0.02

    def g(p):
        w = smoothstep(zs, zs - 0.08, p.z)
        dx = max(-max_pull, min(max_pull, (lane_x - p.x) * pull)) * w
        lean = lean_top + (lean_low - lean_top) * smoothstep(z0, z1, p.z)
        return Vector((dx, lean * (0.3 + 0.7 * w), -1)).normalized()

    return g


def drape_long(head, root, out_dir, stop_z, head_m, step, stiff, bend_len, gravity, body_extra, low_extra, low_z0, low_z1, max_len=1.8, iters=3):
    """braidkit.drape_layered with no length cap and an extra clearance (low_extra) that eases in
    between low_z0 and low_z1 (small of the back -> buttocks)."""
    pts = [Vector(root)]
    d = Vector(out_dir).normalized()
    n = int(max_len / step)
    for i in range(n):
        w = stiff * math.exp(-(i * step) / bend_len)
        g = gravity(pts[-1])
        d = (d * w + g * (1 - w)).normalized()
        p = pts[-1] + d * step
        for _ in range(iters):
            s, q, nn = head.signed(p)
            tb = smoothstep(head.z_skull, head.z_neck + 0.004, p.z)
            lo = smoothstep(low_z0, low_z1, p.z)
            m = head_m(p) * (1 - tb) + (hairkit.BODY_MARGIN + body_extra + low_extra * lo) * tb
            if s < m:
                p = q + nn * m + (p - q - nn * s)
        seg = p - pts[-1]
        if seg.length > 1e-6:
            d = seg.normalized()
            p = pts[-1] + d * step
        pts.append(p)
        if p.z < stop_z:
            break
    return pts


def hanging_long(head, b, roots, radius, stop_back, stop_front, mat=0, sides=5, lobes=0, lobe_amp=0.0, pitch=0.01, step=0.022,
                 layer_per_deg=0.009 / 60, layer_cap=0.014, flat_len=0.045, flat_r0=0.8, flat_sq=0.35, taper=0.12, taper_to=0.5,
                 end_jitter=0.03, seed=1, front_kw=None, lane_max=0.12, lane_k=1.45, low_extra=0.015, low_z0=1.0, low_z1=0.9, back_lean=0.16, thin_below=None, front_lanes=None):
    """Knotless-style (thin flat root growing to full size over flat_len) braids to stop_back /
    stop_front (z). Returns [(strand id, pts)]."""
    rng = np.random.default_rng(seed)
    c = head.c
    out = []
    for az, el in roots:
        p, n, e_az, e_el = braidkit.tangent_frame(head, az, el)
        front = braidkit.is_front(head, az, el, **(front_kw or {}))
        if front:
            if front_lanes:
                fk = front_kw or {}
                lo_, hi_ = fk.get("az_lo", 62), fk.get("az_hi", 104)
                t = min(1.0, max(0.0, (abs(az) - lo_) / max(hi_ - lo_, 1e-3)))
                lane = math.copysign(front_lanes[0] + (front_lanes[1] - front_lanes[0]) * t, az)
            else:
                lane = math.copysign(min(lane_max, max(0.07, abs(p.x) * 1.0 + 0.01)), p.x if abs(p.x) > 1e-4 else az)
            g = front_gravity_long(head, lane)
        else:
            lane = max(-lane_max, min(lane_max, p.x * lane_k))
            lg = braidkit.back_gravity(head, lane, lean=back_lean)
            g = lg
        root = p + n * radius * 0.45
        gd = g(root)
        tang = gd - n * gd.dot(n)
        if tang.length < 1e-4:
            tang = -e_el
        out_dir = (tang.normalized() + n * 0.35).normalized()
        rdir = (root - c).normalized()

        def head_m(q, rdir=rdir):
            ang = math.degrees(rdir.angle((q - c).normalized(), 0.0))
            return radius + 0.0015 + min(layer_cap, layer_per_deg * ang)

        stop = (stop_front if front else stop_back) + rng.uniform(-end_jitter, end_jitter)
        bx = 0.5 * layer_cap * min(1.0, (el - head.hairline(az) + 10) / 80)
        pts = drape_long(head, root, out_dir, stop, head_m, step, 0.88, 0.04, g, bx, low_extra, low_z0, low_z1)
        if thin_below is not None:
            pts = thin(pts, thin_below, head=head)
        if len(pts) < 3:
            continue
        L = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
        fl = min(0.5, flat_len / max(L, 1e-3))

        def rad(s, fl=fl):
            r = radius * (flat_r0 + (1 - flat_r0) * smoothstep(0.0, fl, s))
            return r * (1 - (1 - taper_to) * smoothstep(1 - taper, 1.0, s))

        def sq(s, fl=fl):
            return flat_sq + (1 - flat_sq) * smoothstep(0.0, fl, s)

        frames = []
        for q in pts:
            s_, _qq, nn = head.signed(q)
            frames.append(nn if s_ < radius * 3 else None)
        b.tube(pts, rad, sides=sides, mat=mat, frames=frames, lobes=lobes, lobe_amp=lobe_amp, lobe_twist=2 * math.pi / pitch if lobes else 0.0, squash=sq, root=p)
        out.append((b.cur_sid, pts))
    return out

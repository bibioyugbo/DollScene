"""
Shared builders for parted, hanging protective styles (box braids, knotless braids, two-strand
twists) plus helpers used by cornrows and bantu knots.

Hanging strands (hanging_strands):
  * roots on a brick grid over the whole scalp (hairkit.scalp_roots), each root just sunk into
    the skin so it reads attached;
  * the strand is "combed" back over the scalp (front/top roots run back over the crown) and then
    falls under gravity, steered into a lane (x keeps left/right order, |x| <= 0.12 so nothing
    crosses the spine or lands on the lowered arms);
  * layering: the clearance a strand keeps from the head grows with how far it has travelled from
    its root (strands from higher roots ride over the ones rooted below them) - near its own root
    every strand is on the scalp; below the neck the clearance is the clothing margin plus half
    the layer offset;
  * a few strands from just above/in front of the ears fall in front of the shoulders.
"""

import math

import numpy as np
from mathutils import Vector

import hairkit
from hairkit import smoothstep


def tangent_frame(head, az, el):
    """Skin point, outward normal, unit tangent towards +az (her left at the front), towards +el."""
    p, n = head.surf(az, el)
    p2, _ = head.surf(az + 1.0, min(el, 88.0))
    e_az = p2 - p
    e_az = (e_az - n * e_az.dot(n))
    if e_az.length < 1e-6:
        e_az = Vector((1, 0, 0))
    e_az.normalize()
    e_el = n.cross(e_az).normalized()
    return p, n, e_az, e_el


def drape_layered(head, root, out_dir, stop_z, head_m, max_len=1.0, step=0.012, stiff=0.88, bend_len=0.04, gravity=None, body_extra=0.0, iters=3):
    """Like Head.drape but the head clearance is a function of the point (layering) and the strand
    stops once it is below stop_z. Below the neck: BODY_MARGIN + body_extra."""
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
            m = head_m(p) * (1 - tb) + (hairkit.BODY_MARGIN + body_extra) * tb
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


def back_gravity(head, lane_x, lean=0.16):
    """Combed back over the scalp (towards +y, slightly down), then down the back in its lane."""
    lg = head.lane_gravity(lane_x, False, lean)
    comb = Vector((0, 1, -0.4)).normalized()
    cy, cz = head.c.y, head.c.z

    def g(p):
        t = max(smoothstep(cy - 0.03, cy + 0.05, p.y), smoothstep(cz - 0.01, cz - 0.07, p.z))
        # over the back of the head, ease strands near the midline towards it so no central part shows
        mid = smoothstep(cy, cy + 0.06, p.y) * smoothstep(0.045, 0.0, abs(p.x))
        gl = lg(p) + Vector((-p.x * 8.0 * mid, 0, 0))
        return (comb * (1 - t) + gl * t).normalized()

    return g


def front_gravity(head, lane_x):
    return head.lane_gravity(lane_x, True)


def is_front(head, az, el, az_lo=62, az_hi=104, above=20):
    a = abs(az)
    return az_lo <= a <= az_hi and el <= head.hairline(az) + above


def hanging_strands(head, b, roots, radius, stop_back, stop_front, mat=0, sides=6, lobes=3, lobe_amp=0.16, pitch=0.011,
                    step=0.013, layer_per_deg=0.010 / 60, layer_cap=0.016, root_style="pad", pad_frac=0.40, spacing_deg=10.0,
                    flat_len=0.035, flat_r0=0.42, flat_sq=0.45, taper=0.08, taper_to=0.6, end_jitter=0.025, seed=1, front_kw=None, pad_mat=None,
                    lean_front_only=False):
    """roots: [(az, el)]. root_style: "pad" (box braids: a flattened square base per section),
    "flat" (knotless: thin, flat root growing to full size over flat_len), "plain" (twists).
    Returns list of (strand id, pts)."""
    rng = np.random.default_rng(seed)
    c = head.c
    out = []
    for az, el in roots:
        p, n, e_az, e_el = tangent_frame(head, az, el)
        front = is_front(head, az, el, **(front_kw or {}))
        if front:
            lane = math.copysign(min(0.12, max(0.07, abs(p.x) * 1.0 + 0.01)), p.x if abs(p.x) > 1e-4 else az)
            g = front_gravity(head, lane)
        else:
            lane = max(-0.12, min(0.12, p.x * 1.45))
            g = back_gravity(head, lane)
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
        pts = drape_layered(head, root, out_dir, stop, head_m, step=step, gravity=g, body_extra=0.5 * layer_cap * min(1.0, (el - head.hairline(az) + 10) / 80))
        if len(pts) < 3:
            continue
        L = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
        fl = min(0.5, flat_len / max(L, 1e-3))

        if root_style == "flat":
            def rad(s, fl=fl):
                r = radius * (flat_r0 + (1 - flat_r0) * smoothstep(0.0, fl, s))
                return r * (1 - (1 - taper_to) * smoothstep(1 - taper, 1.0, s))

            def sq(s, fl=fl):
                return flat_sq + (1 - flat_sq) * smoothstep(0.0, fl, s)
        else:
            def rad(s, fl=fl):
                r = radius * (0.85 + 0.15 * smoothstep(0.0, 0.04, s))
                return r * (1 - (1 - taper_to) * smoothstep(1 - taper, 1.0, s))

            sq = 1.0
        frames = None
        if root_style == "flat":
            frames = []
            for q in pts:
                s_, _qq, nn = head.signed(q)
                frames.append(nn if s_ < radius * 3 else None)
        b.tube(pts, rad, sides=sides, mat=mat, frames=frames, lobes=lobes, lobe_amp=lobe_amp, lobe_twist=2 * math.pi / pitch if lobes else 0.0, squash=sq, root=p)
        if root_style == "pad":
            pad(head, b, az, el, spacing_deg * pad_frac, spacing_deg * pad_frac, h=radius * 1.1, mat=pad_mat if pad_mat is not None else mat)
        out.append((b.cur_sid, pts))
    return out


def pad(head, b, az, el, half_az_deg, half_el_deg, h=0.002, segs=12, mat=0):
    """A flattened, rounded-square cushion of hair on the scalp (box-braid base), part of the
    current strand. half sizes in degrees of arc along the surface (az scaled by cos el)."""
    c = head.c
    p0, n0, e_az, e_el = tangent_frame(head, az, el)
    r_m = (p0 - c).length
    ha = math.radians(half_az_deg) * r_m
    he = math.radians(half_el_deg) * r_m

    def on_scalp(u, v, lift):
        q = p0 + e_az * u + e_el * v
        s, nn = head.surf_dir(q - c)
        return s + nn * lift

    def ring(scale, lift):
        out = []
        for k in range(segs):
            th = 2 * math.pi * k / segs
            ct, st = math.cos(th), math.sin(th)
            rho = 1.0 / (abs(ct) ** 4 + abs(st) ** 4) ** 0.25  # squircle
            out.append(b._v(on_scalp(ha * scale * rho * ct, he * scale * rho * st, lift), 0.0))
        return out

    # a low tent: the square of hair sweeps up from the parts into the braid base
    bottom = ring(1.0, -0.0012)
    top = ring(0.96, h * 0.35)
    inner = ring(0.5, h * 0.85)
    ctr = b._v(p0 + n0 * h, 0.0)
    bm = b.bm
    for k in range(segs):
        k2 = (k + 1) % segs
        for a, bb, cc, dd, v0, v1 in ((bottom[k], bottom[k2], top[k2], top[k], 0.0, 0.3), (top[k], top[k2], inner[k2], inner[k], 0.3, 0.7)):
            f = bm.faces.new((a, bb, cc, dd))
            f.material_index = mat
            f.smooth = True
            for loop, uv in zip(f.loops, ((k / segs, v0), ((k + 1) / segs, v0), ((k + 1) / segs, v1), (k / segs, v1))):
                loop[b.uv].uv = uv
        f = bm.faces.new((inner[k], inner[k2], ctr))
        f.material_index = mat
        f.smooth = True
        for loop, uv in zip(f.loops, ((k / segs, 0.7), ((k + 1) / segs, 0.7), ((k + 0.5) / segs, 1.0))):
            loop[b.uv].uv = uv

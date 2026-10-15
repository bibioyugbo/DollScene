"""
Curly / textured parted styles (long_curls, curls, braid_out): a sleek comb shell plus layered
curl clumps. Built on flowkit's centre part (part_lines / comb_shell) and lane-steered layered
drape (drape_layer), so the crown is a smooth surface that follows the skull: the curl pattern
only develops once a clump leaves the scalp, never as lumps on top of the head.

  * clump_wig: comb shell from the part to the hairline + `layers` of clumps rooted on it (higher
    roots outside, with extra clearance). Each clump's centre line is draped in its lane (front
    pieces in front of the shoulders, the rest down the back; |x| <= 0.13, never over the arms),
    then shaped by a pattern:
      - "helix": a spiral curl (corkscrew) wound round the centre line, coil radius easing in
        from `curl_start` metres along the clump (sleek over the scalp),
      - "zigzag": a stretched braid-out crimp (triangle wave in the plane of the hair plus a
        little outwards), also easing in.
    The tube is round (helix) or flattened (zigzag), thin at the root and tapered at the end.
  * Nothing is moved into the body: every shaped point is pushed back out to the layer margin.
Materials: index 0 (Hair) for everything unless given.
"""

import math
import os

import numpy as np
from mathutils import Vector

import flowkit
import hairkit
from hairkit import smoothstep


def outward(head, p):
    _s, _q, n = head.signed(p)
    return n


def resample(pts, step):
    """Evenly spaced points (arc length `step`) along a polyline; the first point kept."""
    if len(pts) < 2:
        return [p.copy() for p in pts]
    acc = [0.0]
    for a, b in zip(pts, pts[1:]):
        acc.append(acc[-1] + (b - a).length)
    L = acc[-1]
    n = max(2, int(L / step) + 1)
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


def smooth_frames(head, pts, win=5):
    raw = [outward(head, p) for p in pts]
    n = len(pts)
    out = []
    for i in range(n):
        acc = Vector()
        for j in range(max(0, i - win), min(n, i + win + 1)):
            acc += raw[j]
        out.append(acc.normalized())
    return out


def curl_gate(head, z, z_curl, band=0.05):
    """0 above z_curl (sleek on the head) .. 1 from z_curl - band down."""
    return smoothstep(z_curl, z_curl - band, z)


def shape(head, pts, pattern, amp, period, start, ramp, phase, margin, extra, res=0.004, depth=0.55, face_x=0.0, z_curl=None, coarse=0.008, gates=True):
    """Wind a pattern round/along a centre line. amp: coil radius (helix) or crimp half-width
    (zigzag); period: helix pitch or zigzag wavelength (metres of centre line); the amplitude
    eases in from `start` over `ramp` metres. margin/extra: clearance off the head/body."""
    zc = head.c.z if z_curl is None else z_curl
    # fine steps only where the pattern is formed (sleek parts on the head stay coarse)
    fine_from = next((i for i, q in enumerate(pts) if q.z < zc), len(pts) - 1) if gates else 0
    head_part = resample(pts[:fine_from + 1], coarse)[:-1] if fine_from > 0 else []
    pts = head_part + resample(pts[fine_from:], res)
    nrm = smooth_frames(head, pts, win=6)
    out = [pts[0]]
    s = 0.0
    n = len(pts)
    hang_acc = 0.0
    for i in range(1, n):
        s += (pts[i] - pts[i - 1]).length
        t = (pts[min(i + 1, n - 1)] - pts[i - 1]).normalized()
        nn = (nrm[i] - t * nrm[i].dot(t))
        nn = nn.normalized() if nn.length > 1e-6 else Vector((0, 0, 1))
        lat = t.cross(nn).normalized()
        a = amp(s) if callable(amp) else amp
        a *= smoothstep(start, start + ramp, s) * (curl_gate(head, pts[i].z, zc) if gates else 1.0)
        # only once it hangs: no coils sticking out while the clump still runs over the head
        hang = smoothstep(0.55, 0.9, -t.z)
        hang_acc = max(hang_acc * 0.97, hang) if i > 1 else hang
        if gates:
            a *= hang_acc
        if pattern == "helix":
            th = phase + 2 * math.pi * s / period
            off = lat * math.cos(th) * a + nn * math.sin(th) * a * depth
        else:  # zigzag crimp, rounded corners
            x = (s / period + phase / (2 * math.pi)) % 1.0
            z = 4 * abs(x - 0.5) - 1  # -1..1 triangle
            z = math.copysign(abs(z) ** 0.8, z)
            off = lat * z * a + nn * (0.5 + 0.5 * z) * a * depth
        p = pts[i] + off
        # clearance: the layer margin, but never more than the centre line itself has (the
        # part lying on / emerging from the shell keeps its own height)
        need = min(head.margin_at(p, margin) + extra, max(head.signed(pts[i])[0], 0.0006))
        p = head.push_out(p, need, head_margin=margin)
        if face_x > 0 and p.y < head.c.y - 0.035 and p.z > head.z_skull - 0.03 and abs(p.x) < face_x:
            p.x = math.copysign(face_x, p.x if abs(p.x) > 1e-5 else 1.0)
        out.append(p)
    return out


def clump_wig(head, b, layers, pattern="helix", amp=(0.009, 0.012), period=(0.03, 0.036), tube_r=0.0055, squash=0.75,
              sides=6, curl_start=0.07, curl_ramp=0.08, z_curl=None, flat_sq=0.35, flat_w=1.6, root_jit=0.06, head_lift=0.006, comb_end=0.9, k_min=0.16, amp_grow=0.0, root_r=0.12, root_len=0.05, stop_back=1.10, stop_front=1.16, stop_var=0.02, front_k=0.2,
              lift=None, n_lines=48, n_samples=26, seed=3, mat=0, shell_uv=0.035, res=0.004, depth=0.55, face_x=0.0,
              lane_back=0.106, lane_front=0.2, spread=0.0, part_gap=0.7, shell_off=None, spt=12, lie=None, part_back=(180, 62), temple_az=52):
    """Centre-part shell + layered curl clumps. layers: [(t_root along the comb line 0 part .. 1
    hairline, extra clearance, clumps per side, radius scale)]. Returns the clump count."""
    rng = np.random.default_rng(seed)
    lift = lift or (lambda t: 0.0055 - 0.004 * smoothstep(0.55, 1.0, t))
    pl = flowkit.part_lines(head, n_lines=n_lines, n_samples=n_samples, part_back=part_back, temple_az=temple_az, gap_deg=part_gap)
    for s in (1, -1):
        ls = [ds for k, ds in pl[s]]
        if s == -1:
            ls = ls[::-1]
        if shell_off is not None:
            flowkit.comb_shell(head, b, ls, lift=lambda t: 0.0, bulge=shell_off, mat=mat, uv_tile=shell_uv)
        else:
            flowkit.comb_shell(head, b, ls, lift=lift, mat=mat, uv_tile=shell_uv)
    L_ = shell_off if shell_off is not None else (lambda q, t: lift(t))
    m0, m1 = head.dir(0, 31), head.dir(*part_back)
    count = 0
    for li, (t_root, extra, n_side, rscale) in enumerate(layers):
        for s in (1, -1):
            for r in range(n_side):
                k = k_min + (1 - k_min) * (r + 0.5 * (li % 2)) / (n_side - 0.5)
                k = min(1.0, k + rng.uniform(-0.02, 0.02))
                m = flowkit.nlerp(m0, m1, k)
                az = (temple_az + (180 - temple_az) * k) * s
                h = head.dir(az, head.hairline(az))
                t_r = min(0.95, max(0.3, t_root + rng.uniform(-root_jit, root_jit)))
                d = flowkit.nlerp(m, h, t_r)
                d2 = flowkit.nlerp(m, h, min(1.0, t_r + 0.08))
                p, nn = head.surf_dir(d)
                root = p + nn * L_(p, t_r) * 0.5
                q, _ = head.surf_dir(d2)
                tangent = (q - p).normalized()
                front = k < front_k
                if front:
                    lane = s * (0.085 + lane_front * k)
                else:
                    lane = s * (0.014 + lane_back * min(1.0, (1 - k) / (1 - front_k)))
                lane = max(-0.13, min(0.13, lane * (1 + spread)))
                stop = (stop_front if front else stop_back) + rng.uniform(-stop_var, stop_var) + 0.012 * li
                lean = None if front else 0.16 + 0.34 * (1 - smoothstep(front_k, 0.55, k))
                r_c = tube_r * rscale * rng.uniform(0.9, 1.1)
                margin = head_lift + r_c * flat_sq * 1.1
                # over the scalp: follow the comb line (lying on the shell) to near the hairline,
                # then hang from there
                t_end = max(t_r + 0.05, comb_end)
                half = r_c * flat_w * flat_sq  # half-thickness of the flat clump on the shell
                on = []
                nst = max(3, int((t_end - t_r) / 0.02))
                dist = 0.0
                prev = None
                for j in range(nst + 1):
                    tt = t_r + (t_end - t_r) * j / nst
                    q0, n0 = head.surf_dir(flowkit.nlerp(m, h, tt))
                    if prev is not None:
                        dist += (q0 - prev).length
                    prev = q0
                    grow = root_r + (1 - root_r) * smoothstep(0.0, root_len, dist)
                    on.append(q0 + n0 * max(0.0008, L_(q0, tt) + half * (2.1 * grow - 1.25) + extra * smoothstep(0.0, 0.06, dist)))
                margin = L_(prev, t_end) + half * 0.85
                tangent = (on[-1] - on[-2]).normalized()
                axis = on[:-1] + flowkit.ribbon_path(head, on[-1], tangent, 0.9, margin, extra, lane, front, lean=lean, wave_amp=0.0, stop_z=stop, step=0.01)
                a_base = rng.uniform(*amp) * (0.85 + 0.15 * rscale)
                a0 = (lambda sv, a=a_base: a * (1 + amp_grow * smoothstep(0.1, 0.45, sv))) if amp_grow else a_base
                per = rng.uniform(*period)
                ph = rng.uniform(0, 2 * math.pi)
                cs = curl_start * rng.uniform(0.85, 1.15)
                zc = head.c.z if z_curl is None else z_curl
                pts = shape(head, axis, pattern, a0, per, cs, curl_ramp, ph, margin, extra, res=min(res, per / spt), depth=depth, face_x=face_x, z_curl=zc)
                n = len(pts)
                arcs = [0.0]
                for i in range(n - 1):
                    arcs.append(arcs[-1] + (pts[i + 1] - pts[i]).length)
                L = max(arcs[-1], 1e-4)
                sn = np.array(arcs) / L
                # flat, wide ribbon while lying on the head (reads as combed hair, not cords),
                # rounding out as the curl forms
                fl = np.array([1 - curl_gate(head, q.z, zc + 0.01, 0.05) for q in pts])
                tin = min(0.4, root_len / L)

                def radius(sv, r_c=r_c, tin=tin, sn=sn, fl=fl):
                    f = float(np.interp(sv, sn, fl))
                    rr = r_c * (1 + (flat_w - 1) * f) * (root_r + (1 - root_r) * smoothstep(0.0, tin, sv))
                    return rr * (1 - 0.6 * smoothstep(0.85, 1.0, sv))

                def sqf(sv, sn=sn, fl=fl):
                    f = float(np.interp(sv, sn, fl))
                    return squash + (flat_sq - squash) * f

                if os.environ.get("CURLDEBUG") and count < 200:
                    sd = [round(head.signed(q)[0] * 1000, 1) for q in pts[:6]]
                    hairkit.log("CLUMP", count, "k %.2f t %.2f" % (k, t_r), "root", tuple(round(x, 3) for x in pts[0]), "sd mm", sd, "L %.3f" % L)
                frames = smooth_frames(head, pts, win=3)
                b.tube(pts, radius, sides=sides, mat=mat, frames=frames, squash=sqf, tip_curve=lambda i, n=n: i / (n - 1), root=root)
                count += 1
    if lie:
        count += lie_clumps(head, b, L_, m0, m1, temple_az, rng, mat=mat, **lie)
    hairkit.log("curl clumps", count)
    return count


def lie_clumps(head, b, L_, m0, m1, temple_az, rng, rows=((0.04, 0.4), (0.24, 0.56)), n_side=14, amp=0.0035, period=0.014,
               tube_r=0.004, squash=0.45, sides=4, depth=0.3, spt=9, k_min=0.0, mat=0, root_r=0.15, end_len=0.025, pattern="helix"):
    """Curl definition on top: short coiled clumps lying flat on the shell along the comb lines
    (from near the part towards the sides), emerging from under it and tucking back in at
    both ends, so the dome reads as curls without any lift or lumps."""
    count = 0
    for ri, row in enumerate(rows):
        t0, t1 = row[0], row[1]
        k_hi = row[2] if len(row) > 2 else 1.0
        ns = max(2, int(round(n_side * (k_hi - k_min))))
        for s in (1, -1):
            for r in range(ns):
                k = k_min + (k_hi - k_min) * (r + 0.5 * (ri % 2)) / (ns - 0.5)
                k = min(1.0, max(0.0, k + rng.uniform(-0.015, 0.015)))
                m = flowkit.nlerp(m0, m1, k)
                az = (temple_az + (180 - temple_az) * k) * s
                h = head.dir(az, head.hairline(az))
                a0, a1 = t0 + rng.uniform(-0.03, 0.03), t1 + rng.uniform(-0.04, 0.04)
                r_c = tube_r * rng.uniform(0.9, 1.1)
                half = r_c * squash
                base = []
                for j in range(13):
                    tt = a0 + (a1 - a0) * j / 12
                    q0, n0 = head.surf_dir(flowkit.nlerp(m, h, tt))
                    base.append((q0, n0, tt))
                Lb = sum((base[j + 1][0] - base[j][0]).length for j in range(12))
                on = []
                dist = 0.0
                for j, (q0, n0, tt) in enumerate(base):
                    if j:
                        dist += (q0 - base[j - 1][0]).length
                    g = min(smoothstep(0.0, end_len, dist), smoothstep(Lb, Lb - end_len, dist))
                    on.append(q0 + n0 * max(0.0008, L_(q0, tt) + half * (2.1 * (root_r + (1 - root_r) * g) - 1.25)))
                per = period * rng.uniform(0.85, 1.15)
                pts = shape(head, on, pattern, amp * rng.uniform(0.85, 1.15), per, 0.0, end_len, rng.uniform(0, 6.28), 0.001, 0.0,
                            res=per / spt, depth=depth, gates=False)
                n = len(pts)
                arcs = [0.0]
                for i in range(n - 1):
                    arcs.append(arcs[-1] + (pts[i + 1] - pts[i]).length)
                Lt = max(arcs[-1], 1e-4)
                e = min(0.45, end_len / Lt)

                def radius(sv, r_c=r_c, e=e):
                    return r_c * (root_r + (1 - root_r) * min(smoothstep(0.0, e, sv), smoothstep(1.0, 1.0 - e, sv)))

                frames = smooth_frames(head, pts, win=3)
                b.tube(pts, radius, sides=sides, mat=mat, frames=frames, squash=squash, tip_curve=lambda i: 0.1, root=pts[0])
                count += 1
    return count

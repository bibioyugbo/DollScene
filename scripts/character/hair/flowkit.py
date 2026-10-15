"""
Combed / flowing hair helpers (bun, wavy_wig, leave_out).

  * comb_shell: a thin opaque shell over the scalp made of comb lines, each running over the skin
    from a start direction to an end direction (e.g. hairline -> bun, or parting -> hairline).
    U across the lines (metres / uv_tile), V along them; tex_strands streaks follow the lines.
  * part_lines: the comb lines of a centre part: from the parting (forehead .. crown) down to the
    hairline (temple .. nape) on each side; returns per side a list of (k, [directions]).
  * ribbon: a flattened wavy clump draped from a root on the shell, with a per-layer clearance
    (outer layers stay outside inner ones, also over the clothing below the neck), a lateral
    wave, lane-steered gravity (no crossing, clear of the lowered arms).
"""

import math

from mathutils import Vector

import hairkit
from hairkit import smoothstep


def nlerp(a, b, t):
    return (a * (1 - t) + b * t).normalized()


def comb_shell(head, b, lines, lift, mat=0, uv_tile=0.05, tip=0.0, wrap=False, uv_map=None, bulge=None):
    """lines: list of direction lists (all the same length, adjacent lines next to each other).
    lift(t) (t 0 at the line start .. 1 at the end) -> metres off the skin.
    bulge(p, t) optional extra outward offset (lumps). uv_map(u, v) optional remap (atlas).
    Returns the vertex rows (per line)."""
    cols = []
    for ds in lines:
        n = len(ds)
        col = []
        for j, d in enumerate(ds):
            t = j / (n - 1)
            p, nn = head.surf_dir(d)
            off = lift(t) + (bulge(p, t) if bulge else 0.0)
            q = p + nn * off
            q = head.push_out(q, max(off * 0.8, 0.0012), head_margin=max(off * 0.8, 0.0012))
            col.append(q)
        cols.append(col)
    nl = len(cols)
    n = len(cols[0])
    # V by arc length along each line, U by the distance between neighbouring lines (mid row)
    vs = []
    for col in cols:
        s = [0.0]
        for p0, p1 in zip(col, col[1:]):
            s.append(s[-1] + (p1 - p0).length)
        vs.append(s)
    us = [0.0]
    for i in range(1, nl):
        us.append(us[-1] + (cols[i][n // 2] - cols[i - 1][n // 2]).length)
    rows, uvs = [], []
    for j in range(n):
        row, uvr = [], []
        for i in range(nl):
            row.append(b.vert(cols[i][j], tip))
            u, v = us[i] / uv_tile, vs[i][j] / uv_tile
            uvr.append(uv_map(u, v) if uv_map else (u, v))
        rows.append(row)
        uvs.append(uvr)
    wrap_u = None
    if wrap:
        wrap_u = (us[-1] + (cols[0][n // 2] - cols[-1][n // 2]).length) / uv_tile
    b.grid(rows, uvs, mat=mat, wrap_u=wrap_u)
    return rows


def part_lines(head, n_lines=64, n_samples=30, part_front=(0, 31), part_back=(180, 62), temple_az=52, gap_deg=0.7):
    """Centre part. Line k (0 front .. 1 back) on side s runs from the parting point M(k) (a thin
    gap off the midline, closing at the crown) to the hairline at az = temple_az .. 180."""
    m0, m1 = head.dir(*part_front), head.dir(*part_back)
    out = {}
    for s in (1, -1):
        lines = []
        for i in range(n_lines):
            k = i / (n_lines - 1)
            m = nlerp(m0, m1, k)
            g = math.radians(gap_deg) * (1 - smoothstep(0.75, 1.0, k))
            m = (m + Vector((s * g, 0, 0))).normalized()
            az = (temple_az + (180 - temple_az) * k) * s
            h = head.dir(az, head.hairline(az))
            ds = [nlerp(m, h, j / (n_samples - 1)) for j in range(n_samples)]
            lines.append((k, ds))
        out[s] = lines
    return out


def drape_layer(head, root, out_dir, length, head_margin, extra, gravity, step=0.016, stiff=0.9, bend=0.15, stop_z=None, iters=3):
    """Like Head.drape, but the clearance is margin_at(p, head_margin) + extra everywhere, so
    outer layers stay outside inner ones on the clothing too."""
    pts = [Vector(root)]
    d = Vector(out_dir).normalized()
    n = max(2, int(length / step))
    for i in range(n):
        t = i / n
        w = stiff * math.exp(-t / max(bend, 1e-3))
        g = gravity(pts[-1])
        d = (d * w + g * (1 - w)).normalized()
        p = pts[-1] + d * step
        ex = extra * smoothstep(0.0, 0.12, i * step)  # the layer offset eases in: roots stay on the shell
        for _ in range(iters):
            p = head.push_out(p, head.margin_at(p, head_margin) + ex, head_margin=head_margin)
        seg = p - pts[-1]
        if seg.length > 1e-6:
            p = pts[-1] + seg.normalized() * step
            d = seg.normalized()
        pts.append(p)
        if stop_z is not None and p.z < stop_z:
            break
    return pts


def outward(head, p):
    _s, q, n = head.signed(p)
    return n


def ribbon_path(head, root, out_dir, length, layer_margin, extra, lane_x, front, wave_amp=0.012, wavelength=0.12, phase=0.0, stop_z=None, wave_start=0.08, step=0.013, depth=0.45, lean=None):
    g = head.lane_gravity(lane_x, front, lean=lean)
    pts = drape_layer(head, root, out_dir, length, layer_margin, extra, g, step=step, stop_z=stop_z)
    if wave_amp <= 0:
        return pts
    out = [pts[0]]
    s = 0.0
    for i in range(1, len(pts)):
        s += (pts[i] - pts[i - 1]).length
        t = (pts[min(i + 1, len(pts) - 1)] - pts[i - 1]).normalized()
        nrm = outward(head, pts[i])
        lat = t.cross(nrm).normalized()
        a = wave_amp * smoothstep(wave_start, wave_start + 0.12, s)
        w = math.sin(2 * math.pi * s / wavelength + phase)
        # S-waves mostly in the plane of the hair, partly outwards (never into the body)
        p = pts[i] + lat * a * w + nrm * a * depth * (0.5 + 0.5 * math.cos(2 * math.pi * s / wavelength + phase))
        p = head.push_out(p, head.margin_at(p, layer_margin) + extra * 0.7, head_margin=layer_margin)
        out.append(p)
    return out


def ribbon(b, head, pts, width, squash=0.28, sides=4, mat=0, root=None, taper_in=0.08, uv_u=None):
    """Flattened clump along pts (flat side facing out of the body); thin at the root and tip."""
    raw = [outward(head, p) for p in pts]
    n = len(pts)
    frames = []
    for i in range(n):  # smoothed, so the ribbon never flips edge-on
        acc = Vector()
        for j in range(max(0, i - 4), min(n, i + 5)):
            acc += raw[j]
        frames.append(acc.normalized())

    def radius(s):
        r = width * (0.35 + 0.65 * smoothstep(0.0, taper_in, s))
        return r * (1 - 0.7 * smoothstep(0.82, 1.0, s))

    rings = b.tube(pts, radius, sides=sides, mat=mat, frames=frames, squash=squash, tip_curve=lambda i: i / (n - 1), root=root)
    return rings


# ----------------------------------------------------------------------------- wig body

LAYERS = (  # (root position along the comb line 0 part .. 1 hairline, extra clearance, ribbons per side, half-width)
    (0.36, 0.012, 9, 0.022),
    (0.60, 0.006, 9, 0.021),
    (0.84, 0.0, 9, 0.020),
)


def wig(head, b, wave_amp=0.013, wavelength=0.12, stop_back=1.11, stop_front=1.17, n_lines=48, n_samples=26, mat_shell=0, mat_ribbon=0, skip_line=None, seed=3, front_k=0.2, lift=None, shell_uv=None, bulge=None, skip_ribbon=None):
    """Centre-part wig: comb shell (part -> hairline) + three layers of wavy ribbons rooted on it,
    outer layers from higher up. Front ribbons (k < front_k) fall in front of the shoulders.
    skip_line(k) -> True leaves that line to the caller (e.g. leave-out)."""
    import numpy as np

    rng = np.random.default_rng(seed)
    lift = lift or (lambda t: 0.0065 - 0.0045 * smoothstep(0.55, 1.0, t))
    pl = part_lines(head, n_lines=n_lines, n_samples=n_samples)
    for s in (1, -1):
        ls = [ds for k, ds in pl[s] if not (skip_line and skip_line(k))]
        if s == -1:
            ls = ls[::-1]
        if len(ls) > 1:
            comb_shell(head, b, ls, lift=lift, mat=mat_shell, uv_tile=0.035, uv_map=shell_uv, bulge=bulge)
    count = 0
    for li, (t_root, extra, n_side, width) in enumerate(LAYERS):
        for s in (1, -1):
            for r in range(n_side):
                k = 0.1 + 0.9 * (r + 0.5 * (li % 2)) / (n_side - 0.5)
                k = min(1.0, k + rng.uniform(-0.02, 0.02))
                if skip_ribbon and skip_ribbon(k, li):
                    rng.uniform(0, 1, 4)  # keep the random stream stable
                    continue
                m0, m1 = head.dir(0, 31), head.dir(180, 62)
                m = nlerp(m0, m1, k)
                az = (52 + 128 * k) * s
                h = head.dir(az, head.hairline(az))
                d = nlerp(m, h, t_root)
                d2 = nlerp(m, h, min(1.0, t_root + 0.08))
                p, nn = head.surf_dir(d)
                root = p + nn * lift(t_root)
                q, _ = head.surf_dir(d2)
                tangent = (q - p).normalized()
                front = k < front_k
                if front:
                    lane = s * (0.08 + 0.2 * k)
                else:
                    lane = s * (0.014 + 0.106 * min(1.0, (1 - k) / (1 - front_k)))
                stop = (stop_front if front else stop_back) + rng.uniform(-0.02, 0.02) + 0.015 * li
                lean = None if front else 0.16 + 0.34 * (1 - smoothstep(front_k, 0.55, k))  # side pieces go behind the shoulder
                pts = ribbon_path(head, root, tangent, 0.8, 0.0075, extra, lane, front, lean=lean, wave_amp=wave_amp, wavelength=wavelength, phase=li * 0.6 + rng.uniform(-0.25, 0.25), stop_z=stop)
                ribbon(b, head, pts, width * rng.uniform(0.9, 1.1), squash=0.2, mat=mat_ribbon, root=root)
                count += 1
    hairkit.log("wig ribbons", count)

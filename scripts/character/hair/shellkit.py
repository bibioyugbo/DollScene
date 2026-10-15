"""
Closed hair volumes around the skull (afros, bonnet): one watertight-looking surface per style.

Profile of every column (one per azimuth), seen in the plane of that azimuth:
  1. starts on the skin at the hairline (2 mm off it, tucked: _tip 0),
  2. runs DOWN hugging the skin/ears for `drop(az)` degrees (the part of the volume that hangs
     below the hairline at the sides and back - hidden under the outer surface),
  3. rolls out and climbs the OUTER surface up to the crown pole.
The outer radius grows from the skin over `ramp` degrees above the lowest point, so the edge
sits on the head (no brim, no floating) and swells into the silhouette R(direction).
Nothing is alpha-tested: the volume is opaque and closed against the head.
"""

import math

from mathutils import Vector, noise

import hairkit
from hairkit import smoothstep


def ellipsoid_radius(c, oc, orad, d):
    """Distance from c along unit d to the ellipsoid (centre oc, radii orad)."""
    o = c - oc
    a = sum((d[i] / orad[i]) ** 2 for i in range(3))
    b = 2 * sum(o[i] * d[i] / orad[i] ** 2 for i in range(3))
    cc = sum((o[i] / orad[i]) ** 2 for i in range(3)) - 1
    disc = b * b - 4 * a * cc
    return (-b + math.sqrt(max(disc, 0))) / (2 * a)


def lumps(p, octaves):
    """Signed 3D noise: octaves = [(scale_m, amplitude_m)]."""
    out = 0.0
    for i, (s, a) in enumerate(octaves):
        out += noise.noise(p / s + Vector((i * 3.1, i * 1.7, i * 0.4))) * a
    return out


def cap_volume(head, b, outer, drop, ramp=30.0, hug=None, min_thick=0.006, inner_lift=0.0025, cols=144, rows_out=56, rows_in=6, mat=0, uv_tile=0.05, ear_margin=0.004, hairline=None, tip_mode="depth"):
    """Build the volume into Builder b.
    outer(az, el, d, rs) -> outer radius from the skull centre (before the edge ramp).
    drop(az) -> degrees the volume extends below the hairline at that azimuth (0 at the face).
    ramp: degrees (or fn of az) over which the volume swells from its edge.
    hug(az) -> 0 rounded underside (ease-out) .. 1 hug the head first (S-curve; nape).
    uv_tile: metres per texture repeat (square texels)."""
    c = head.c
    hl = hairline or head.hairline
    columns = []
    for i in range(cols):
        az = -180 + 360 * i / cols
        eh = hl(az)
        el_low = eh - drop(az)
        rmp = ramp(az) if callable(ramp) else ramp
        hg = hug(az) if hug else 0.0  # 0: rounded underside (ease-out) .. 1: hugs the head, then swells (S-curve)
        prof = []  # (point, tip)
        # 2. inner sheet: from the hairline down to el_low, hugging the skin
        for j in range(rows_in):
            t = j / max(rows_in - 1, 1)
            el = eh + (el_low - eh) * t
            p, n = head.surf(az, el)
            p = p + n * inner_lift
            p = head.push_out(p, inner_lift + ear_margin * t, head_margin=inner_lift)
            prof.append((p, 0.0))
        # 3. outer surface from el_low to the crown
        for j in range(1, rows_out + 1):
            t = j / rows_out
            el = el_low + (89.6 - el_low) * t
            d = head.dir(az, el)
            p_s, _n = head.surf(az, el)
            rs = (p_s - c).length
            ro = max(outer(az, el, d, rs), rs + min_thick)
            u = min(1.0, max(0.0, (el - el_low) / rmp))
            g = (1 - (1 - u) ** 1.8) * (1 - hg) + (u * u * (3 - 2 * u)) * hg  # ease-out: rounded underside
            r = rs + min_thick * 0.5 + (ro - rs - min_thick * 0.5) * g
            p = c + d * r
            p = head.push_out(p, min_thick, head_margin=min_thick)
            tip = 1.0 if tip_mode == "outer" else min(1.0, (r - rs) / max(ro - rs, 1e-3))
            prof.append((p, tip))
        columns.append(prof)
    nrow = len(columns[0])
    # pole
    pole_p = Vector((0, 0, 0))
    for prof in columns:
        pole_p += prof[-1][0]
    pole_p /= cols
    pole = b.vert(pole_p, 1.0)
    rows = []
    uvs = []
    # arc length per column for V
    arcs = []
    for prof in columns:
        s = [0.0]
        for (p0, _), (p1, _) in zip(prof, prof[1:]):
            s.append(s[-1] + (p1 - p0).length)
        s.append(s[-1] + (pole_p - prof[-1][0]).length)
        arcs.append(s)
    # U: arc around at the widest row, in metres
    ring = [columns[i][nrow // 2][0] for i in range(cols)]
    around = sum((ring[(i + 1) % cols] - ring[i]).length for i in range(cols))
    du = around / cols / uv_tile
    for j in range(nrow + 1):
        row = []
        uvr = []
        for i in range(cols):
            if j < nrow:
                p, tip = columns[i][j]
                row.append(b.vert(p, tip))
            else:
                row.append(pole)
            uvr.append((i * du, arcs[i][j] / uv_tile))
        rows.append(row)
        uvs.append(uvr)
    b.grid(rows, uvs, mat=mat, wrap_u=du * cols)
    return rows

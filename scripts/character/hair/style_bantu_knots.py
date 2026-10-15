"""
Bantu knots: the scalp is parted into sections (nearest knot centre, clean ~3.5 mm parts between
them, the outer sections reach the hairline); in each section the hair is pulled flat towards the
centre (a polar pad, thicker towards the knot) and twisted into a coiled knot (a two-strand
twisted rope wound ~2.6 turns, narrowing as it stacks up).
Every knot + its section pad is one strand (_strand), _section from the knot centre; _tip 0 at
the section edge .. 0.3 at the knot base .. 1 at the tucked end.
Material: "Hair" (tinted by the app).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import braidkit  # noqa: E402
import hairkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Quaternion  # noqa: E402

STYLE = "bantu_knots"
CENTRES = [
    (0, 52), (42, 38), (-42, 38),  # front
    (28, 74), (-28, 74),  # crown
    (86, 26), (-86, 26),  # sides
    (180, 66), (138, 46), (-138, 46),  # back top
    (112, 4), (-112, 4), (160, 0), (-160, 0),  # back low / nape
]
GAP = 2.2  # degrees: part width
NTH, NR = 36, 6

head = hairkit.open_base()
c = head.c
dirs = [head.dir(a, e) for a, e in CENTRES]


def owner(d):
    angs = sorted((math.degrees(d.angle(k)), i) for i, k in enumerate(dirs))
    return angs[0][1], angs[1][0] - angs[0][0]


def in_section(d, i):
    o, m = owner(d)
    az, el = head.angles(c + d)
    return o == i and m >= GAP and el >= head.hairline(az) + 0.3


gray, height = hairkit.tex_twist(512, seed=61)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.6)]
b = hairkit.Builder(head)

for i, (az, el) in enumerate(CENTRES):
    p0, n0, e_az, e_el = braidkit.tangent_frame(head, az, el)
    d0 = dirs[i]
    b.begin(p0)
    # --- polar pad: march out along each direction until the part / hairline
    rings = [[None] * NTH for _ in range(NR + 1)]
    for t in range(NTH):
        th = 2 * math.pi * t / NTH
        axis = (d0.cross(e_az * math.cos(th) + e_el * math.sin(th))).normalized()
        rho = 0.0
        while rho < 60:
            d = Quaternion(axis, math.radians(rho + 0.5)) @ d0
            if not in_section(d, i):
                break
            rho += 0.5
        for k in range(NR + 1):
            f = k / NR  # 0 centre .. 1 edge
            d = Quaternion(axis, math.radians(rho * f)) @ d0
            s, n = head.surf_dir(d)
            lift = 0.0015 + 0.0045 * (1 - smoothstep(0.0, 1.0, f)) ** 1.5
            rings[k][t] = b._v(s + n * lift, 0.3 * (1 - f))
    ctr = rings[0][0]
    bm = b.bm
    for k in range(NR):
        for t in range(NTH):
            t2 = (t + 1) % NTH
            if k == 0:
                q = (ctr, rings[1][t2], rings[1][t]) if False else None
                vs = [rings[0][0], rings[1][t], rings[1][t2]]
                uvs = [((t + 0.5) / NTH * 6, 1.0), (t / NTH * 6, 1 - 1 / NR), ((t + 1) / NTH * 6, 1 - 1 / NR)]
            else:
                vs = [rings[k][t], rings[k + 1][t], rings[k + 1][t2], rings[k][t2]]
                uvs = [(t / NTH * 6, 1 - k / NR), (t / NTH * 6, 1 - (k + 1) / NR), ((t + 1) / NTH * 6, 1 - (k + 1) / NR), ((t + 1) / NTH * 6, 1 - k / NR)]
            f = bm.faces.new(vs)
            f.material_index = 0
            f.smooth = True
            for loop, uv in zip(f.loops, uvs):
                loop[b.uv].uv = uv
    # extra centre ring verts at k=0 are unused duplicates: rings[0][t>0] -> remove later
    for t in range(1, NTH):
        bm.verts.remove(rings[0][t])
    # --- the knot: a twisted rope coiled up from the pad
    turns, R0, R1, H = 2.6, 0.0155, 0.0035, 0.022
    base = p0 + n0 * 0.004
    pts = []
    N = 70
    for j in range(N):
        tt = j / (N - 1)
        ph = 2 * math.pi * turns * tt + (i * 1.3)
        r = R0 * (1 - tt) + R1 * tt
        h = 0.003 + H * tt ** 0.85
        pts.append(base + (e_az * math.cos(ph) + e_el * math.sin(ph)) * r + n0 * h)
    b.tube(pts, lambda s: 0.0066 * (1 - 0.35 * s), sides=8, mat=0, lobes=2, lobe_amp=0.25, lobe_twist=2 * math.pi / 0.016, tip_from=0.3, tip_to=1.0, new_strand=False)

obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

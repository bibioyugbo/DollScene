"""
Two afro puffs: a centre part, each half combed up into a dense, rounded coily puff high on that
side of the head. Shell: comb lines from the hairline converge under each puff (two separate
shells, so the centre part shows as a clean line). Puffs: closed lumpy spheres with the afro
coil texture, opaque. Material "Hair" (tinted by the app).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402
import shellkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "afro_puffs"
PUFFS = {1: (68, 60), -1: (-68, 60)}  # side -> (az, el) of each puff
SAMPLES = 30
COLS = 84

head = hairkit.open_base()
gray, height = hairkit.tex_coil(1024, seed=29, n=6400, dark=True)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=2.0)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.012, 0.011, 0.012), roughness=0.85)
b = hairkit.Builder(head)

for side, (paz, pel) in PUFFS.items():
    target = head.dir(paz, pel)
    lines = []
    # sources: a closed loop round this half of the scalp, so the whole half is covered:
    # the hairline from the front centre round the side to the nape, then back up the centre
    # part over the crown to the front (the part stays a thin line between the halves)
    srcs = []
    for i in range(COLS):
        az = side * (1.5 + 177 * i / (COLS - 1))
        srcs.append(head.dir(az, head.hairline(az)))
    hb, hf = head.hairline(180), head.hairline(0)
    for i in range(1, 25):
        el = hb + (89.0 - hb) * i / 24
        srcs.append(head.dir(side * 178.5, el))
    for i in range(1, 25):
        el = 89.0 - (89.0 - hf) * i / 24
        srcs.append(head.dir(side * 1.5, el))
    for h in srcs:
        lines.append([flowkit.nlerp(h, target, 0.9 * j / (SAMPLES - 1)) for j in range(SAMPLES)])
    if side < 0:
        lines.reverse()
    flowkit.comb_shell(head, b, lines, wrap=True, lift=lambda t: 0.0016 + 0.0035 * smoothstep(0.0, 0.4, t), uv_tile=0.03)

    # the puff: a lumpy, slightly squashed sphere sitting on the gathered base
    base, n = head.surf_dir(target)
    n = n.normalized()
    R = 0.062
    centre = base + n * (R * 0.78)
    up = Vector((0, 0, 1))
    rows, uvs = [], []
    RINGS, SEGS = 26, 48
    for j in range(RINGS + 1):
        phi = math.pi * j / RINGS
        row, uvr = [], []
        for k in range(SEGS):
            th = 2 * math.pi * k / SEGS
            d = Vector((math.sin(phi) * math.cos(th), math.sin(phi) * math.sin(th), math.cos(phi)))
            p0 = centre + d * R
            r = R * (1 + 0.08 * d.z) + shellkit.lumps(p0, [(0.03, 0.006), (0.012, 0.0025)])
            p = centre + Vector((d.x, d.y, d.z * 0.9)) * r
            # never inside the head
            p = head.push_out(p, 0.004, head_margin=0.004)
            row.append(b.vert(p, tip=min(1.0, 0.3 + 0.7 * (1 - abs(d.dot(-n))))))
            uvr.append((k * 6.0 / SEGS, j * 3.0 / RINGS))
        rows.append(row)
        uvs.append(uvr)
    b.grid(rows, uvs, mat=0, wrap_u=6.0)
    _ = up

obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

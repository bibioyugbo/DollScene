"""
Two braided ponytails: a centre part, each half slicked down to a low ponytail behind the ear,
then braided (three-lobed tube) to just past the shoulders, with a hair tie. Material "Hair"
(tinted by the app) plus "Accent" for the ties (keeps its colour).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "two_braids"
TIES = {1: (128, 22), -1: (-128, 22)}
SAMPLES = 30
COLS = 84

head = hairkit.open_base()
gray, height = hairkit.tex_braid(512, seed=19)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=2.0)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.016, 0.014), roughness=0.6)
tie = hairkit.accent_material("Accent", color=(0.85, 0.2, 0.35), metallic=0.0, roughness=0.5)
b = hairkit.Builder(head)

for side, (taz, tel) in TIES.items():
    target = head.dir(taz, tel)
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
        lines.append([flowkit.nlerp(h, target, 0.92 * j / (SAMPLES - 1)) for j in range(SAMPLES)])
    if side < 0:
        lines.reverse()
    flowkit.comb_shell(head, b, lines, wrap=True, lift=lambda t: 0.0015 + 0.003 * smoothstep(0.0, 0.5, t), uv_tile=0.03)

    # the braid: from the tie, out a little, then down over the shoulder blade
    root, n = head.surf_dir(target)
    start = root + n.normalized() * 0.012
    out = (n.normalized() * 0.6 + Vector((side * 0.25, 0.25, -0.75))).normalized()
    pts = head.drape(start, out, 0.42, step=0.012, margin=0.012, stiff=0.88, bend=0.12, gravity=Vector((0, 0.15, -1)))
    pts = [root] + pts
    n_p = len(pts)
    b.tube(
        pts,
        lambda s: 0.0125 * (1 - 0.55 * smoothstep(0.82, 1.0, s)) * (0.85 + 0.15 * smoothstep(0, 0.06, s)),
        sides=9,
        lobes=3,
        lobe_amp=0.2,
        lobe_twist=2 * math.pi / 0.028,
        tip_curve=lambda i: i / max(1, n_p - 1),
        root=root,
    )
    b.sphere(start + out * 0.004, 0.0135, segs=12, rings=6, mat=1, tip=0.0, scale=(1, 1, 0.55), axis=out)

obj = b.to_object(f"Hair_{STYLE}", [mat, tie])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

"""
Sleek high bun: hair slicked back from a natural hairline all round into a high bun on the crown.

  * Shell: 168 comb lines, each from the hairline (1.5 mm off the skin, so the edge sits flat on
    it) over the scalp towards the bun base, thickening to ~4.5 mm; they stop under the bun, so
    the comb lines visibly converge into it. Streak texture runs along the lines.
  * Bun: a twisted rope (two-lobed cross-section) coiled 2.6 turns into a dome on the crown.
_tip: 0 on the shell, 0.3 .. 1 along the bun rope (the rope end is the hair ends).
Materials: "Hair" only.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "bun"
BUN_DIR = (180, 70)  # high on the crown, a little back
COLS = 168
SAMPLES = 34

head = hairkit.open_base()
gray, height = hairkit.tex_strands(1024, seed=21, clumps=30)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=1.4)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.012), roughness=0.45)
b = hairkit.Builder(head)

bun_d = head.dir(*BUN_DIR)
lines = []
for i in range(COLS):
    az = -180 + 360 * i / COLS
    h = head.dir(az, head.hairline(az))
    lines.append([flowkit.nlerp(h, bun_d, 0.88 * j / (SAMPLES - 1)) for j in range(SAMPLES)])
flowkit.comb_shell(head, b, lines, lift=lambda t: 0.0015 + 0.003 * smoothstep(0.0, 0.3, t), uv_tile=0.032, wrap=True)

# -- bun rope
base, n = head.surf_dir(bun_d)
a = n.normalized()
e1 = a.cross(Vector((1, 0, 0))).normalized()
e2 = a.cross(e1).normalized()
turns = 2.6
pts = []
N = 150
for k in range(N + 1):
    t = k / N
    th = 2 * math.pi * turns * t
    R = 0.031 - 0.022 * t ** 0.9
    hgt = 0.011 + 0.034 * t ** 0.75
    pts.append(base + a * hgt + (e1 * math.cos(th) + e2 * math.sin(th)) * R)
n_r = len(pts)
b.tube(
    pts,
    lambda s: 0.0125 * (1 - 0.45 * smoothstep(0.85, 1.0, s)) * (0.8 + 0.2 * smoothstep(0, 0.05, s)),
    sides=10,
    lobes=2,
    lobe_amp=0.16,
    lobe_twist=2 * math.pi / 0.03,
    tip_curve=lambda i: 0.3 + 0.7 * i / (n_r - 1),
    root=base,
)

obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

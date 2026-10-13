"""
Natural curls: shoulder-length curly volume (volkit.hanging_volume) with curl-clump displacement,
plus spiral ringlets around the hem and outline so the silhouette reads curly. Opaque, closed.
Materials: "Hair" (one coil/curl texture, tinted by the app).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
import shellkit  # noqa: E402
import volkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "curls"
rng = np.random.default_rng(23)
head = hairkit.open_base()

gray, height = hairkit.tex_coil(1024, seed=31, n=2600, dark=False)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=2.0)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.03, 0.02, 0.016), tip_preview=(0.05, 0.032, 0.022), roughness=0.8)


def thick_top(az, el):
    a = abs(((az + 180) % 360) - 180)
    return 0.026 + 0.012 * smoothstep(20, 100, a) + 0.006 * smoothstep(40, 80, el)


def hem_z(az):
    a = abs(((az + 180) % 360) - 180)
    # sides end resting just above the shoulders, the back falls a little lower
    rag = 0.008 * math.sin(math.radians(az) * 7 + 1.3) + 0.006 * math.sin(math.radians(az) * 13 + 0.4)
    return 1.395 - 0.09 * smoothstep(110, 165, a) + rag


def disp(p, i, s):
    return shellkit.lumps(p, [(0.032, 0.011), (0.014, 0.005)]) + 0.004


b = hairkit.Builder(head)
rows, hem = volkit.hanging_volume(head, b, thick_top, 0.026, hem_z, disp=disp, cols=96, n_cap=30, n_hang=18, n_inner=10, spread=0.18, max_x=0.16, uv_tile=0.09)
# ringlets: around the hem (sides/back) and a few at the face-framing edge
for k, (o, hw, az) in enumerate(hem):
    if hw < 0.35 or k % 2:
        continue
    root = o + Vector((0, 0, 0.035)) - volkit.outward(head, o) * 0.006
    L = rng.uniform(0.045, 0.085) * (0.6 + 0.4 * hw)
    volkit.ringlet(head, b, root, L, coil_r=rng.uniform(0.006, 0.009), pitch=rng.uniform(0.014, 0.019), phase=rng.uniform(0, 6.28), lean=volkit.outward(head, o) * 0.12)
obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

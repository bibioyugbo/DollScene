"""Goddess (boho) braids: long knotless braids with loose curly strands woven through them and
curly ends (refs: boho knotless, curly ends). Center part. Braids and curls share one material
("Hair", tinted by the app: 613 blonde for Bibi)."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import braidkit  # noqa: E402
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
import lockit  # noqa: E402
import volkit  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "goddess_braids"
SPACING = 8.6
R = 0.0037
rng = np.random.default_rng(61)

head = hairkit.open_base()
gray, height = hairkit.tex_braid(512, seed=37, tilt=32)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=3.6)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.55, 0.45, 0.3), roughness=0.6)]
b = hairkit.Builder(head)
# a thin layer of new growth over the scalp, so the parts between braids read as hair, not skin
lockit.scalp_layer(head, b, lift=0.0016, cols=96, rows=20, mat=0, uv_tile=0.03)
# center part: no roots within a degree of the midline at the front
roots = [(az, el) for az, el in hairkit.scalp_roots(head, spacing_deg=SPACING, el_min_off=1.5, jitter=0.08, seed=12, el_top=87.0) if not (abs(az) < 2.2 and el < 80)]
hairkit.log("roots", len(roots))
strands = braidkit.hanging_strands(head, b, roots, R, stop_back=0.96, stop_front=1.0, sides=5, lobes=0, pitch=0.01,
                                   step=0.026, root_style="flat", flat_len=0.045, flat_r0=0.8, flat_sq=0.35, taper=0.12, taper_to=0.7, seed=19,
                                   layer_per_deg=0.009 / 60, layer_cap=0.014)


def coil_along(pts, start, coil_r, pitch, tube_r, phase):
    """A thin curly strand spiralling loosely around a braid from `start` (0..1 of its length)."""
    seg = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
    L = sum(seg)
    out = []
    s0 = start * L
    acc = 0.0
    for i in range(len(pts) - 1):
        for k in range(4):
            u = acc + seg[i] * k / 4
            if u < s0:
                continue
            p = pts[i].lerp(pts[i + 1], k / 4)
            t = (pts[i + 1] - pts[i]).normalized()
            e1 = t.cross(Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))).normalized()
            e2 = t.cross(e1).normalized()
            th = phase + 2 * math.pi * (u - s0) / pitch
            rr = coil_r * min(1.0, (u - s0) / 0.03)
            q = p + (e1 * math.cos(th) + e2 * math.sin(th)) * (R + rr)
            out.append(head.push_out(q, head.margin_at(q, 0.004)))
        acc += seg[i]
    if len(out) > 3:
        b.tube(out, lambda s: tube_r, sides=4, mat=0, tip_from=0.0, tip_to=1.0, root=out[0])


for k, (sid, pts) in enumerate(strands):
    if len(pts) < 4:
        continue
    end = pts[-1]
    prev = pts[-2]
    # curly end: the braid opens into a loose ringlet
    volkit.ringlet(head, b, end, rng.uniform(0.07, 0.12), coil_r=rng.uniform(0.007, 0.011), pitch=rng.uniform(0.016, 0.022), tube_r=0.0034, phase=rng.uniform(0, 6.28), lean=(end - prev).normalized() * 0.15)
    # loose curly pieces woven through every other braid
    if k % 2 == 0:
        coil_along(pts, rng.uniform(0.15, 0.4), rng.uniform(0.006, 0.01), rng.uniform(0.02, 0.03), 0.0014, rng.uniform(0, 6.28))
obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

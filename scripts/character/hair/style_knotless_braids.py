"""
Knotless braids: like box braids but each braid starts thin and flat on the scalp (no knot/base),
growing to full size over the first few cm; smaller parts, more braids, lighter tapered ends.
Material: "Hair" (tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import braidkit  # noqa: E402
import hairkit  # noqa: E402

STYLE = "knotless_braids"
SPACING = 8.6  # small parts, many braids: a full head, little scalp showing (Lola)
R = 0.0049

head = hairkit.open_base()
gray, height = hairkit.tex_braid(512, seed=33, tilt=32)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.6)]
b = hairkit.Builder(head)
roots = hairkit.scalp_roots(head, spacing_deg=SPACING, el_min_off=0.4, jitter=0.08, seed=8, el_top=87.0)
hairkit.log("roots", len(roots))
braidkit.hanging_strands(head, b, roots, R, stop_back=1.10, stop_front=1.13, sides=5, lobes=0, pitch=0.01,
                         step=0.026, root_style="flat", flat_len=0.045, flat_r0=0.8, flat_sq=0.35, taper=0.25, taper_to=0.45, seed=9,
                         layer_per_deg=0.009 / 60, layer_cap=0.014)
obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

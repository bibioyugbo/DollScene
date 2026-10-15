"""
Two-strand twists: medium length (shoulders / upper back), two ropes wound round each other
(2-lobed cross-section rotating along the twist + a twisted-rope texture), small parted roots.
Material: "Hair" (tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import braidkit  # noqa: E402
import hairkit  # noqa: E402

STYLE = "twists"
SPACING = 13.0
R = 0.0056

head = hairkit.open_base()
gray, height = hairkit.tex_twist(512, seed=41)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.65)]
b = hairkit.Builder(head)
roots = hairkit.scalp_roots(head, spacing_deg=SPACING, el_min_off=1.5, jitter=0.08, seed=12, el_top=87.0)
hairkit.log("roots", len(roots))
braidkit.hanging_strands(head, b, roots, R, stop_back=1.29, stop_front=1.30, sides=8, lobes=2, lobe_amp=0.3, pitch=0.018,
                         step=0.02, root_style="flat", flat_len=0.02, flat_r0=0.75, flat_sq=0.6, taper=0.1, taper_to=0.65,
                         end_jitter=0.03, seed=13, layer_per_deg=0.011 / 60, layer_cap=0.018)
obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

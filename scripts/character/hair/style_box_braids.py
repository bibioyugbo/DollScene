"""
Box braids: square (brick-offset) grid parts over the whole scalp, a flattened square base of hair
at every root, three-strand braids to mid-back. Front pieces from above the ears fall in front of
the shoulders; the rest is combed back over the crown and hangs down the back in lanes.
Material: "Hair" (tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import braidkit  # noqa: E402
import hairkit  # noqa: E402

STYLE = "box_braids"
SPACING = 15.0  # degrees of arc between parts (~2.4 cm: medium box braids)
R = 0.0055

head = hairkit.open_base()
gray, height = hairkit.tex_braid(512, seed=21)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.6)]
b = hairkit.Builder(head)
roots = hairkit.scalp_roots(head, spacing_deg=SPACING, el_min_off=2.0, jitter=0.06, seed=4, el_top=86.0)
hairkit.log("roots", len(roots))
braidkit.hanging_strands(head, b, roots, R, stop_back=1.12, stop_front=1.15, sides=6, lobes=3, lobe_amp=0.16, pitch=0.014,
                         step=0.02, root_style="pad", pad_frac=0.43, spacing_deg=SPACING, taper=0.06, taper_to=0.7, seed=5)
obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

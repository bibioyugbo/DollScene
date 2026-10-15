"""
Jayda Wayda braids: very long, sleek, small-to-medium knotless braids on a crisp centre part.

  * Roots on a brick grid either side of a clean centre part (forehead to crown); every braid
    starts thin and flat on the scalp (knotless: no knot or base) and grows to full size over the
    first few cm, so the head reads sleek and flat with neat parts and laid edges.
  * The braids are combed back over the scalp and hang straight down the back, reaching the upper
    thighs (z ~0.66 m on the base body; uneven ends of a few cm), riding over the buttocks with
    extra clearance; a few pieces from in front of the ears fall in front of the shoulders.
  * Lanes keep left/right order and stay within |x| <= 0.12 m: nothing crosses the spine or lands
    on the lowered arms.
Material: "Hair" (tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import longkit  # noqa: E402

STYLE = "jayda_braids"
SPACING = 10.0  # degrees of arc between parts (~1.6 cm: small-medium knotless)
R = 0.0046

head = hairkit.open_base()
gray, height = hairkit.tex_braid(512, seed=61, tilt=32)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.5)]
b = hairkit.Builder(head)
roots = longkit.even_roots(head, spacing_deg=SPACING, part_deg=2.2, part_end=(180, 86), seed=12, edge_off=0.45, edge_spacing=0.72)
hairkit.log("roots", len(roots))
longkit.hanging_long(head, b, roots, R, stop_back=0.66, stop_front=0.70, sides=5, step=0.024, flat_len=0.045, flat_r0=0.8, flat_sq=0.35,
                     taper=0.06, taper_to=0.55, seed=13, layer_per_deg=0.009 / 60, layer_cap=0.014, low_extra=0.015, thin_below=1.30,
                     front_kw=dict(az_lo=48, az_hi=104, above=26), front_lanes=(0.055, 0.125))
obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

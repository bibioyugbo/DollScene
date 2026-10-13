"""
Wavy wig: long (mid-back at the back, bust at the front) wavy hair on a centre part.

  * Comb shell from a thin centre parting (closing at the crown) down to the natural hairline
    all round; covers the whole scalp, thin lace-like edge at the hairline.
  * 72 flattened wavy ribbon clumps in three layers rooted on the shell (higher roots outside,
    with extra clearance so layers never sink into each other, on the head or over the top).
    Front pieces fall in front of the shoulders; the rest hang down the back in ordered lanes
    (|x| <= 0.12: no crossing the spine, clear of the lowered arms).
Materials: "Hair" only. _strand per ribbon (shell 0); _section from the ribbon root.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402

STYLE = "wavy_wig"
head = hairkit.open_base()
gray, height = hairkit.tex_strands(1024, seed=31, wave=1.0, waves=3, clumps=26)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=1.6)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.012), tip_preview=(0.03, 0.022, 0.016), roughness=0.5)
b = hairkit.Builder(head)
flowkit.wig(head, b)
obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

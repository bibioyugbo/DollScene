"""Locs: traditional uniform medium locs, slightly fuzzy new-growth roots and soft parts.
Shares its layout with style_locs_retwist.py strand for strand (lockit.LOCS)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402

STYLE = "locs"
head = hairkit.open_base()
strands = lockit.layout(head, **lockit.LOCS)
b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="fuzzy", sides=lockit.LOCS_SIDES)
lockit.scalp_layer(head, b)
lockit.finish_style(STYLE, head, b, roughness=0.85, tex=hairkit.tex_loc(512, seed=9, fuzz=1.0))

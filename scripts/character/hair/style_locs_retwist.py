"""Retwisted locs: the SAME locs as style_locs.py (same layout function + seed, same strand order,
lengths, thickness and hanging paths), with neat tight roots and crisp bare-scalp partings."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402

STYLE = "locs_retwist"
head = hairkit.open_base()
strands = lockit.fall_layout(head, **{k: v for k, v in lockit.LOCS.items() if k != "sweep_el"})
b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="tight", sides=lockit.LOCS_SIDES)
lockit.finish_style(STYLE, head, b, roughness=0.75, tex=hairkit.tex_loc(512, seed=9, fuzz=0.55, crevice=0.45))

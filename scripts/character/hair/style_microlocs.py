"""Microlocs: thin and many, soft new-growth roots over a thin scalp layer."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402

STYLE = "microlocs"
head = hairkit.open_base()
strands = lockit.fall_layout(head, spacing=9.0, jitter=0.3, seed=33, radius=0.0025, r_var=0.1, stop_z=1.14, stop_var=0.035, step=0.04, layer=0.007)
b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="fuzzy", sides=4, taper=0.05, tip_r=0.7)
lockit.scalp_layer(head, b, lift=0.0018)
lockit.finish_style(STYLE, head, b, roughness=0.85, tex=hairkit.tex_loc(512, seed=41, fuzz=0.8, crevice=0.4))

"""Faux locs: neat, uniform, slightly glossy wrapped locs with tapered wrapped ends, on neat parts."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402

STYLE = "faux_locs"
head = hairkit.open_base()
strands = lockit.fall_layout(head, spacing=11.5, jitter=0.12, seed=73, radius=0.0056, r_var=0.03, stop_z=1.04, stop_var=0.015, step=0.032)
b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="tight", sides=6, wrap_end=(0.09, 0.3))
lockit.finish_style(STYLE, head, b, roughness=0.5, tex=lockit.wrap_texture(512, seed=13, wraps=5, sheen=0.3))

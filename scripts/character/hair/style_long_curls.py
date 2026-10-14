"""
Long curls (Nala): full, long, black curly hair, curly from the scalp to the ends (no solid cap or
"afro" volume): every curl is its own coiled strand from a root on the scalp (lockit.fall_layout,
a centre part), a springy coil wound round its centre line, layered so upper curls lie over lower
ones, falling past the shoulders over the clothes; a close scalp layer under the roots so no scalp
shows between them. Materials: "Hair" (one coil texture, tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402
import numpy as np  # noqa: E402

STYLE = "long_curls"
head = hairkit.open_base()
rng = np.random.default_rng(29)
strands = lockit.fall_layout(head, spacing=10.0, jitter=0.35, seed=29, radius=0.0042, r_var=0.15, stop_z=1.06, stop_var=0.05, step=0.02, layer=0.018)
for st in strands:
    # each curl clump its own spring: a coil ~2 cm across, a 2.6-3.2 cm pitch, from the scalp
    st["pts"] = lockit.helix(st["pts"], coil_r=rng.uniform(0.008, 0.011), pitch=rng.uniform(0.026, 0.032), start=0.03, phase=rng.uniform(0, 6.28), res=0.0065)
b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="tight", sides=4, taper=0.08, tip_r=0.7)
lockit.scalp_layer(head, b)
lockit.finish_style(STYLE, head, b, roughness=0.8, tex=hairkit.tex_coil(512, seed=31, n=1400, dark=False))

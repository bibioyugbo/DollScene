"""Freeform locs: irregular, varied thickness and length, some locs joined into their neighbour."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402
import numpy as np  # noqa: E402

STYLE = "freeform_locs"
head = hairkit.open_base()
strands = lockit.layout(head, spacing=13.0, jitter=0.4, seed=57, radius=0.0058, r_var=0.35, stop_z=1.10, stop_var=0.09, step=0.032, layer=0.011, sweep_el=50.0, wavy=0.006)
merges = lockit.pick_merges(strands, frac=0.14)
partners = set(merges.values())
rng = np.random.default_rng(8)
prof = [(rng.uniform(5, 14), rng.uniform(0, 6.3), rng.uniform(0.08, 0.2), rng.uniform(17, 31), rng.uniform(0, 6.3)) for _ in strands]


def r_fn(i, s):
    f1, p1, a1, f2, p2 = prof[i]
    k = 1 + a1 * math.sin(s * f1 + p1) + 0.07 * math.sin(s * f2 + p2)  # bulges and thin spots
    if i in partners:
        k *= 1 + 0.3 * (s > 0.15)  # thicker where a neighbour joined
    return k


b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="fuzzy", sides=5, taper=0.08, tip_r=0.75, merges=merges, r_fn=r_fn)
lockit.scalp_layer(head, b)
lockit.finish_style(STYLE, head, b, roughness=0.9, tex=hairkit.tex_loc(512, seed=61, fuzz=1.4, crevice=0.8))

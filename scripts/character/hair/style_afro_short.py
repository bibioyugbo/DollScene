"""Short wide afro: shorter height, broad horizontal silhouette, dense, softly irregular outline."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import afrokit  # noqa: E402

afrokit.build(
    "afro_short",
    oc_off=(0.0, 0.004, 0.004),
    radii=(0.158, 0.142, 0.122),
    drop_side=0.0,
    drop_back=0.0,
    ramp=(24.0, 42.0, 54.0),
    lumps=[(0.05, 0.007), (0.02, 0.004), (0.009, 0.0018)],
    seed=17,
)

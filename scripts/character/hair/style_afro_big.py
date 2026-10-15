"""Big puffy afro: a much larger, full rounded volume with natural outline variation."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import afrokit  # noqa: E402

afrokit.build(
    "afro_big",
    oc_off=(0.0, 0.014, 0.036),
    radii=(0.198, 0.192, 0.180),
    drop_side=0.0,
    drop_back=0.0,
    ramp=(30.0, 46.0, 58.0),
    lumps=[(0.07, 0.012), (0.025, 0.005), (0.01, 0.002)],
    seed=7,
)

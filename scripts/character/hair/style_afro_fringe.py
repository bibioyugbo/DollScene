"""Small cute afro with a fringe: a compact rounded coil volume whose front edge comes down over
the forehead (Ifeoma). Same coil texture as the other afros, tinted by the app."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import afrokit  # noqa: E402

afrokit.build(
    "afro_fringe",
    oc_off=(0.0, -0.004, 0.006),
    # shorter: a close, rounded TWA-length afro (a couple of cm of coils over the skull)
    radii=(0.104, 0.107, 0.095),
    drop_side=4.0,
    drop_back=3.0,
    drop_front=11.0,
    front_width=62.0,
    ramp=(20.0, 34.0, 46.0),
    lumps=[(0.04, 0.004), (0.016, 0.0028), (0.008, 0.0014)],
    seed=29,
)

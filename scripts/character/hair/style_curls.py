"""
Natural curls: a 3C/4A wash-and-go on shoulder-length hair (shrinkage leaves it around the
collarbone), no visible part.

Reference: dense, defined coils about pencil to straw width, springing into clumps; a rounded,
soft dome on top (curl texture, a little lift, no lumps), fullness through the sides and lengths,
a tidy edge along the hairline; the face stays open, curls framing it from the temples down.

  * curlkit.clump_wig with a smooth domed comb shell (~1.2 cm lift at the crown easing to a thin
    edge at the hairline, coil texture) and four layers of small spiral coil clumps emerging from
    under it below the crown curve; coils form from about the temples down, growing slightly
    towards the ends.
Materials: "Hair" only (coil texture, tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import curlkit  # noqa: E402
import hairkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402

def dome(p, t):
    """Shell thickness: ~1.2 cm on the crown, easing to a 1.5 mm edge over the last ~16 degrees
    above the hairline everywhere (forehead included: no cliff at the front)."""
    az, el = head.angles(p)
    d = el - head.hairline(az)
    return 0.0015 + 0.0105 * smoothstep(0.0, 26.0, d)


STYLE = "curls"
head = hairkit.open_base()
gray, height = hairkit.tex_coil(1024, seed=31, n=2600, dark=False)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=2.0)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.03, 0.02, 0.016), tip_preview=(0.05, 0.032, 0.022), roughness=0.8)
b = hairkit.Builder(head)
LAYERS = (  # (root along the comb line, extra clearance, clumps per side, radius scale)
    (0.48, 0.004, 13, 1.0),
    (0.62, 0.003, 13, 1.0),
    (0.76, 0.0015, 12, 1.0),
    (0.9, 0.0, 11, 0.9),
)
curlkit.clump_wig(head, b, LAYERS, pattern="helix", amp=(0.0055, 0.0075), period=(0.015, 0.019), tube_r=0.0052, squash=0.85,
                  sides=5, curl_start=0.015, curl_ramp=0.04, stop_back=1.335, stop_front=1.395, stop_var=0.015, seed=23,
                  shell_off=dome, spt=9, lie=dict(n_side=17, rows=((-0.12, 0.22), (0.04, 0.38), (0.22, 0.56), (0.42, 0.9, 0.3), (0.6, 0.97, 0.3)), tube_r=0.0046, amp=0.0042, depth=0.45), comb_end=0.74, z_curl=1.62, front_k=0.3,
                  amp_grow=0.3, spread=0.2, part_gap=0.0, shell_uv=0.03, flat_w=1.4)
obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

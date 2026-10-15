"""
Long curly wig (Nala): a long, full curly lace-front unit on a centre part.

Reference (curly / deep-wave lace-front wigs): a clean, flat-lying top with a natural lace
hairline and a thin centre part; the curl pattern forms a few cm below the part and is fully
defined from about ear level down; spiral curls ~2-3 cm across; fullness through the lengths and
ends (not the crown); mid-back at the back, past the bust at the front.

  * curlkit.clump_wig: comb shell from the part to the hairline (sleek, ~5 mm, thinning to a
    lace-thin edge), three layers of spiral curl clumps rooted on it (upper layers outside). The
    coil eases in from ~7 cm along each clump, so nothing coils on top of the head.
  * Front clumps fall in front of the shoulders (lanes clear of the face), the rest down the back.
Materials: "Hair" only (strand texture along the curls, tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import curlkit  # noqa: E402
import hairkit  # noqa: E402

STYLE = "long_curls"
head = hairkit.open_base()
gray, height = hairkit.tex_strands(1024, seed=29, wave=0.6, waves=3, clumps=20)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=1.8)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.012), tip_preview=(0.03, 0.022, 0.016), roughness=0.55)
b = hairkit.Builder(head)
LAYERS = (  # (root along the comb line, extra clearance, clumps per side, radius scale)
    (0.52, 0.004, 12, 1.0),
    (0.70, 0.002, 12, 1.0),
    (0.88, 0.0, 11, 0.95),
)
curlkit.clump_wig(head, b, LAYERS, pattern="helix", amp=(0.011, 0.014), period=(0.034, 0.042), tube_r=0.0068, squash=0.8,
                  sides=5, curl_start=0.07, curl_ramp=0.09, stop_back=1.10, stop_front=1.16, seed=29, res=0.0045, comb_end=0.78, z_curl=1.525, front_k=0.32, amp_grow=0.35, spread=0.12)
obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

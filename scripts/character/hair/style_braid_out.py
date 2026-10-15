"""
Braid-out (loose): natural hair set in braids, taken down and separated: stretched, defined
crimped zig-zag/S sections with volume, about shoulder length, on a centre part.

Reference: a braid-out stretches the hair longer than a wash-and-go and leaves a distinct
zig-zag crimp in chunky sections (one per loosened braid, bigger braids -> softer, wider waves);
the crimp starts at the roots, so the top lies close with the pattern visible, and the volume
builds through the lengths into a soft triangle; tidy edges, the face open.

  * curlkit.clump_wig, pattern "zigzag": a smooth domed comb shell (~1 cm on the crown easing to a
    fine edge above the hairline everywhere) with a centre part; crimped flat sections lying on
    the top (along the comb lines from the part, tucking in at both ends) and four layers of
    crimped hanging sections emerging from under it, widening a little towards the ends.
Materials: "Hair" only (crimped strand texture, tinted by the app).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import curlkit  # noqa: E402
import hairkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402

STYLE = "braid_out"
head = hairkit.open_base()


def dome(p, t):
    az, el = head.angles(p)
    d = el - head.hairline(az)
    return 0.0015 + 0.0085 * smoothstep(0.0, 26.0, d)


gray, height = hairkit.tex_strands(1024, seed=41, wave=0.35, waves=3, clumps=18)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=2.0)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.03, 0.02, 0.016), tip_preview=(0.05, 0.032, 0.022), roughness=0.8)
b = hairkit.Builder(head)
LAYERS = (  # (root along the comb line, extra clearance, sections per side, radius scale)
    (0.46, 0.005, 12, 1.0),
    (0.6, 0.0035, 12, 1.0),
    (0.74, 0.002, 11, 1.0),
    (0.88, 0.0, 10, 0.9),
)
curlkit.clump_wig(head, b, LAYERS, pattern="zigzag", amp=(0.006, 0.008), period=(0.022, 0.028), tube_r=0.0085, squash=0.42,
                  sides=6, curl_start=0.015, curl_ramp=0.04, stop_back=1.305, stop_front=1.37, stop_var=0.015, seed=41,
                  shell_off=dome, comb_end=0.72, z_curl=1.62, front_k=0.3, amp_grow=0.8, spread=0.55, part_gap=0.7,
                  shell_uv=0.035, flat_w=1.15, flat_sq=0.4, spt=7, depth=0.6,
                  lie=dict(n_side=15, rows=((0.034, 0.36), (0.18, 0.52), (0.4, 0.88, 0.3), (0.58, 0.97, 0.3)), tube_r=0.0075, amp=0.0045,
                           period=0.022, squash=0.4, sides=5, depth=0.5, spt=7, pattern="zigzag", end_len=0.012, root_r=0.3))
obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

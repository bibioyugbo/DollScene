"""
Leave-out: a sew-in (straight / softly wavy install on a centre part) with the wearer's natural
hair left out at the front hairline, covering the tracks and blending into the install.

  * Install: flowkit.wig with a soft wave - comb shell from the part to the hairline (sides, back)
    and 54 layered ribbons; the front ribbons are rooted UNDER the leave-out, like a sew-in.
  * Leave-out: the front of the part (k < 0.33) is a puffier coily shell (lift up to ~1 cm with
    coil lumps) thinning to a soft 1.5 mm edge on the hairline, overlapping the install shell;
    six flat coily pieces per side sweep from the leave-out over the install at the temples and
    taper into it. Only the lowest install layer is rooted under the leave-out (hidden tracks).
  * One atlas texture (the build gives every "Hair" slot <id>.png): U 0..0.5 straight strands
    (install), U 0.5..1 coils (leave-out). Shell U runs as a triangle wave so it stays inside its
    half without a seam; tube U (0..1 around) is scaled into its half.
Materials: "Hair" only.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
import shellkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402

STYLE = "leave_out"
K_LEAVE = 0.36  # part lines 0..K_LEAVE (front) are leave-out
head = hairkit.open_base()

# -- atlas: left half strands, right half coils
sg, sh = hairkit.tex_strands(1024, seed=41, wave=0.4, waves=2, clumps=26)
cg, ch = hairkit.tex_coil(1024, seed=43, n=5600, dark=False)
gray = np.concatenate([sg[:, ::2], cg[:, ::2]], axis=1)
height = np.concatenate([sh[:, ::2] * 0.6, ch[:, ::2] * 0.35], axis=1)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=1.8)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.012), tip_preview=(0.03, 0.022, 0.016), roughness=0.55)


def tri(u):
    t = u % 2.0
    return t if t < 1.0 else 2.0 - t


def half(lo):
    return lambda u, v: (lo + 0.01 + 0.47 * tri(u), v)


b = hairkit.Builder(head)
# install (temporary material index 2 on the ribbons, remapped below)
flowkit.wig(head, b, wave_amp=0.006, wavelength=0.14, stop_back=1.12, stop_front=1.18, mat_ribbon=2, skip_line=lambda k: k < K_LEAVE - 0.06, shell_uv=half(0.0), seed=5, skip_ribbon=lambda k, li: k < K_LEAVE and li < 2)

# leave-out shell over the front of the part, overlapping the install shell behind it
pl = flowkit.part_lines(head, n_lines=48, n_samples=26)
for s in (1, -1):
    ls = [ds for k, ds in pl[s] if k <= K_LEAVE]
    if s == -1:
        ls = ls[::-1]
    flowkit.comb_shell(
        head, b, ls,
        lift=lambda t: 0.0015 + 0.008 * (1 - smoothstep(0.55, 1.0, t)) * smoothstep(0.0, 0.08, t) + 0.002,
        bulge=lambda p, t: max(0.0, shellkit.lumps(p, [(0.018, 0.0035), (0.007, 0.0012)])) * (1 - smoothstep(0.6, 1.0, t)),
        uv_tile=0.03, uv_map=half(0.5),
    )

# coily clumps from the temples, over the install, tapering into it
rng = np.random.default_rng(9)
for s in (1, -1):
    for i in range(6):
        k = 0.05 + 0.3 * i / 5
        m = flowkit.nlerp(head.dir(0, 31), head.dir(180, 62), k)
        az = (52 + 128 * k) * s
        h = head.dir(az, head.hairline(az))
        d = flowkit.nlerp(m, h, 0.62)
        p, n = head.surf_dir(d)
        root = p + n * 0.008
        q, _ = head.surf_dir(flowkit.nlerp(m, h, 0.72))
        pts = flowkit.ribbon_path(head, root, (q - p).normalized(), 0.2 + rng.uniform(0, 0.06), 0.012, 0.004, s * (0.09 + 0.1 * k), k < 0.2, wave_amp=0.006, wavelength=0.07, step=0.012)
        flowkit.ribbon(b, head, pts, 0.016, squash=0.35, sides=6, mat=3, root=root, taper_in=0.12)

# atlas remap of the tubes (U 0..1 around) into their halves, then one material
for f in b.bm.faces:
    if f.material_index in (2, 3):
        lo = 0.0 if f.material_index == 2 else 0.5
        for loop in f.loops:
            u, v = loop[b.uv].uv
            loop[b.uv].uv = (lo + 0.01 + 0.47 * min(1.0, max(0.0, u)), v)
        f.material_index = 0

obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

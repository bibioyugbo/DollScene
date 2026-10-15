"""
Single braid: all the hair brushed smoothly back from the hairline (no fringe, the face open) to
a gather at the back of the head, then one classic three-strand plait down the spine to the
mid-back, finished with an elastic and a short loose tail.

Reference: a single plait / three-strand braid - the hair lies close and smooth over the head
(combed lines converging on the gather), the braid shows the alternating over-under "V" sections
of three strands, slightly widest near the top and tapering towards the end.

  * Comb shell (flowkit.comb_shell): lines from every point of the natural hairline (a closed
    loop: forehead, temples, over the ears, nape) converging on the gather at (az 180, el -18);
    2 mm off the skin at the hairline rising to ~7 mm where the hair bunches into the gather.
  * Plait: a centre line draped from the gather down the back (clear of the clothes, along the
    spine); three flattened strands woven round it (each one sin(phi) across, sin(2 phi) in and
    out, 120 degrees apart: the true over-under weave), tapering, then an elastic ("Accent") and
    a short tail of tapered strands.
Materials: "Hair" (straight strand texture, tinted by the app) and "Accent" (elastic).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "braid01"
GATHER = (180.0, -18.0)
COLS = 120
SAMPLES = 34
STOP_Z = 1.13  # end of the braid (mid-back)
PERIOD = 0.062  # one full weave cycle along the braid (m)

head = hairkit.open_base()
gray, height = hairkit.tex_strands(1024, seed=7, wave=0.15, waves=2, clumps=22)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=1.6)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.012), tip_preview=(0.03, 0.022, 0.016), roughness=0.55)
tie = hairkit.accent_material("Accent", color=(0.08, 0.07, 0.07), metallic=0.0, roughness=0.6)
b = hairkit.Builder(head)

# ---------------------------------------------------------------- combed-back shell
target = head.dir(*GATHER)
lines = []
for i in range(COLS):
    az = -180.0 + 360.0 * i / COLS
    hl = head.dir(az, head.hairline(az))
    lines.append([flowkit.nlerp(hl, target, 0.94 * j / (SAMPLES - 1)) for j in range(SAMPLES)])
flowkit.comb_shell(head, b, lines, wrap=True, lift=lambda t: 0.0018 + 0.0052 * smoothstep(0.45, 1.0, t), uv_tile=0.04)

# ---------------------------------------------------------------- plait
root, n = head.surf_dir(target)
n = n.normalized()
start = root + n * 0.006
out = (n * 0.5 + Vector((0, 0.15, -1.0))).normalized()
axis = head.drape(start, out, 0.6, step=0.006, margin=0.014, stiff=0.85, bend=0.08, gravity=Vector((0, 0.12, -1)), stop_z=STOP_Z)
# keep it on the spine
axis = [Vector((p.x * 0.3, p.y, p.z)) if i > 3 else p for i, p in enumerate(axis)]
axis = [head.push_out(p) if i > 3 else p for i, p in enumerate(axis)]
# even spacing, fine enough for the weave
acc = [0.0]
for p0, p1 in zip(axis, axis[1:]):
    acc.append(acc[-1] + (p1 - p0).length)
L = acc[-1]
N = int(L / 0.0035)
pts = []
j = 0
for k in range(N + 1):
    s = L * k / N
    while j < len(acc) - 2 and acc[j + 1] < s:
        j += 1
    t = (s - acc[j]) / max(acc[j + 1] - acc[j], 1e-9)
    pts.append(axis[j].lerp(axis[j + 1], t))
tie_s = 0.86  # elastic position (fraction of the braid)


def frame(i):
    tg = (pts[min(i + 1, N)] - pts[max(i - 1, 0)]).normalized()
    _s, _q, nn = head.signed(pts[i])
    nn = (nn - tg * nn.dot(tg)).normalized()
    lat = tg.cross(nn).normalized()
    return tg, nn, lat


frames = [frame(i) for i in range(N + 1)]
# smooth the normals so the weave never flips
for _ in range(4):
    sm = []
    for i in range(N + 1):
        a = Vector()
        for k in range(max(0, i - 3), min(N + 1, i + 4)):
            a += frames[k][1]
        tg = frames[i][0]
        nn = (a - tg * a.dot(tg)).normalized()
        sm.append((tg, nn, tg.cross(nn).normalized()))
    frames = sm


def width(s):
    """Half-width of the braid: grows out of the gather, tapers to the elastic."""
    return 0.0125 * (0.45 + 0.55 * smoothstep(0.0, 0.07, s)) * (1 - 0.45 * smoothstep(0.35, tie_s, s))


strand_r = lambda s: 0.0062 * (0.6 + 0.4 * smoothstep(0.0, 0.05, s)) * (1 - 0.4 * smoothstep(0.4, tie_s, s))  # noqa: E731
i_tie = int(tie_s * N)
for strand in range(3):
    off = 2 * math.pi * strand / 3
    sp = []
    for i in range(i_tie + 1):
        s = i / N
        tg, nn, lat = frames[i]
        ph = 2 * math.pi * (s * L) / PERIOD + off
        w = width(s)
        # figure-eight weave: across with sin(phi), over/under with sin(2 phi)
        p = pts[i] + lat * w * math.sin(ph) + nn * w * 0.42 * math.sin(2 * ph) * smoothstep(0.0, 0.05, s)
        sp.append(p)
    sp[0] = root + n * 0.002
    nsp = len(sp)
    fr = [frames[i][1] for i in range(nsp)]
    b.tube(sp, lambda t: strand_r(t * tie_s), sides=7, frames=fr, squash=0.7, tip_curve=lambda i, n_=nsp: 0.85 * i / (n_ - 1), root=root)

# elastic
tg, nn, lat = frames[i_tie]
b.sphere(pts[i_tie], width(tie_s) * 1.25, segs=14, rings=6, mat=1, tip=0.85, scale=(1, 1, 0.38), axis=tg)

# loose tail below the elastic: a few tapered strands fanning slightly
rng = np.random.default_rng(3)
tail = pts[i_tie:]
for k in range(7):
    a = 2 * math.pi * k / 7 + rng.uniform(-0.2, 0.2)
    rr = width(tie_s) * 0.55
    sp = []
    for j, p in enumerate(tail):
        f = j / max(len(tail) - 1, 1)
        tg, nn, lat = frames[i_tie + j]
        spread = rr * (0.6 + 1.3 * f)
        sp.append(p + (lat * math.cos(a) + nn * math.sin(a) * 0.6) * spread)
    nt = len(sp)
    b.tube(sp, lambda t: 0.0034 * (1 - 0.85 * smoothstep(0.2, 1.0, t)), sides=5, squash=0.75, tip_curve=lambda i, n_=nt: 0.85 + 0.15 * i / (n_ - 1), root=root)

obj = b.to_object(f"Hair_{STYLE}", [mat, tie])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

"""
Cornrows: straight-back rows covering the whole scalp.

  * 2K+1 rows; row u (-1..1) starts on the front hairline (az 60u), passes over the top of the head
    (the crown for u = 0, down the side above the ear for |u| = 1) and ends on the nape hairline
    (az +-(180 - 60|u|)). Each row is a smooth circle through those three points on the unit
    sphere, projected onto the scalp; the outer rows blend towards a path that follows the hairline
    (no bald strip above the ears).
  * Width = 80 % of the local spacing to the neighbouring rows (clean narrow parts between rows),
    flattened (squash) and half-sunk into the scalp so they read braided down, starting small at
    the hairline.
  * Each row ends in a short braided tail (~5 cm) at the nape.
  * _tip runs 0 at the front hairline .. 1 at the tail end (braiding progress); _strand per row;
    _section from the row's root (front hairline -> sections 0/1).
Material: "Hair" (tinted by the app).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402

STYLE = "cornrows"
K = 8  # rows per side (17 rows)
SQUASH = 0.55
STEP = 0.005
TAIL = 0.05

head = hairkit.open_base()
D = head.dir


def circle_dirs(a, t, c, n=120):
    """Unit directions along the circle through unit vectors a -> t -> c."""
    ab, ac = t - a, c - a
    nn = ab.cross(ac)
    if nn.length < 1e-9:
        return [a.lerp(c, i / (n - 1)).normalized() for i in range(n)]
    cc = a + ((ac.length_squared * nn.cross(ab)) + (ab.length_squared * ac.cross(nn))) / (2 * nn.length_squared)
    e1 = (a - cc).normalized()
    e2 = nn.normalized().cross(e1).normalized()

    def ang(p):
        v = p - cc
        x = math.atan2(v.dot(e2), v.dot(e1))
        return x % (2 * math.pi)

    if ang(t) > ang(c):
        e2 = -e2
    R = (a - cc).length
    end = ang(c)
    return [(cc + (e1 * math.cos(end * i / (n - 1)) + e2 * math.sin(end * i / (n - 1))) * R).normalized() for i in range(n)]


def row_dirs(u, n=120):
    """Row u: hairline (front) -> over the head -> nape hairline, a smooth circle on the sphere.
    The outer rows start lower at the temple (sideburn) and pass just above the ear."""
    s = 1 if u >= 0 else -1
    au = abs(u)
    az_f = (60 + 6 * au ** 4) * u
    az_b = s * (180 - 60 * au) if au > 1e-6 else 180.0
    F = D(az_f, head.hairline(az_f) + 1.5)
    B = D(az_b, head.hairline(az_b) + 2.5)
    T = D(90 * s, 90 - 92 * au) if au > 1e-6 else D(0, 89.9)
    return circle_dirs(F, T, B, n)


def resample(pts, step):
    out = [pts[0]]
    acc = 0.0
    for p0, p1 in zip(pts, pts[1:]):
        seg = (p1 - p0).length
        acc += seg
        while acc >= step:
            acc -= step
            out.append(p1 - (p1 - p0).normalized() * acc)
    if (out[-1] - pts[-1]).length > step * 0.3:
        out.append(pts[-1])
    return out


# --- row centre lines on the skin
rows = []
for k in range(-K, K + 1):
    u = k / K
    skin = [head.surf_dir(d)[0] for d in row_dirs(u)]
    rows.append(resample(skin, STEP))

# --- widths from the spacing to the neighbours
kds = []
for r in rows:
    kd = KDTree(len(r))
    for i, p in enumerate(r):
        kd.insert(p, i)
    kd.balance()
    kds.append(kd)
widths = []
for j, r in enumerate(rows):
    w = []
    for p in r:
        ds = [kds[jj].find(p)[2] for jj in (j - 1, j + 1) if 0 <= jj < len(rows)]
        sp = min(ds) if len(ds) == 1 else sum(ds) / 2 if max(ds) < 1.6 * min(ds) else min(ds)
        w.append(min(0.0125, max(0.0055, 0.8 * sp)))
    w = np.convolve(np.pad(w, 4, mode="edge"), np.ones(9) / 9, mode="valid")
    widths.append(list(w))

gray, height = hairkit.tex_braid(512, seed=51, lobes_u=2)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.6)]
b = hairkit.Builder(head)

for j, (r, w) in enumerate(zip(rows, widths)):
    n_s = len(r)
    pts, frames, rads, sqs = [], [], [], []
    L0 = 0.0
    for i, p in enumerate(r):
        _s, q, nn = head.signed(p)
        L0 = i * STEP
        start = 0.5 + 0.5 * smoothstep(0.0, 0.015, L0)  # small at the hairline
        rr = w[i] / 2 * start
        pts.append(p + nn * rr * SQUASH * 0.45)
        frames.append(nn)
        rads.append(rr)
        sqs.append(SQUASH)
    # tail: continue down the nape and hang a short braid
    end = pts[-1]
    tang = (pts[-1] - pts[-4]).normalized()
    g = Vector((0, 0.25, -1)).normalized()
    hang = head.drape(end, (tang + g).normalized(), TAIL, step=STEP * 1.6, margin=rads[-1] * 0.7 + 0.002, stiff=0.7, bend=0.15, gravity=g)
    r_end = rads[-1]
    nt = len(hang) - 1
    for i, p in enumerate(hang[1:], 1):
        t = i / nt
        pts.append(p)
        frames.append(None)
        rads.append(r_end * (0.8 - 0.35 * t))
        sqs.append(SQUASH + (1 - SQUASH) * min(1, t * 3))
    n_all = len(pts)
    rad_arr, sq_arr = np.array(rads), np.array(sqs)

    def radius(s, ra=rad_arr):
        return float(np.interp(s, np.linspace(0, 1, len(ra)), ra))

    def squash(s, sa=sq_arr):
        return float(np.interp(s, np.linspace(0, 1, len(sa)), sa))

    b.tube(pts, radius, sides=8, mat=0, frames=frames, lobes=2, lobe_amp=0.08, lobe_twist=2 * math.pi / 0.012, squash=squash, root=r[0])

obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

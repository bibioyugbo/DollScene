"""
Fulani braids: cornrows on the scalp that run into hanging braids, with gold cuffs and white beads.

Layout (Fulani signature):
  * a centre cornrow from the forehead, over the crown, to the nape;
  * on each side, rows that start near the centre and sweep down and back towards the ears; the
    front-most one ends at the temple, so its braid hangs beside the face;
  * back rows towards the nape, plus loose box braids from the nape for fullness.
Every cornrow carries on as a hanging braid (draped with gravity, kept off the shoulders and back).
Materials: "Hair" (tinted by the app), "Accent" (gold cuffs), "Bead" (cowrie-white beads).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "fulani_braids"
ROW_R = 0.0064  # cornrow radius (half-sunk: lifted 3.5 mm)
BRAID_R = 0.0045  # hanging braid radius
STITCH = 0.011  # braid stitch length (m)
SIDES = 6
rng = np.random.default_rng(11)

head = hairkit.open_base()

# Cornrows: the centre row, then N rows per side. Row i starts on the centre parting (front to
# back over the crown) and sweeps down to a drop line that runs from the temple, over the ear, to
# the nape, where its braid falls. Row 0 per side ends at the temple: the face-framing braid.
N_SIDE = 12
MIDLINE = [(0, 33), (0, 62), (0, 89.5), (180, 70), (180, 40)]
DROP = [(70, 5), (98, -6), (128, -23), (155, -41), (173, -47)]


def along(poly, t):
    """Direction at parameter t (0..1) along a polyline of (az, el), by arc of the unit vectors."""
    ds = [head.dir(a, e) for a, e in poly]
    seg = [(d1 - d0).length for d0, d1 in zip(ds, ds[1:])]
    goal = t * sum(seg)
    for d0, d1, L in zip(ds, ds[1:], seg):
        if goal <= L or d1 is ds[-1]:
            return d0.lerp(d1, min(1.0, goal / max(L, 1e-6))).normalized()
        goal -= L
    return ds[-1]


def to_ae(d):
    return head.angles(head.c + d)


ROWS = [("centre", [(0, 31), (0, 60), (0, 89.5), (180, 70), (180, 30), (180, -24)], 0.50, 0, False)]
for s in (1, -1):
    for i in range(N_SIDE):
        t = i / (N_SIDE - 1)
        d0 = along(MIDLINE, t * 0.97)
        d0 = (d0 + Vector((s * 0.11, 0, 0))).normalized()  # just off the parting
        a1, e1 = DROP[0][0] * s, DROP[0][1]
        d1 = along([(a * s, e) for a, e in DROP], t)
        mid = (d0 + d1).normalized()
        mid = (mid + Vector((s * 0.15 * (1 - 0.75 * t), 0, 0.05 * (1 - t)))).normalized()  # bow outwards over the side of the head
        wps = [to_ae(d0), to_ae(mid), to_ae(d1)]
        kind = 2 if i == 0 else (1 if i % 3 == 1 else 0)
        ROWS.append((f"row{s}_{i}", wps, 0.40 + 0.1 * t, kind, i <= 1))
# Loose box braids from the nape for fullness under the rows.
LOOSE = [(a, -36) for a in (160, 172, 188, 200)] + [(a, -22) for a in (166, 180, 194)]


# -- textures: braid stitches (alternating chevron lobes) ----------------------------------------
T = 512
y, x = np.mgrid[0:T, 0:T] / T
lobes = np.zeros((T, T))
for k, off in ((0, 0.0), (1, 0.5)):
    # Each lobe: an ellipse tilted +-35 deg, alternating sides every half stitch.
    yy = (y * 2 + off) % 1.0 - 0.5
    xx = (x * 3 + k * 0.5) % 1.0 - 0.5
    ang = math.radians(35 if k == 0 else -35)
    u = xx * math.cos(ang) - yy * math.sin(ang)
    v = xx * math.sin(ang) + yy * math.cos(ang)
    lobes = np.maximum(lobes, np.clip(1 - (u / 0.42) ** 2 - (v / 0.3) ** 2, 0, 1))
fibre = hairkit.noise2((T, T), 60, seed=3)
height = lobes ** 0.6
gray = hairkit.normalise(0.18 + height * 0.75 + (fibre - 0.5) * 0.18 * height)
tex = os.path.join(hairkit.TEX_DIR, f"{STYLE}.png")
nrm = os.path.join(hairkit.TEX_DIR, f"{STYLE}_n.png")
hairkit.save_gray(gray, tex)
hairkit.save_normal_from_height(height + fibre * 0.08, nrm, strength=4.0)

mats = [
    hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), tip_preview=(0.03, 0.02, 0.016), roughness=0.6),
    hairkit.accent_material("Accent", color=(0.83, 0.6, 0.2), metallic=1.0, roughness=0.28),
    hairkit.accent_material("Bead", color=(0.92, 0.88, 0.8), metallic=0.0, roughness=0.35),
]

b = hairkit.Builder(head)
GRAV = Vector((0, 0, -1))


def stitch_twist():
    return 2 * math.pi / STITCH


def lane_of(x, front):
    """Hanging lane: keeps left/right order (no crossing the spine), |x| <= 0.12 so the braids clear
    the lowered arms; front braids fall over the collarbone, in front of the shoulder."""
    if front:
        return math.copysign(0.10, x)
    return max(-0.12, min(0.12, x * 1.35))


def braid_from(path, length, kind, front=False):
    """path: [(point, normal)] on the scalp. Continues as a hanging braid of `length`."""
    pts = [p for p, _ in path]
    frames = [n for _, n in path]
    end, n_end = path[-1]
    tangent = (pts[-1] - pts[-3]).normalized()
    g = head.lane_gravity(lane_of(end.x, front), front)
    out = (tangent * 0.55 + n_end * 0.35 + g(end) * 0.4).normalized()
    hang = head.drape(end, out, length, step=0.012, margin=0.009, stiff=0.85, bend=0.12, gravity=g)
    all_pts = pts + hang[1:]
    frames = frames + [None] * (len(hang) - 1)
    n_scalp = len(pts)
    n_all = len(all_pts)

    def radius(s, n_scalp=n_scalp, n_all=n_all):
        i = s * (n_all - 1)
        if i < 3:
            return ROW_R * (0.45 + 0.55 * i / 3)  # thin start at the hairline
        if i < n_scalp:
            return ROW_R
        t = (i - n_scalp) / max(n_all - n_scalp, 1)
        r = ROW_R + (BRAID_R - ROW_R) * min(1, t * 6)
        return r * (1 - 0.35 * max(0, t - 0.85) / 0.15)  # tapered end

    def tip(i, n_scalp=n_scalp, n_all=n_all):
        return 0.0 if i < n_scalp else (i - n_scalp) / max(n_all - n_scalp - 1, 1)

    b.tube(all_pts, radius, sides=SIDES, mat=0, frames=frames, lobes=3, lobe_amp=0.16, lobe_twist=stitch_twist(), tip_curve=tip, v_repeat=None)
    decorate(hang, kind)


def decorate(hang, kind):
    """kind 2: face-framing braid (cuff + 3 beads); 1: one cuff + a bead; 0: a bead at the end, sometimes."""
    def at(frac):
        i = min(len(hang) - 2, int(frac * (len(hang) - 1)))
        return hang[i], (hang[i + 1] - hang[i]).normalized()

    if kind == 2:
        for f in (0.35,):
            p, d = at(f)
            b.sphere(p, BRAID_R * 1.9, segs=10, rings=4, mat=1, tip=f, scale=(1, 1, 1.35), axis=d)
        for f in (0.82, 0.88, 0.94):
            p, d = at(f)
            b.sphere(p, BRAID_R * 1.75, segs=8, rings=5, mat=2, tip=f, axis=d)
    elif kind == 1:
        p, d = at(rng.uniform(0.3, 0.6))
        b.sphere(p, BRAID_R * 1.8, segs=10, rings=4, mat=1, tip=0.5, scale=(1, 1, 1.2), axis=d)
        p, d = at(0.93)
        b.sphere(p, BRAID_R * 1.7, segs=8, rings=5, mat=2, tip=0.95, axis=d)
    elif rng.random() < 0.4:
        p, d = at(0.93)
        b.sphere(p, BRAID_R * 1.7, segs=8, rings=5, mat=1 if rng.random() < 0.5 else 2, tip=0.95, axis=d)


for name, wps, length, kind, front in ROWS:
    path = head.path_dirs(wps, lift=0.0042, step=0.006)
    braid_from(path, length + rng.uniform(-0.02, 0.02), kind, front)

for az, el in LOOSE:
    root, n = head.surf(az + rng.uniform(-4, 4), el + rng.uniform(-3, 3))
    root = root + n * 0.002
    g = head.lane_gravity(lane_of(root.x, False), False)
    pts = head.drape(root, (n * 0.6 + g(root) * 0.4).normalized(), 0.47 + rng.uniform(-0.03, 0.03), step=0.012, margin=0.009, stiff=0.8, bend=0.1, gravity=g)
    n_all = len(pts)
    b.tube(pts, lambda s: BRAID_R * (1 - 0.35 * max(0, s - 0.85) / 0.15), sides=SIDES, mat=0, lobes=3, lobe_amp=0.16, lobe_twist=stitch_twist(), tip_curve=lambda i, n=n_all: i / (n - 1))
    decorate(pts, 0)

obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

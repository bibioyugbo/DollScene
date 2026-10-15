"""
Doechii-inspired stylish cornrows: thin, neat feed-in cornrows in a sculpted swirl pattern that run
into long thin braids.

Pattern (the reference: a swirl at her right temple, rows arcing across the crown and fanning
down her left side, all tight to the scalp with clean parts, ending in long braids):
  * Rows are the level sets of a smooth distance field from a short hooked "seed" curve that
    starts on her right temple hairline and curls up into the scalp. Distance contours never cross
    and stay evenly spaced (clean, constant parts): the first few wrap tightly round the hook (the
    swirl), the next ones become wide C-shaped arcs that sweep over the crown, and the outer ones
    run front-to-back down her left side and round the back of the head.
  * Distances and contours live in a top-down azimuthal-equidistant chart of the scalp (directions
    from the skull centre; equidistant along the radial direction), so the farthest point is on the
    hairline and no contour closes on itself; contours are extracted with marching squares, cut at
    the hairline and projected onto the skin.
  * Each row is a flattened, half-sunk braided tube (like style_cornrows), small where it starts,
    width = 76 % of the row spacing; it is braided from its front end to its back end and carries
    on as a long, thin hanging braid (feed-in), steered into ordered lanes down the back; rows
    ending around her right ear fall in front of that shoulder.
  * _tip 0 on the scalp .. 1 at the braid end; _strand per row; _section from the row's start.
Material: "Hair" (tinted by the app).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import longkit  # noqa: E402
import numpy as np  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "doechii_cornrows"
SPACING = 5.4  # degrees between rows (~9 mm on this head: thin feed-in rows)
WIDTH = 0.76  # row width / spacing
SQUASH = 0.55
STEP = 0.005
BRAID_R = 0.0034
STOP_BACK = 1.02  # braid ends (z): about the waist
STOP_FRONT = 1.06
TAU = 2.5  # blur (deg) of the distance field: rounds the contours where they fold round the hook
# Seed hook (az, el), her right temple: from just outside the hairline, up into the scalp, curling
# forwards (a "?" seen from the front-right).
SEED = [(-60, 9), (-56, 22), (-50, 31), (-43, 35.5), (-37, 34.5), (-35, 30.5)]

head = hairkit.open_base()
D = head.dir
c = head.c


# ----------------------------------------------------------------------------- chart
def chart_az_el(X, Y):
    r = np.hypot(X, Y)
    az = np.degrees(np.arctan2(X, -Y))
    return az, 90.0 - r


def unit_dirs(az, el):
    a, e = np.radians(az), np.radians(el)
    return np.stack([np.sin(a) * np.cos(e), -np.cos(a) * np.cos(e), np.sin(e)], axis=-1)


# seed polyline, densified on the sphere
seed = []
for (a0, e0), (a1, e1) in zip(SEED, SEED[1:]):
    d0, d1 = D(a0, e0), D(a1, e1)
    k = max(2, int(math.degrees(d0.angle(d1)) / 0.5))
    for j in range(k):
        seed.append(d0.lerp(d1, j / k).normalized())
seed.append(D(*SEED[-1]))
S = np.array([tuple(s) for s in seed])

# ----------------------------------------------------------------------------- field on the chart grid
G = 0.5  # grid step (deg)
xs = np.arange(-150, 150 + G, G)
X, Y = np.meshgrid(xs, xs)  # [iy, ix]
AZ, EL = chart_az_el(X, Y)
U = unit_dirs(AZ, EL)
HL = np.interp(np.abs(((AZ + 180) % 360) - 180), [a for a, _ in head.HAIRLINE], [e for _, e in head.HAIRLINE])
inside = (EL >= HL + 0.8) & (np.hypot(X, Y) < 148)
# Distance to the hook measured in the chart (a plane disk): its maximum lies on the hairline, so
# every contour is an open arc ending there (on the sphere the far side of the head would hold the
# antipode of the hook and its contours would close into rings behind the left ear).
s_el = np.degrees(np.arcsin(np.clip(S[:, 2], -1, 1)))
s_az = np.arctan2(S[:, 0], -S[:, 1])
SX, SY = (90 - s_el) * np.sin(s_az), -(90 - s_el) * np.cos(s_az)
P = np.stack([X.ravel(), Y.ravel()], axis=1)
F = np.full(len(P), np.inf)
for sx, sy in zip(SX, SY):
    F = np.minimum(F, np.hypot(P[:, 0] - sx, P[:, 1] - sy))
F = F.reshape(X.shape)  # distance to the hook (seed densified to 0.5 deg)
# a light blur rounds the creases where contours fold round the hook (no kinked rows)
sig = TAU / G
kx = np.exp(-0.5 * (np.arange(-int(3 * sig), int(3 * sig) + 1) / sig) ** 2)
kx /= kx.sum()
F = np.apply_along_axis(lambda v: np.convolve(np.pad(v, len(kx) // 2, mode="edge"), kx, mode="valid"), 0, F)
F = np.apply_along_axis(lambda v: np.convolve(np.pad(v, len(kx) // 2, mode="edge"), kx, mode="valid"), 1, F)
F = np.where(inside, F, np.nan)
hairkit.log("field range", float(np.nanmin(F)), float(np.nanmax(F)))


# ----------------------------------------------------------------------------- marching squares
def contours(F, level):
    """Polylines (lists of chart points) of F == level; cells touching NaN are skipped."""
    ny, nx = F.shape
    a = F[:-1, :-1]
    b = F[:-1, 1:]
    cc = F[1:, 1:]
    d = F[1:, :-1]
    ok = ~(np.isnan(a) | np.isnan(b) | np.isnan(cc) | np.isnan(d))
    idx = (a > level).astype(int) | ((b > level).astype(int) << 1) | ((cc > level).astype(int) << 2) | ((d > level).astype(int) << 3)
    cells = np.argwhere(ok & (idx != 0) & (idx != 15))

    def interp(p0, p1, v0, v1):
        t = (level - v0) / (v1 - v0)
        return (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)

    segs = []
    for iy, ix in cells:
        va, vb, vc, vd = F[iy, ix], F[iy, ix + 1], F[iy + 1, ix + 1], F[iy + 1, ix]
        pa, pb, pc, pd = (ix, iy), (ix + 1, iy), (ix + 1, iy + 1), (ix, iy + 1)
        e = {
            "ab": lambda: interp(pa, pb, va, vb), "bc": lambda: interp(pb, pc, vb, vc),
            "cd": lambda: interp(pc, pd, vc, vd), "da": lambda: interp(pd, pa, vd, va),
        }
        k = idx[iy, ix]
        table = {1: [("da", "ab")], 2: [("ab", "bc")], 3: [("da", "bc")], 4: [("bc", "cd")], 5: [("da", "ab"), ("bc", "cd")],
                 6: [("ab", "cd")], 7: [("da", "cd")], 8: [("cd", "da")], 9: [("cd", "ab")], 10: [("ab", "bc"), ("cd", "da")],
                 11: [("cd", "bc")], 12: [("bc", "da")], 13: [("bc", "ab")], 14: [("ab", "da")]}
        for e0, e1 in table[k]:
            # edge keys identify shared points between neighbouring cells
            def key(en):
                if en == "ab":
                    return ("h", iy, ix)
                if en == "cd":
                    return ("h", iy + 1, ix)
                if en == "da":
                    return ("v", iy, ix)
                return ("v", iy, ix + 1)
            segs.append((key(e0), key(e1), e[e0](), e[e1]()))
    # chain
    nbr = {}
    pos = {}
    for k0, k1, p0, p1 in segs:
        nbr.setdefault(k0, []).append(k1)
        nbr.setdefault(k1, []).append(k0)
        pos[k0], pos[k1] = p0, p1
    seen = set()
    lines = []
    starts = [k for k, v in nbr.items() if len(v) == 1] + [k for k, v in nbr.items() if len(v) != 1]
    for s0 in starts:
        if s0 in seen:
            continue
        line = [s0]
        seen.add(s0)
        cur = s0
        while True:
            nxt = [k for k in nbr[cur] if k not in seen]
            if not nxt:
                break
            cur = nxt[0]
            seen.add(cur)
            line.append(cur)
        if len(line) > 3:
            lines.append([(xs[0] + pos[k][0] * G, xs[0] + pos[k][1] * G) for k in line])
    return lines


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


def smooth(pts, n=3):
    pts = list(pts)
    for _ in range(n):
        pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
    return pts


# ----------------------------------------------------------------------------- rows
rows = []
level = SPACING * 0.5
fmax = float(np.nanmax(F))
while level < fmax:
    for line in contours(F, level):
        dirs = [Vector(tuple(unit_dirs(*chart_az_el(np.array(x), np.array(y))))) for x, y in line]
        skin = [head.surf_dir(d)[0] for d in dirs]
        skin = smooth(resample(skin, STEP), 4)
        L = (len(skin) - 1) * STEP
        if L < 0.03:
            continue
        # braided from the front end to the back end (the braid hangs from the back end)
        if skin[0].y > skin[-1].y:
            skin = skin[::-1]
        rows.append((level, skin))
    level += SPACING
hairkit.log("rows", len(rows))

gray, height = hairkit.tex_braid(512, seed=71, lobes_u=2)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=4.0)
mats = [hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.013), roughness=0.55)]
b = hairkit.Builder(head)

W = math.radians(SPACING) * 0.095 * WIDTH  # ~ row width in metres (head radius ~9.5 cm)
rng = np.random.default_rng(5)


def lane_for(end):
    az, el = head.angles(end)
    if -118 <= az <= -62:  # round her right ear: in front of the right shoulder
        return -min(0.12, max(0.075, abs(end.x) + 0.01)), True
    return max(-0.12, min(0.12, end.x * 1.5)), False


for lv, r in rows:
    rr0 = W / 2
    pts, frames, rads, sqs, tips = [], [], [], [], []
    n_r = len(r)
    for i, p in enumerate(r):
        _s, q, nn = head.signed(p)
        L0 = i * STEP
        start = 0.55 + 0.45 * smoothstep(0.0, 0.015, L0)
        rr = rr0 * start
        pts.append(q + nn * rr * SQUASH * 0.45)
        frames.append(nn)
        rads.append(rr)
        sqs.append(SQUASH)
        tips.append(0.0)
    end = pts[-1]
    back = end.y > c.y - 0.02 or end.z < c.z - 0.03
    if back:
        lane, front = lane_for(end)
        g = longkit.front_gravity_long(head, lane) if front else head.lane_gravity(lane, front)
        tang = (pts[-1] - pts[-5]).normalized()
        _s, _q, n_end = head.signed(end)
        # leave the scalp along the row, eased towards the fall (no curl-back at the sideburn)
        gd = g(end)
        tang_s = tang - n_end * tang.dot(n_end)
        out = (tang_s * 0.45 + n_end * 0.25 + gd * 0.6).normalized()
        if tang.z > 0.1:  # a row that ends climbing (round the ear): start straight down the skin
            out = (gd - n_end * gd.dot(n_end) * 0.8).normalized()
        stop = (STOP_FRONT if front else STOP_BACK) + rng.uniform(-0.03, 0.03)
        hang = head.drape(end, out, 0.9, step=0.012, margin=0.0075, stiff=0.7, bend=0.06, gravity=g, stop_z=stop)
        nt = len(hang) - 1
        for i, p in enumerate(hang[1:], 1):
            t = i / nt
            pts.append(p)
            frames.append(None)
            k = min(1.0, t * 8)
            rads.append((rr0 + (BRAID_R - rr0) * k) * (1 - 0.35 * smoothstep(0.88, 1.0, t)))
            sqs.append(SQUASH + (1 - SQUASH) * k)
            tips.append(t)
    else:
        # ends on the front / side: tapers into the hairline (tucked)
        for i in range(1, 6):
            rads[-i] *= 0.55 + 0.09 * i
    rad_arr, sq_arr = np.array(rads), np.array(sqs)
    s_arr = np.linspace(0, 1, len(rad_arr))

    def radius(s, ra=rad_arr, sa=s_arr):
        return float(np.interp(s, sa, ra))

    def squash(s, qa=sq_arr, sa=s_arr):
        return float(np.interp(s, sa, qa))

    b.tube(pts, radius, sides=6, mat=0, frames=frames, lobes=2, lobe_amp=0.08, lobe_twist=2 * math.pi / 0.011, squash=squash,
           tip_curve=lambda i, ta=tips: ta[i], root=r[0])

obj = b.to_object(f"Hair_{STYLE}", mats)
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

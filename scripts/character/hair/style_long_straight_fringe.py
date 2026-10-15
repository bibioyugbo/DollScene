"""
Long straight wig with a full fringe: sleek, poker-straight hair to the lower back, with full, blunt
bangs that graze the brows.

  * Comb shell from a crown whorl (behind the top of the head) down to the hairline all round: no
    visible part (the bangs cover the front), thin lace-like edge at the hairline.
  * Fringe: two layers of short flat ribbons rooted on the front of the shell (between the crown
    and the forehead hairline), combed forwards over the hairline and down the forehead, cut
    blunt on a straight line just above the brows (curving slightly lower past the outer brow into
    the side pieces). The outer layer rides over the inner one: a dense, full bang.
  * Length: three layers of flat straight ribbons (higher roots outside). Side pieces from the
    temples fall in front of the shoulders and frame the face; the rest hang down the back in
    ordered lanes (|x| <= 0.12: no crossing the spine, clear of the lowered arms), cut nearly blunt
    at the lower back.
Material: "Hair" only. _strand per ribbon (shell 0); _section from the ribbon root.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flowkit  # noqa: E402
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
from flowkit import nlerp  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "long_straight_fringe"
CROWN = (180, 76)  # whorl: everything is combed away from here
FRINGE_AZ = 52  # the fringe covers |az| < FRINGE_AZ at the hairline
CUT_Z = 1.512  # blunt fringe line (brows top at ~1.504 on the base head)
STOP_BACK = 1.02  # lower back
STOP_FRONT = 1.10  # side pieces: below the bust
N_LINES = 96
N_SAMPLES = 26

head = hairkit.open_base()
D = head.dir
rng = np.random.default_rng(17)
gray, height = hairkit.tex_strands(1024, seed=41, wave=0.0, clumps=30)
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=1.4)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.02, 0.015, 0.012), tip_preview=(0.03, 0.022, 0.016), roughness=0.42)
b = hairkit.Builder(head)

M = D(*CROWN)


def lift(t):
    return 0.0065 - 0.0045 * smoothstep(0.55, 1.0, t)


def line_dirs(az, n=N_SAMPLES):
    h = D(az, head.hairline(az))
    return [nlerp(M, h, j / (n - 1)) for j in range(n)]


# ----------------------------------------------------------------------------- shell
lines = [line_dirs(-180 + 360 * i / N_LINES) for i in range(N_LINES)]
flowkit.comb_shell(head, b, lines, lift=lift, uv_tile=0.035, wrap=True)


# ----------------------------------------------------------------------------- straight ribbons
def root_on_shell(az, t):
    ds = line_dirs(az, 60)
    k = min(58, int(t * 59))
    p, nn = head.surf_dir(ds[k])
    q, _ = head.surf_dir(ds[k + 1])
    return p + nn * lift(t), (q - p).normalized()


def downhill(root):
    """Direction a strand leaves the scalp: down the slope of the skin (falls, never shoots forward)."""
    _s, _q, nn = head.signed(root)
    g = Vector((0, 0, -1))
    t = g - nn * g.dot(nn)
    if t.length < 1e-4:
        t = Vector((0, 0.3, -1)) - nn * Vector((0, 0.3, -1)).dot(nn)
    return (t.normalized() + nn * 0.25).normalized()


def by_arc(pts, n):
    """n points evenly spaced by arc length along pts."""
    s = [0.0]
    for p0, p1 in zip(pts, pts[1:]):
        s.append(s[-1] + (p1 - p0).length)
    out = []
    for j in range(n):
        goal = s[-1] * j / (n - 1)
        k = max(0, min(len(pts) - 2, int(np.searchsorted(s, goal) - 1)))
        t = (goal - s[k]) / max(s[k + 1] - s[k], 1e-9)
        out.append(pts[k].lerp(pts[k + 1], max(0.0, min(1.0, t))))
    return out


def curtain(paths, rows, roots, uv_tile=0.035):
    """Sheet through side-by-side paths (same order as across the head): rows samples each by arc
    length; _tip 0 at the root .. 1 at the end; U across (metres), V along."""
    cols = [by_arc(p, rows) for p in paths]
    nc = len(cols)
    us = [0.0]
    for i in range(1, nc):
        us.append(us[-1] + (cols[i][rows // 3] - cols[i - 1][rows // 3]).length)
    vs = []
    for col in cols:
        acc = [0.0]
        for p0, p1 in zip(col, col[1:]):
            acc.append(acc[-1] + (p1 - p0).length)
        vs.append(acc)
    grid_rows, grid_uvs = [], []
    for j in range(rows):
        row, uvr = [], []
        for i in range(nc):
            row.append(b.vert(cols[i][j], j / (rows - 1), section=head.section(roots[i])))
            uvr.append((us[i] / uv_tile, vs[i][j] / uv_tile))
        grid_rows.append(row)
        grid_uvs.append(uvr)
    b.grid(grid_rows, grid_uvs, mat=0)


LAYERS = (  # (root position along the comb line, extra clearance)
    (0.42, 0.012),
    (0.64, 0.006),
    (0.86, 0.0),
)
SPAN_FRONT = (FRINGE_AZ - 4, 90.0)  # side pieces (in front of the shoulders)
SPAN_BACK = (93.0, 180.0)
ROWS = 44


def lane_of(az):
    a = abs(az)
    s = 1 if az >= 0 else -1
    if a <= 91.5:
        t = (a - SPAN_FRONT[0]) / (SPAN_FRONT[1] - SPAN_FRONT[0])
        return s * (0.075 + 0.045 * t), True, None
    t = (180 - a) / (180 - SPAN_BACK[0])
    return s * (0.004 + 0.116 * t), False, 0.16 + 0.3 * (1 - smoothstep(93, 130, a))


def hang(az, t_root, extra, li):
    root, _tangent = root_on_shell(az, t_root)
    lane, front, lean = lane_of(az)
    stop = (STOP_FRONT if front else STOP_BACK) + 0.006 * li + rng.uniform(-0.004, 0.004)
    pts = flowkit.ribbon_path(head, root, downhill(root), 0.9, 0.0075, extra, lane, front, lean=lean, wave_amp=0.0, stop_z=stop)
    # end exactly on a nearly level cut
    if pts[-1].z < stop:
        p0, p1 = pts[-2], pts[-1]
        t = (p0.z - stop) / max(p0.z - p1.z, 1e-6)
        pts[-1] = p0.lerp(p1, max(0.0, min(1.0, t)))
    return root, pts


n_sheets = 0
for li, (t_root, extra) in enumerate(LAYERS):
    # front-left, back (left -> right round the back), front-right
    spans = [
        [SPAN_FRONT[0] + (SPAN_FRONT[1] - SPAN_FRONT[0]) * i / 15 for i in range(16)][::-1],
        [SPAN_BACK[0] + (180 - SPAN_BACK[0]) * i / 22 for i in range(23)] + [-(180 - (180 - SPAN_BACK[0]) * i / 22) for i in range(1, 23)],
        [-(SPAN_FRONT[0] + (SPAN_FRONT[1] - SPAN_FRONT[0]) * i / 15) for i in range(16)],
    ]
    for azs in spans:
        roots, paths = [], []
        for az in azs:
            r, pts = hang(max(-179.9, min(179.9, az)), t_root, extra, li)
            roots.append(r)
            paths.append(pts)
        curtain(paths, ROWS, roots)
        n_sheets += 1
hairkit.log("length sheets", n_sheets)


# ----------------------------------------------------------------------------- fringe
def fringe_gravity(x0):
    def g(p):
        # down the forehead; each column keeps its own x (straight, parallel bangs)
        return Vector(((x0 - p.x) * 3.0, -0.06, -1)).normalized()
    return g


def cut_z(x):
    return CUT_Z - 0.010 * smoothstep(0.045, 0.07, abs(x))


for li, (t_root, extra) in enumerate(((0.50, 0.0), (0.40, 0.0042))):
    roots, paths = [], []
    n = 34
    for i in range(n):
        u = i / (n - 1) * 2 - 1  # -1 .. 1 across the forehead
        az = u * (FRINGE_AZ + 2)
        root, tangent = root_on_shell(az, t_root)
        pts = flowkit.drape_layer(head, root, tangent, 0.2, 0.0048, extra + 0.0018, fringe_gravity(root.x * 1.12), step=0.005, stiff=0.95, bend=0.35)
        out = [pts[0]]
        for p0, p1 in zip(pts, pts[1:]):
            zc = cut_z(p1.x)
            if p1.z <= zc and p1.y < head.c.y - 0.04:
                t = (p0.z - zc) / max(p0.z - p1.z, 1e-6)
                out.append(p0.lerp(p1, max(0.0, min(1.0, t))))
                break
            out.append(p1)
        roots.append(root)
        paths.append(out)
    curtain(paths, 22, roots)
hairkit.log("fringe sheets", 2)

obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

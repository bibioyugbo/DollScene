"""
Braid-out (loose): the stretched, crimped, loosened state after taking braids down. A shoulder-
length fluffy volume (volkit.hanging_volume), bigger than the curls, with crimp displacement in
clumps (each loosened braid section zig-zags with its own phase) on a lumpy outline, and a crimped
strand texture. Opaque, closed. Material: "Hair" (tinted by the app).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import numpy as np  # noqa: E402
import shellkit  # noqa: E402
import volkit  # noqa: E402
from hairkit import smoothstep  # noqa: E402

STYLE = "braid_out"
COLS = 104
rng = np.random.default_rng(41)
phase = rng.uniform(0, 1, COLS // 4 + 1)
period = rng.uniform(0.014, 0.019, COLS // 4 + 1)
head = hairkit.open_base()

def crimp_texture(T=1024, n_clumps=14, crimps=5, seed=13):
    """Crimped fibres along V: the tile is split into clumps across U (the loosened braid
    sections); every clump zig-zags with its own phase and amplitude."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:T, 0:T] / T
    ci = np.floor(x * n_clumps).astype(int)
    ph = r.uniform(0, 1, n_clumps)[ci]
    amp = r.uniform(0.012, 0.022, n_clumps)[ci]
    zz = (y * crimps + ph) % 1.0
    zig = (2 * np.abs(zz - 0.5) * 2 - 1)
    xs = x + amp * zig
    fine = sum(np.sin(2 * math.pi * f * xs + k) for k, f in enumerate((83, 137, 199, 271))) / 4
    edge = np.abs(((x * n_clumps) % 1.0) - 0.5) * 2  # 0 clump centre .. 1 parting between clumps
    shade = 1 - 0.55 * edge ** 3
    # light catches the crimp peaks
    peak = 0.12 * np.cos(2 * math.pi * zz) * (1 - edge)
    g = 0.25 + 0.5 * shade + 0.14 * fine + peak + (hairkit.noise2((T, T), 10, seed=seed) - 0.5) * 0.15
    return hairkit.normalise_contrast(g, gamma=1.15), shade * 0.6 + fine * 0.15 + peak


gray, height = crimp_texture()
tex, nrm = hairkit.write_tex(STYLE, gray, height, strength=2.5)
mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.03, 0.02, 0.016), tip_preview=(0.05, 0.032, 0.022), roughness=0.8)


def thick_top(az, el):
    a = abs(((az + 180) % 360) - 180)
    return 0.034 + 0.018 * smoothstep(20, 100, a) + 0.01 * smoothstep(40, 85, el)


def hem_z(az):
    a = abs(((az + 180) % 360) - 180)
    # sides end resting just above the shoulders, the back falls a little lower
    rag = 0.008 * math.sin(math.radians(az) * 7 + 1.3) + 0.006 * math.sin(math.radians(az) * 13 + 0.4)
    return 1.395 - 0.09 * smoothstep(110, 165, a) + rag


def tri(x):
    return 2 * abs(x % 1.0 - 0.5) * 2 - 1  # -1..1 zigzag


def disp(p, i, s):
    k = i // 4
    crimp = 0.0045 * tri(s * 0.42 / period[k] + phase[k])
    return shellkit.lumps(p, [(0.04, 0.012), (0.016, 0.005)]) + crimp + 0.005


b = hairkit.Builder(head)
volkit.hanging_volume(head, b, thick_top, 0.034, hem_z, disp=disp, cols=COLS, n_cap=32, n_hang=22, n_hem=5, n_inner=12, spread=0.26, max_x=0.17, uv_tile=0.07)
obj = b.to_object(f"Hair_{STYLE}", [mat])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

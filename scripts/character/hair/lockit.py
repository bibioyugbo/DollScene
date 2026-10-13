"""
Locs family (locs, locs_retwist, microlocs, freeform_locs, faux_locs): one shared generator.

Layout (layout()): roots on a brick grid over the whole scalp (hairkit.scalp_roots), each loc
  * leaves the scalp along its normal (root sunk 2 mm into the skin, so it is attached),
  * drapes under gravity with a head margin that grows with root height (crown locs lie on top
    of lower ones: layering), and the clothing margin below the neck (hairkit.drape),
  * front locs (|az| < 70 and el < 45) are steered off the face to the temples and fall in
    front of the shoulders; all others fall down the back; every loc keeps its hanging lane
    (x from its root x, |x| <= 0.12) so nothing crosses the spine or lands on the lowered arms.
The layout depends only on (spacing, jitter, seed, ...), never on the root treatment, so
`locs` and `locs_retwist` share it strand for strand (same order -> same _strand ids).

Root treatments (only the first ROOT_ZONE metres of each loc + the scalp layer differ):
  * "fuzzy"  (locs): new growth - root 18 % thicker with a little random fibre wobble, plus a thin
               opaque new-growth layer over the scalp between the roots (soft parts),
  * "tight"  (locs_retwist): neat palm-rolled roots that narrow into the scalp, no scalp layer:
               crisp bare-scalp partings between sections.
"""

import math

import numpy as np
from mathutils import Vector

import hairkit
from hairkit import smoothstep

ROOT_ZONE = 0.03  # metres of each loc that the root treatment may change


def _face_gravity(head, lane, front, side, comb=False):
    """Lane gravity, plus above the jaw:
      * comb=True (centre-front roots): held back along the scalp over the front half of the head
        (combed back), so nothing falls over the forehead;
      * otherwise, in front of the face (|x| < 7.5 cm): swept sideways towards the temple;
      * a hug back towards the skull when a loc drifts wider than the head (no standing off)."""
    base = head.lane_gravity(lane, front, lean=-0.5 if front else None)
    c = head.c

    def g(p):
        v = base(p)
        if p.z > head.z_skull - 0.03:
            if comb and p.y < c.y + 0.03 and p.z > c.z - 0.02:
                return Vector((0.15 * side, 1.0, -0.2)).normalized()
            if p.y < c.y - 0.03 and abs(p.x) < 0.075:
                w = smoothstep(c.y - 0.03, c.y - 0.055, p.y)
                v = (v * (1 - w) + Vector((side, 0.35, -0.2)).normalized() * w).normalized()
            dx = -math.copysign(min(0.8, max(0.0, abs(p.x) - 0.075) * 25), p.x)
            v = Vector((v.x + dx, v.y, v.z)).normalized()
        return v

    return g


def resample(pts, z_fine, fine=0.011, coarse=0.03):
    """Re-space a path: `fine` while on the head (z > z_fine; smooth bends near the roots),
    `coarse` once hanging. The first point (root) is kept."""
    lens = arc(pts)
    out = [pts[0]]
    s = 0.0
    i = 0
    while True:
        st = fine if out[-1].z > z_fine else coarse
        s += st
        if s >= lens[-1]:
            break
        while lens[i + 1] < s:
            i += 1
        t = (s - lens[i]) / max(lens[i + 1] - lens[i], 1e-9)
        out.append(pts[i].lerp(pts[i + 1], t))
    if (pts[-1] - out[-1]).length > 0.004:
        out.append(pts[-1])
    else:
        out[-1] = pts[-1]
    return out


def layout(head, spacing=11.0, jitter=0.25, seed=21, radius=0.0042, r_var=0.08, stop_z=1.12, stop_var=0.03, step=0.02, margin0=None, layer=0.009, front_el=45.0, front_az=70.0, wavy=0.0, sweep_el=74.0):
    """Strand layout: list of dicts (root az/el, point, normal, radius, path, front, merge...)."""
    rng = np.random.default_rng(seed)
    roots = hairkit.scalp_roots(head, spacing_deg=spacing, jitter=jitter, seed=seed)
    strands = []
    for az, el in roots:
        p, n = head.surf(az, el)
        r = radius * (1 + rng.uniform(-r_var, r_var))
        sz = stop_z + rng.uniform(-stop_var, stop_var)
        hl = head.hairline(az)
        h = min(1.0, max(0.0, (el - hl) / max(89 - hl, 1)))
        m = (margin0 if margin0 is not None else r + 0.003) + layer * h
        front = abs(az) < front_az and el < front_el
        comb = abs(az) < 32 and el < 72  # centre-front: combed back over the head
        sweep = not comb and abs(az) < 75 and el < sweep_el  # lateral front: swept to the temples
        front = front and not comb
        side = 1.0 if az >= 0 else -1.0
        if comb:
            front = False
        if front:
            lane = side * (0.065 + 0.03 * min(1, abs(az) / front_az))
        else:
            lane = max(-0.12, min(0.12, p.x * 1.35))
        g = _face_gravity(head, lane, front, side, comb)
        # Sink the root ring by most of the loc's radius: the tube leaves the scalp at a slant, and a
        # shallow root left half its end disc above the skin (flat stubs along the hairline).
        root = p - n * max(0.002, r * 0.75)
        start = p + n * min(m, 0.005)
        # leave the scalp along it, towards the fall side (off the face for front locs, else back
        # and down), only a little outwards: no standing "palm tree" crowns
        F = Vector((0.1 * side, 1.0, 0.4)) if comb else (Vector((side * 1.0, 0.3, -0.3)) if sweep else Vector((p.x * 4.0, 0.8, -1.0)))
        t = F - n * F.dot(n)
        t = t.normalized() if t.length > 1e-4 else Vector((0, 1, 0))
        out = (t * 0.85 + n * 0.3).normalized()
        hang = head.drape(start, out, 1.0, step=0.008, margin=m, stiff=0.85, bend=0.05, gravity=g, stop_z=sz)
        pts = resample([root] + hang, head.z_skull - 0.02, fine=step * 0.5, coarse=step * 1.25)
        # round the bends on the head (sweeps off the forehead), then re-clear the head
        for _ in range(4):
            new = list(pts)
            for i in range(2, len(pts) - 1):
                if pts[i].z > head.z_skull - 0.04:
                    new[i] = pts[i] * 0.5 + (pts[i - 1] + pts[i + 1]) * 0.25
            pts = [new[0], new[1]] + [head.push_out(q, None, head_margin=m) for q in new[2:]]
        wide = [q for q in pts if q.z < head.z_neck + 0.03 and abs(q.x) > 0.13]
        if wide:
            hairkit.log("WIDE strand", len(strands), "az %.0f el %.0f front %s" % (az, el, front), "max|x| %.3f at z %.3f" % (max(abs(q.x) for q in wide), wide[0].z))
        if wavy > 0:  # gentle irregular wander (freeform), zero at the root
            ph = rng.uniform(0, 6.28, 2)
            fq = rng.uniform(7, 12)
            L = 0.0
            for i in range(2, len(pts)):
                L += (pts[i] - pts[i - 1]).length
                k = smoothstep(0.03, 0.12, L) * wavy
                pts[i] = head.push_out(pts[i] + Vector((math.sin(L * fq + ph[0]), math.cos(L * fq * 0.7 + ph[1]) * 0.5, 0)) * k, None, head_margin=m)
        strands.append({"az": az, "el": el, "p": p, "n": n, "r": r, "pts": pts, "front": front, "margin": m, "rng": float(rng.uniform())})
    hairkit.log("loc layout", len(strands), "strands")
    return strands


def pick_merges(strands, frac=0.12, seed=3, max_d=0.03):
    """Freeform: some locs join a neighbour (child -> partner, partner earlier in the list)."""
    rng = np.random.default_rng(seed)
    used = set()
    out = {}
    for i, st in enumerate(strands):
        if st["front"] or i in used or rng.random() > frac:
            continue
        best, bd = None, max_d
        for j in range(i):
            if j in used or strands[j]["front"]:
                continue
            d = (strands[j]["p"] - st["p"]).length
            if d < bd:
                best, bd = j, d
        if best is not None:
            out[i] = best
            used.update((i, best))
    hairkit.log("merges", len(out))
    return out


def arc(pts):
    s = [0.0]
    for a, b in zip(pts, pts[1:]):
        s.append(s[-1] + (b - a).length)
    return s


def build_strands(head, b, strands, root="fuzzy", sides=6, taper=0.06, tip_r=0.8, wrap_end=None, seed=5, mat=0, merges=None, r_fn=None):
    """Tubes for a layout. root: "fuzzy" | "tight" | "plain". taper: fraction of length tapering
    to tip_r at the end. wrap_end: (fraction, radius scale) tapered wrapped end (faux locs).
    merges: {child_index: partner_index} - the child loc joins its partner and ends inside it.
    r_fn(i, s) -> radius multiplier along the loc (freeform irregularity)."""
    frng = np.random.default_rng(seed)  # root fuzz only: never touches the layout
    merges = merges or {}
    for idx, st in enumerate(strands):
        pts = list(st["pts"])
        if idx in merges:
            q = strands[merges[idx]]["pts"]
            n = min(len(pts), len(q))
            cut = max(4, int(n * 0.4))
            pts = [pts[i].lerp(q[i], smoothstep(0.1, 0.32, i / n)) for i in range(cut)]
        lens = arc(pts)
        L = max(lens[-1], 1e-4)
        z = ROOT_ZONE / L
        r0 = st["r"]

        def radius(s, r0=r0, z=z, idx=idx):
            r = r0
            if r_fn:
                r *= r_fn(idx, s)
            # every root narrows where it enters the scalp, so no flat end shows at a slanted exit
            into = 0.45 + 0.55 * smoothstep(0, z * 0.3, s)
            if root == "fuzzy":
                r *= (1 + 0.18 * (1 - smoothstep(0, z, s))) * into
            elif root == "tight":
                r *= (0.86 + 0.14 * smoothstep(0, z * 0.5, s)) * into  # neat, palm-rolled
            else:
                r *= into
            if wrap_end:
                f, k = wrap_end
                r *= 1 - (1 - k) * smoothstep(1 - f, 1.0, s)
            else:
                r *= 1 - (1 - tip_r) * smoothstep(1 - taper, 1.0, s)
            return r

        wob = None
        if root == "fuzzy":
            amps = frng.uniform(-1, 1, (len(pts), sides, 3)) * 0.0007

            def wob(i, k, amps=amps, lens=lens):
                w = 1 - smoothstep(ROOT_ZONE * 0.4, ROOT_ZONE, lens[i])
                return Vector(amps[i, k]) * w

        tips = [l / L for l in lens]
        b.tube(pts, radius, sides=sides, mat=mat, wobble=wob, tip_curve=lambda i, t=tips: t[min(i, len(t) - 1)], root=st["p"])


def scalp_layer(head, b, lift=0.0022, cols=72, rows=16, mat=0, uv_tile=0.03):
    """Thin opaque new-growth layer over the whole scalp (soft parts between loc roots).
    Edge tucks to 0.6 mm at the hairline; _tip 0; _section per vertex."""
    grid = []
    uvs = []
    for j in range(rows + 1):
        t = j / rows
        row, uvr = [], []
        for i in range(cols):
            az = -180 + 360 * i / cols
            hl = head.hairline(az) + 0.6
            el = hl + (89.4 - hl) * t
            p, n = head.surf(az, el)
            lf = 0.0006 + (lift - 0.0006) * smoothstep(0, 0.12, t)
            row.append(b.vert(p + n * lf, 0.0))
            uvr.append((i * 6.0 / cols, t * 8))
        grid.append(row)
        uvs.append(uvr)
    pole_p, pole_n = head.surf(0, 90)
    pole = b.vert(pole_p + pole_n * lift, 0.0)
    grid.append([pole] * cols)
    uvs.append([(i * 6.0 / cols, 8.2) for i in range(cols)])
    b.grid(grid, uvs, mat=mat, wrap_u=6.0)


def wrap_texture(T=512, seed=13, wraps=6, sheen=0.25):
    """Faux locs: neat wrapped surface (diagonal wraps) over a light felt."""
    gray_f, h_f = hairkit.tex_loc(T, seed=seed, fuzz=0.35, crevice=0.25)
    y, x = np.mgrid[0:T, 0:T] / T
    band = (np.sin(2 * math.pi * (x + y * wraps)) * 0.5 + 0.5) ** 0.6
    g = 0.25 + band * 0.55 + gray_f * 0.25 + sheen * band ** 6
    return hairkit.normalise_contrast(g, gamma=1.1), band * 0.8 + h_f * 0.2


def finish_style(style, head, b, roughness=0.8, tex=None):
    gray, height = tex
    tp, nrm = hairkit.write_tex(style, gray, height, strength=3.0)
    mat = hairkit.hair_material("Hair", tp, nrm, preview=(0.025, 0.018, 0.015), tip_preview=(0.035, 0.025, 0.02), roughness=roughness)
    obj = b.to_object(f"Hair_{style}", [mat])
    hairkit.skin(obj, head)
    return obj, hairkit.finish(style, obj, head)


# The one shared medium-locs layout (locs + locs_retwist).
LOCS = dict(spacing=11.5, jitter=0.25, seed=21, radius=0.0057, r_var=0.08, stop_z=1.12, stop_var=0.03, step=0.032, sweep_el=52.0)
LOCS_SIDES = 5

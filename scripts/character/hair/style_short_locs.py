"""Short locs: starter / short dreadlocs, ear-to-jaw length (6-10 cm). Many even, pencil-width
cylindrical locs from a neat brick grid of parts over the whole scalp. Slightly springy: they
leave the scalp at an angle and stand out a little at the crown, then flop outwards and down
over the sides and back; the front locs lift up and back off the forehead (face stays clear).
Nothing reaches the shoulders. Shares lockit's tube builder, root treatment and scalp layer."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import lockit  # noqa: E402
import numpy as np  # noqa: E402
from hairkit import smoothstep  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "short_locs"
SPACING = 10.0
RADIUS = 0.0036
LAYER = 0.012


class SideField:
    """Collision for the sides of the head around the ears. The ear is thin: find_nearest lands on
    its back face (normal pointing into the head), so push_out drags locs falling past the ear
    inwards and they kink round the rim. Here the outer skin |x| is ray-cast on a (y, z) grid from
    each side, dilated and blurred into a smooth bump, and points in that box are pushed outwards
    along x only (the locs slide smoothly over the ear)."""

    Y0, Y1, Z0, Z1, D = -0.085, 0.045, 1.40, 1.56, 0.003

    def __init__(self, head):
        ys = np.arange(self.Y0, self.Y1 + 1e-9, self.D)
        zs = np.arange(self.Z0, self.Z1 + 1e-9, self.D)
        self.f = {}
        for sgn in (1.0, -1.0):
            g = np.zeros((len(zs), len(ys)))
            for i, z in enumerate(zs):
                for j, y in enumerate(ys):
                    hit, _n, _i, _d = head.bvh.ray_cast(Vector((0.3 * sgn, y, z)), Vector((-sgn, 0, 0)), 0.3)
                    g[i, j] = abs(hit.x) if hit is not None else 0.0
            # dilate 2 cells, then blur: a smooth hull over the ear
            pad = np.pad(g, 2, mode="edge")
            d = np.max([pad[di:di + len(zs), dj:dj + len(ys)] for di in range(5) for dj in range(5)], axis=0)
            self.f[sgn] = hairkit.blur(d, 2)
        self.ny, self.nz = len(ys), len(zs)

    def x_at(self, q):
        """Outer skin |x| on q's side at (q.y, q.z), or None outside the box (and a 0..1 weight
        that fades the box out at its edges)."""
        fy = (q.y - self.Y0) / self.D
        fz = (q.z - self.Z0) / self.D
        if not (0 <= fy < self.ny - 1 and 0 <= fz < self.nz - 1) or abs(q.x) < 0.045:
            return None, 0.0
        g = self.f[1.0 if q.x >= 0 else -1.0]
        j, i = int(fy), int(fz)
        ty, tz = fy - j, fz - i
        x = (g[i, j] * (1 - ty) + g[i, j + 1] * ty) * (1 - tz) + (g[i + 1, j] * (1 - ty) + g[i + 1, j + 1] * ty) * tz
        e = 4.0
        w = min(fy, self.ny - 1 - fy, fz, self.nz - 1 - fz) / e
        return x, min(1.0, w)


def make_push(head, side_field):
    def push(q, head_margin):
        x, w = side_field.x_at(q)
        if w >= 1.0:
            m = head.margin_at(q, head_margin)
            if abs(q.x) < x + m:
                return Vector((math.copysign(x + m, q.x), q.y, q.z))
            return q
        p = head.push_out(q, None, head_margin=head_margin)
        if w > 0 and abs(q.x) < x + head_margin:
            p = p.lerp(Vector((math.copysign(x + head.margin_at(q, head_margin), q.x), q.y, q.z)), w)
        return p
    return push


def drape(head, push, root, out_dir, length, step, margin, stiff, gravity, bend, iters=3):
    """head.drape with the ear-safe push."""
    pts = [Vector(root)]
    d = Vector(out_dir).normalized()
    n = max(2, int(length / step))
    for i in range(n):
        t = i / n
        w = stiff * math.exp(-t / max(bend, 1e-3))
        g = gravity(pts[-1]) if callable(gravity) else gravity
        d = (d * w + g * (1 - w)).normalized()
        p = pts[-1] + d * step
        for _ in range(iters):
            p = push(p, margin)
        seg = p - pts[-1]
        if seg.length > 1e-6:
            p = pts[-1] + seg.normalized() * step
            d = seg.normalized()
        pts.append(p)
    return pts


def short_layout(head, spacing=SPACING, jitter=0.15, seed=77, radius=RADIUS, r_var=0.06, layer=LAYER, step=0.004):
    rng = np.random.default_rng(seed)
    roots = hairkit.scalp_roots(head, spacing_deg=spacing, jitter=jitter, seed=seed)
    push = make_push(head, SideField(head))
    strands = []
    for az, el in roots:
        p, n = head.surf(az, el)
        r = radius * (1 + rng.uniform(-r_var, r_var))
        hl = head.hairline(az)
        h = min(1.0, max(0.0, (el - hl) / max(89 - hl, 1)))  # 0 at the hairline .. 1 at the crown
        m = r + 0.003 + layer * h
        a = abs(az)
        side = 1.0 if az >= 0 else -1.0
        front = a < 55 and el < 70  # forehead locs: a little shorter
        # length: crown longest, front and nape shorter
        L = 0.075 + 0.012 * h
        if front:
            L = 0.055 + 0.01 * h
        if a > 120 and el < 0:
            L = 0.062
        L *= 1 + rng.uniform(-0.08, 0.08)
        radial = Vector((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0.0))
        # flop direction: radial from the crown, except in front of the ears where it turns to the
        # side and back (centre part; nothing flops forward over the face)
        fz = smoothstep(80.0, 60.0, a)  # 1 in front of the temples
        az_f = side * (a + (80.0 + 0.5 * (70.0 - min(a, 70.0)) - a) * fz) if fz > 0 else az
        flop = Vector((math.sin(math.radians(az_f)), -math.cos(math.radians(az_f)), 0.0))
        F = flop + Vector((0, 0, 0.3 * fz - 0.3 * (1 - fz)))
        # over the ears: flare out a little more so the locs clear the ear instead of kinking round it
        ez = smoothstep(55.0, 72.0, a) * smoothstep(125.0, 108.0, a) * smoothstep(30.0, 10.0, el)
        g = (Vector((0, 0.1 + 0.2 * fz, -1.0)) + flop * (0.18 + 0.25 * fz + 0.3 * ez)).normalized()
        spring = 30.0 + 35.0 * h + 5.0 * fz + 15.0 * ez
        t = F - n * F.dot(n)
        t = t.normalized() if t.length > 1e-4 else radial
        sa = math.radians(spring)
        out = (t * math.cos(sa) + n * math.sin(sa)).normalized()
        root = p - n * max(0.002, r * 0.75)
        start = p + n * 0.002
        hang = drape(head, push, start, out, L, step, m, 0.96, g, 0.5)
        pts = lockit.resample([root] + hang, -1.0, fine=0.007, coarse=0.007)
        for _ in range(5):
            new = list(pts)
            for i in range(2, len(pts) - 1):
                new[i] = pts[i] * 0.5 + (pts[i - 1] + pts[i + 1]) * 0.25
            pts = [new[0], new[1]] + [push(q, min(m, r + 0.0015 + (m - r) * smoothstep(0.0, 0.03, (q - pts[0]).length))) for q in new[2:]]
        strands.append({"az": az, "el": el, "p": p, "n": n, "r": r, "pts": pts, "front": front, "margin": m, "rng": float(rng.uniform())})
    hairkit.log("short layout", len(strands), "strands", sum(s["front"] for s in strands), "front")
    return strands


head = hairkit.open_base()
hairkit.log("c", tuple(round(x, 4) for x in head.c), "z_skull", round(head.z_skull, 4), "z_neck", round(head.z_neck, 4))
strands = short_layout(head)
b = hairkit.Builder(head)
lockit.build_strands(head, b, strands, root="tight", sides=6, taper=0.12, tip_r=0.75)
lockit.scalp_layer(head, b, lift=0.0016)
lockit.finish_style(STYLE, head, b, roughness=0.85, tex=hairkit.tex_loc(512, seed=83, fuzz=0.8, crevice=0.5))

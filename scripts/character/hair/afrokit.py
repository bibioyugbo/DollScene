"""
Afros (afro_short, afro_big): one opaque, closed coil volume per style (shellkit.cap_volume).

  * The edge tucks into the hairline 2.5 mm off the skin and the outer surface swells from it over
    `ramp` degrees: no brim, no floating, no alpha see-through. At the sides the volume hangs a
    little below the hairline and drapes over the ears from outside (pushed 4 mm clear).
  * Silhouette: an ellipsoid (centre/radii per style) broken up by two octaves of 3D noise
    (coil clumps) so the outline is rounded but softly irregular.
  * Texture: tight coils with deep crevices (normalise_contrast, gamma 1.6) so a near-black tint
    (#0A0A0C) reads black, not grey. _tip 0 at the scalp edge .. 1 on the outer surface.
"""

import os

from mathutils import Vector

import hairkit
import shellkit
from hairkit import smoothstep


def build(style, oc_off, radii, drop_side, drop_back, ramp, lumps, cols=150, rows_out=60, seed=7, hug_back=0.6, drop_front=0.0, front_width=55.0):
    """ramp = (front, side, back) degrees over which the volume swells from its edge."""
    head = hairkit.open_base()
    c = head.c
    oc = c + Vector(oc_off)
    orad = Vector(radii)

    def outer(az, el, d, rs):
        r = shellkit.ellipsoid_radius(c, oc, orad, d)
        p = c + d * r
        return r + shellkit.lumps(p, lumps)

    def drop(az):
        a = abs(((az + 180) % 360) - 180)
        side = smoothstep(40, 75, a) * (1 - smoothstep(115, 150, a))
        back = smoothstep(115, 150, a)
        # a fringe: the front edge comes down over the forehead (0 = the usual hairline)
        front = 1 - smoothstep(front_width * 0.6, front_width, a)
        return drop_side * side + drop_back * back + drop_front * front

    def ramp_at(az):
        a = abs(((az + 180) % 360) - 180)
        f, s, k = ramp
        return f + (s - f) * smoothstep(30, 80, a) + (k - s) * smoothstep(110, 160, a)

    def hug(az):
        a = abs(((az + 180) % 360) - 180)
        return hug_back * smoothstep(95, 150, a)

    gray, height = hairkit.tex_coil(1024, seed=seed, n=6400, dark=True)
    tex, nrm = hairkit.write_tex(style, gray, height, strength=2.2)
    stale = os.path.join(hairkit.TEX_DIR, f"{style}_fuzz.png")
    if os.path.exists(stale):
        os.remove(stale)
    mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.012, 0.011, 0.012), tip_preview=(0.014, 0.012, 0.013), roughness=0.9)
    b = hairkit.Builder(head)
    shellkit.cap_volume(head, b, outer, drop, ramp=ramp_at, hug=hug, cols=cols, rows_out=rows_out, uv_tile=0.045)
    obj = b.to_object(f"Hair_{style}", [mat])
    hairkit.skin(obj, head)
    return hairkit.finish(style, obj, head)

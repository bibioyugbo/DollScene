"""Satin sleep bonnet (the morning look): a smooth, slightly puffy closed volume sized to hold even
the big afro, with a gathered elastic band along the hairline. Worn instead of showing the hair
(the app hides the hairstyle while the bonnet is on). Material "Satin" keeps its own colour.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hairkit  # noqa: E402
import shellkit  # noqa: E402
from mathutils import Vector  # noqa: E402

STYLE = "bonnet"
head = hairkit.open_base()
c = head.c
oc = c + Vector((0.0, 0.016, 0.034))
orad = Vector((0.205, 0.2, 0.188))


def outer(az, el, d, rs):
    r = shellkit.ellipsoid_radius(c, oc, orad, d)
    # soft satin folds: low, broad ripples around the crown
    return r + 0.004 * math.sin(math.radians(az) * 9 + el * 0.05) * (0.4 + 0.6 * max(0.0, math.sin(math.radians(el))))


satin = hairkit.accent_material("Satin", color=(0.78, 0.36, 0.52), metallic=0.0, roughness=0.32)
b = hairkit.Builder(head)
shellkit.cap_volume(head, b, outer, lambda az: 4.0, ramp=24.0, cols=96, rows_out=36, uv_tile=0.08, tip_mode="outer")

# elastic band: a gathered tube just outside the hairline edge
band = []
for i in range(121):
    az = -180 + 360 * i / 120
    p, n = head.surf(az, head.hairline(az) - 1.5)
    band.append(head.push_out(p + n * 0.006, 0.006))
b.tube(band, 0.0055, sides=8, mat=0, lobes=40, lobe_amp=0.0012, cap=False)

obj = b.to_object(f"Hair_{STYLE}", [satin])
hairkit.skin(obj, head)
hairkit.finish(STYLE, obj, head)

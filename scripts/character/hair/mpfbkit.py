"""
MPFB library hair (CC0 MakeHuman assets) fitted to the base female and prepared like the
hand-built styles, so every shipped hair GLB carries the same attributes:

  * fitted + skinned by MPFB (add_mhclo_asset on the rigged base),
  * anything hanging below the skull is pushed out to clear the posed body (arms lowered) by the
    clothing margin; the push is spread over a 3 cm neighbourhood so layered cards move together
    and keep their order,
  * _tip from distance off the skin and drop below the crown (as build_character.py does for
    library hair), _strand 0, _section from each vertex's direction,
  * texture made tint-ready (grayscale, luminance 0.62, alpha kept) into art/hair_tex/<id>.png
    (+ _n.png when the asset has a normal map); one material "Hair".
"""

import os

import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

import hairkit


def _cards_over_body(obj, head, head_margin=0.004, radius=0.03, iters=3):
    me = obj.data
    mw = obj.matrix_world
    inv = mw.inverted()
    for _ in range(iters):
        co = [mw @ v.co for v in me.vertices]
        push = []
        for p in co:
            if p.z > head.z_skull + 0.03:
                push.append(Vector())
                continue
            s, _q, n = head.signed(p)
            need = head.margin_at(p, head_margin) - s
            push.append(n * need if need > 0 else Vector())
        idx = [i for i, v in enumerate(push) if v.length > 1e-5]
        if not idx:
            break
        kd = KDTree(len(idx))
        for k, i in enumerate(idx):
            kd.insert(co[i], k)
        kd.balance()
        moved = 0
        for i, p in enumerate(co):
            best = Vector()
            for _c, k, d in kd.find_range(p, radius):
                w = 1 - d / radius
                v = push[idx[k]] * w
                if v.length > best.length:
                    best = v
            if push[i].length > best.length:
                best = push[i]
            if best.length > 1e-5:
                me.vertices[i].co = inv @ (p + best)
                moved += 1
        hairkit.log("cards pushed", moved)
    me.update()


def build(style, source, push=True):
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService

    head = hairkit.open_base()
    folder = os.path.join(LocationService.get_user_data(), "hair", source)
    obj = HumanService.add_mhclo_asset(os.path.join(folder, source + ".mhclo"), head.body, asset_type="Hair", subdiv_levels=0)
    obj.name = obj.data.name = f"Hair_{style}"
    obj["dollscene_source"] = f"mpfb:{source}"
    for m in list(obj.modifiers):
        if m.type not in ("ARMATURE",):
            obj.modifiers.remove(m)
    if push:
        _cards_over_body(obj, head)
    # _tip: off the skin + drop below the crown (same recipe as build_character.py for library hair)
    co = np.array([obj.matrix_world @ v.co for v in obj.data.vertices])
    kd = KDTree(int(head.in_body.sum()))
    for k, i in enumerate(np.nonzero(head.in_body)[0]):
        kd.insert(head.posed[i], k)
    kd.balance()
    off = np.array([kd.find(p)[2] for p in co])
    drop = co[:, 2].max() - co[:, 2]
    tip = np.clip(0.35 * off / max(np.percentile(off, 95), 1e-4) + 0.65 * drop / max(drop.max(), 1e-4), 0, 1)
    hairkit.shell_attrs(obj, head, tip)
    # texture
    diff = os.path.join(folder, f"{source}_diffuse.png")
    tex = hairkit.tint_ready(diff, os.path.join(hairkit.TEX_DIR, f"{style}.png"), 1024)
    nsrc = os.path.join(folder, f"{source}_normal.png")
    nrm = None
    if os.path.exists(nsrc):
        img = bpy.data.images.load(nsrc)
        img.colorspace_settings.name = "Non-Color"
        if img.size[0] > 1024:
            img.scale(1024, 1024)
        nrm = os.path.join(hairkit.TEX_DIR, f"{style}_n.png")
        img.filepath_raw = nrm
        img.file_format = "PNG"
        img.save()
    else:
        stale = os.path.join(hairkit.TEX_DIR, f"{style}_n.png")
        if os.path.exists(stale):
            os.remove(stale)
    mat = hairkit.hair_material("Hair", tex, nrm, preview=(0.03, 0.022, 0.02), roughness=0.6)
    t = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image.filepath.endswith(f"{style}.png"))
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    mat.node_tree.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
    mat.surface_render_method = "DITHERED"
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return hairkit.finish(style, obj, head)

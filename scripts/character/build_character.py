"""
DollScene studio character build (Blender 4.2+ with the MPFB 2 extension and the
MakeHuman CC0 system asset pack installed in MPFB's user data folder).

    /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/character/build_character.py -- <out_dir>

Produces (in <out_dir>):
    body.glb                 skinned adult female base: Body (Skin), Eyes, Brows_*, Lashes_* with morph targets
    hair/<id>.glb            hair modules on the same skeleton
    outfits/<id>.glb         clothing modules on the same skeleton, with body morph targets
    masks/face_a.png ...     UV-space makeup masks (see character.json "faceRect")
    masks/hide_<id>.png      UV-space body-hide mask for each outfit (skin under clothes is discarded)
    eyes/<id>.png            iris textures
    character.json           morph list, asset lists and texture metadata the app reads

Every source asset is MakeHuman/MPFB data released as CC0. The output is CC0 too.
Morphs follow docs/ASSET_SPEC.md: the base mesh is the 0.5 neutral of each slider,
"<Name>_Neg" / "<Name>_Pos" hold the extremes.
"""

import json
import math
import os
import re
import sys

import addon_utils
import bmesh
import bpy
import numpy as np

addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True)

from bl_ext.blender_org.mpfb.entities.objectproperties import HumanObjectProperties  # noqa: E402
from bl_ext.blender_org.mpfb.services.clothesservice import ClothesService  # noqa: E402
from bl_ext.blender_org.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.blender_org.mpfb.services.locationservice import LocationService  # noqa: E402
from bl_ext.blender_org.mpfb.services.targetservice import TargetService  # noqa: E402

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "character-out")
TARGETS = LocationService.get_mpfb_data("targets")
ASSETS = LocationService.get_user_data()

# ----------------------------------------------------------------------------- what to build

MACROS = {
    "gender": 0.0,  # female
    "age": 0.5,  # 25 years: always an adult
    "muscle": 0.5,
    "weight": 0.55,
    "proportions": 0.75,
    "height": 0.5,
    "cupsize": 0.5,
    "firmness": 0.55,
    "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0},
}

# Each slider: (negative recipe, positive recipe). A recipe is a list of ("target", weight)
# or ("macro:<name>", value) entries. Bilateral targets list both sides.
def lr(name, w=1.0):
    return [(f"l-{name}", w), (f"r-{name}", w)]


FACE_MORPHS = {
    "NoseWidth": ([("nose-scale-horiz-decr", 1), ("nose-flaring-decr", 0.6)], [("nose-scale-horiz-incr", 1), ("nose-flaring-incr", 0.6)]),
    "NoseBridge": ([("nose-width1-decr", 1)], [("nose-width1-incr", 1)]),
    "NoseTip": ([("nose-point-down", 1)], [("nose-point-up", 1)]),
    "NoseLength": ([("nose-scale-vert-decr", 1)], [("nose-scale-vert-incr", 1)]),
    "Lips": ([("mouth-upperlip-volume-decr", 1), ("mouth-lowerlip-volume-decr", 1)], [("mouth-upperlip-volume-incr", 1), ("mouth-lowerlip-volume-incr", 1)]),
    "LipWidth": ([("mouth-scale-horiz-decr", 1)], [("mouth-scale-horiz-incr", 1)]),
    "CupidsBow": ([("mouth-cupidsbow-decr", 1)], [("mouth-cupidsbow-incr", 1)]),
    "Jaw": ([("chin-bones-decr", 1)], [("chin-bones-incr", 1)]),
    "Chin": ([("chin-prominent-decr", 1)], [("chin-prominent-incr", 1)]),
    "ChinWidth": ([("chin-width-decr", 1)], [("chin-width-incr", 1)]),
    "Cheekbones": (lr("cheek-bones-decr"), lr("cheek-bones-incr")),
    "Cheeks": (lr("cheek-volume-decr"), lr("cheek-volume-incr")),
    "Forehead": ([("forehead-scale-vert-decr", 1)], [("forehead-scale-vert-incr", 1)]),
    "EyeSize": (lr("eye-scale-decr"), lr("eye-scale-incr")),
    "EyeSpacing": (lr("eye-trans-in"), lr("eye-trans-out")),
    "EyeOpen": (lr("eye-height2-decr"), lr("eye-height2-incr")),
    "Brows": ([("eyebrows-trans-down", 1)], [("eyebrows-trans-up", 1)]),
    "BrowAngle": ([("eyebrows-angle-down", 1)], [("eyebrows-angle-up", 1)]),
    "FaceFull": ([("head-fat-decr", 1)], [("head-fat-incr", 1)]),
    "FaceLength": ([("head-scale-vert-decr", 1)], [("head-scale-vert-incr", 1)]),
}

BODY_MORPHS = {
    "Shoulders": ([("measure-shoulder-dist-decr", 1)], [("measure-shoulder-dist-incr", 1)]),
    "Bust": ([("macro:cupsize", 0.0)], [("macro:cupsize", 1.0)]),
    "BustLift": ([("breast-trans-down", 1)], [("breast-trans-up", 1)]),
    "Waist": ([("measure-waist-circ-decr", 1)], [("measure-waist-circ-incr", 1)]),
    "Belly": ([("stomach-pregnant-decr", 1)], [("stomach-pregnant-incr", 0.45)]),
    "Hips": ([("measure-hips-circ-decr", 1), ("hip-scale-horiz-decr", 0.4)], [("measure-hips-circ-incr", 1), ("hip-scale-horiz-incr", 0.4)]),
    "Glutes": ([("buttocks-volume-decr", 1)], [("buttocks-volume-incr", 1)]),
    "Thighs": ([("measure-thigh-circ-decr", 1)], [("measure-thigh-circ-incr", 1)]),
    "Arms": (lr("upperarm-fat-decr"), lr("upperarm-fat-incr")),
    "Softness": ([("macro:weight", 0.15)], [("macro:weight", 0.95)]),
    "Muscle": ([("macro:muscle", 0.2)], [("macro:muscle", 0.85)]),
}

EYES = ["brown", "brownlight", "green", "grey", "bluegreen"]
BROWS = ["eyebrow001", "eyebrow006", "eyebrow010"]
LASHES = ["eyelashes01", "eyelashes02", "eyelashes03"]
HAIR = {
    "afro01": "Afro",
    "short02": "Short natural",
    "bob02": "Silk-press bob",
    "long01": "Long straight wig",
    "ponytail01": "Sleek ponytail",
    "braid01": "Single braid",
}
OUTFITS = {
    "female_sportsuit01": "Studio set",
    "female_casualsuit01": "Weekend casual",
    "female_casualsuit02": "Denim day",
    "female_elegantsuit01": "Evening",
}
SHOES = {"shoes01": "Sneakers", "shoes03": "Flats", "shoes06": "Heels"}
MORPH_EPS = 0.0008  # metres; a mesh only gets a morph that moves it more than this

# ----------------------------------------------------------------------------- helpers

def log(*a):
    print("[dollscene]", *a, flush=True)


def target_path(name):
    for root, _dirs, files in os.walk(TARGETS):
        if name + ".target.gz" in files:
            return os.path.join(root, name + ".target.gz")
    raise FileNotFoundError(name)


def mhclo(kind, name):
    p = os.path.join(ASSETS, kind, name, name + ".mhclo")
    if not os.path.exists(p):
        alt = [f for f in os.listdir(os.path.join(ASSETS, kind, name)) if f.endswith(".mhclo")]
        p = os.path.join(ASSETS, kind, name, alt[0])
    return p


def mhmat_textures(folder):
    """diffuse/normal texture paths named in the .mhmat files of an asset folder."""
    out = {}
    for f in os.listdir(folder):
        if not f.endswith(".mhmat"):
            continue
        for line in open(os.path.join(folder, f), encoding="utf-8", errors="ignore"):
            m = re.match(r"\s*(diffuseTexture|normalmapTexture|aomapTexture)\s+(\S+)", line)
            if m:
                out.setdefault(m.group(1), os.path.join(folder, os.path.basename(m.group(2))))
    return out


def coords(obj, mix=True):
    """Current vertex positions (shape keys mixed in) as an (n, 3) array."""
    if mix and obj.data.shape_keys:
        k = obj.shape_key_add(name="__mix", from_mix=True)
        a = np.empty(len(k.data) * 3, dtype=np.float64)
        k.data.foreach_get("co", a)
        obj.shape_key_remove(k)
    else:
        a = np.empty(len(obj.data.vertices) * 3, dtype=np.float64)
        obj.data.vertices.foreach_get("co", a)
    return a.reshape(-1, 3)


def set_macro(basemesh, name, value):
    HumanObjectProperties.set_value(name, value, entity_reference=basemesh)
    TargetService.reapply_macro_details(basemesh)


def deselect_all():
    for o in bpy.context.view_layer.objects:
        o.select_set(False)


def activate(obj):
    deselect_all()
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ----------------------------------------------------------------------------- 1. human, rig, assets

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

log("creating human")
human = HumanService.create_human(macro_detail_dict=MACROS)
rig = HumanService.add_builtin_rig(human, "mixamo", import_weights=True)

assets = {}  # key -> object


def add(kind, name, asset_type, key):
    obj = HumanService.add_mhclo_asset(mhclo(kind, name), human, asset_type=asset_type, subdiv_levels=0)
    assets[key] = obj
    obj.data.name = key
    return obj


add("eyes", "high-poly", "Eyes", "Eyes")
for b in BROWS:
    add("eyebrows", b, "Eyebrows", f"Brows_{b}")
for l in LASHES:
    add("eyelashes", l, "Eyelashes", f"Lashes_{l}")
for h in HAIR:
    add("hair", h, "Hair", f"Hair_{h}")
for c in OUTFITS:
    add("clothes", c, "Clothes", f"Outfit_{c}")
for s in SHOES:
    add("clothes", s, "Clothes", f"Shoes_{s}")

# ----------------------------------------------------------------------------- 2. morph deltas

loaded = {}


def apply_recipe(recipe):
    for name, w in recipe:
        if name.startswith("macro:"):
            set_macro(human, name[6:], w)
        else:
            if name not in loaded:
                loaded[name] = TargetService.load_target(human, target_path(name), weight=0.0, name="dsk_" + name)
            loaded[name].value = w


def clear_recipe(recipe):
    for name, _w in recipe:
        if name.startswith("macro:"):
            m = name[6:]
            set_macro(human, m, MACROS[m])
        else:
            loaded[name].value = 0.0


def refit_assets():
    for obj in assets.values():
        ClothesService.fit_clothes_to_human(obj, human, set_parent=False)


refit_assets()
neutral_body = coords(human)
neutral_assets = {k: coords(o, mix=False) for k, o in assets.items()}
deltas = {}  # shape key name -> {"__body__": delta, asset key: delta}

for group in (FACE_MORPHS, BODY_MORPHS):
    for morph, (neg, pos) in group.items():
        for suffix, recipe in (("_Neg", neg), ("_Pos", pos)):
            apply_recipe(recipe)
            refit_assets()
            d = {"__body__": coords(human) - neutral_body}
            for k, o in assets.items():
                d[k] = coords(o, mix=False) - neutral_assets[k]
            deltas[morph + suffix] = d
            clear_recipe(recipe)
            log("morph", morph + suffix, "max body delta %.4f m" % np.abs(d["__body__"]).max())

refit_assets()

# ----------------------------------------------------------------------------- 3. bake neutral, rebuild shape keys

body_groups = {g.name: g.index for g in human.vertex_groups}


def group_members(obj, name):
    idx = obj.vertex_groups[name].index
    out = np.zeros(len(obj.data.vertices), dtype=bool)
    for v in obj.data.vertices:
        for g in v.groups:
            if g.group == idx and g.weight > 0.5:
                out[v.index] = True
    return out


keep = group_members(human, "body")
regions = {n: group_members(human, n) for n in ("lips", "fingernails", "toenails", "scalp", "nipple", "genitals", "ears")}
hide_groups = {n: group_members(human, n) for n in body_groups if n.startswith("Delete.")}

human.shape_key_clear()
human.data.vertices.foreach_set("co", neutral_body.ravel())
human.data.update()

for m in list(human.modifiers):
    if m.type == "MASK":
        human.modifiers.remove(m)


def add_keys(obj, base, per_key):
    """Basis + every morph that moves this mesh noticeably."""
    used = []
    for name, d in per_key:
        if np.abs(d).max() > MORPH_EPS:
            used.append((name, d))
    if not used:
        return []
    obj.shape_key_add(name="Basis", from_mix=False)
    for name, d in used:
        k = obj.shape_key_add(name=name, from_mix=False)
        k.data.foreach_set("co", (base + d).ravel())
    return [n for n, _ in used]


body_keys = add_keys(human, neutral_body, [(n, d["__body__"]) for n, d in deltas.items()])
asset_keys = {}
for k, o in assets.items():
    if o.data.shape_keys:
        o.shape_key_clear()
    o.data.vertices.foreach_set("co", neutral_assets[k].ravel())
    asset_keys[k] = add_keys(o, neutral_assets[k], [(n, d[k]) for n, d in deltas.items()])

# Remove helper geometry (keeps shape keys and per-vertex region flags in step with the mesh).
log("removing helpers")
activate(human)
bm = bmesh.new()
bm.from_mesh(human.data)
bm.verts.ensure_lookup_table()
flags = {n: a for n, a in list(regions.items()) + list(hide_groups.items())}
lay = {n: bm.verts.layers.int.new("f_" + n[:50]) for n in flags}
for v in bm.verts:
    for n, a in flags.items():
        v[lay[n]] = int(a[v.index])
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep[v.index]], context="VERTS")
bm.verts.ensure_lookup_table()
bm.verts.index_update()
final_flags = {n: np.array([v[lay[n]] for v in bm.verts], dtype=bool) for n in flags}
for n in flags:
    bm.verts.layers.int.remove(lay[n])
bm.to_mesh(human.data)
bm.free()
human.data.update()
for g in list(human.vertex_groups):
    if g.name.startswith(("helper-", "joint-", "Delete.")) or g.name in ("HelperGeometry", "JointCubes", "Mid", "Left", "Right", "body"):
        human.vertex_groups.remove(g)

human.name = human.data.name = "Body"
rig.name = rig.data.name = "Armature"
for b in rig.data.bones:
    b.name = b.name.replace("mixamorig:", "")
for obj in [human, *assets.values()]:
    for g in obj.vertex_groups:
        if g.name.startswith("mixamorig:"):
            g.name = g.name.replace("mixamorig:", "")
    for m in list(obj.modifiers):
        if m.type in ("MASK", "SUBSURF"):
            obj.modifiers.remove(m)
for k, o in assets.items():
    o.name = k

# ----------------------------------------------------------------------------- 4. textures

os.makedirs(os.path.join(OUT, "masks"), exist_ok=True)
os.makedirs(os.path.join(OUT, "eyes"), exist_ok=True)
os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)


def load_px(path):
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)


def save_px(arr, path, fmt="PNG", quality=90):
    h, w = arr.shape[:2]
    if arr.ndim == 2:
        arr = np.dstack([arr, arr, arr, np.ones_like(arr)])
    elif arr.shape[2] == 3:
        arr = np.dstack([arr, np.ones(arr.shape[:2], dtype=arr.dtype)])
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.clip(arr, 0, 1).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = fmt
    s = bpy.context.scene.render.image_settings
    s.quality = quality
    s.color_mode = "RGBA" if fmt == "PNG" else "RGB"
    img.save_render(path) if fmt != "PNG" else img.save()
    bpy.data.images.remove(img)
    return path


def resize(arr, size):
    """Box-filter downscale by an integer factor (inputs are powers of two)."""
    h = arr.shape[0]
    f = h // size
    if f <= 1:
        return arr
    return arr.reshape(size, f, size, f, -1).mean(axis=(1, 3))


def blur(a, r):
    """Separable box blur (3 passes ≈ gaussian)."""
    for _ in range(3):
        for axis in (0, 1):
            c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(a.ndim)], mode="edge"), axis=axis)
            hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
            a = (hi - lo) / (2 * r + 1)
    return a


srgb2lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
lin2srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0), 1 / 2.4) - 0.055)

# -- UV rasteriser: per-vertex weights -> UV-space image (row 0 = v 0, Blender convention)
mesh = human.data
mesh.calc_loop_triangles()
uv_layer = mesh.uv_layers.active.data
tri_loops = np.array([t.loops[:] for t in mesh.loop_triangles])
tri_verts = np.array([t.vertices[:] for t in mesh.loop_triangles])
loop_uv = np.empty(len(uv_layer) * 2)
uv_layer.foreach_get("uv", loop_uv)
loop_uv = loop_uv.reshape(-1, 2)
tri_uv = loop_uv[tri_loops]  # (T, 3, 2)


def raster(weights, size, rect=(0, 0, 1, 1), mode="interp"):
    """weights: (V, C). Returns (size, size, C). rect = (u0, v0, u1, v1) UV window."""
    C = weights.shape[1]
    img = np.zeros((size, size, C), dtype=np.float32)
    w_tri = weights[tri_verts]  # (T, 3, C)
    active = w_tri.max(axis=(1, 2)) > 0.002
    u0, v0, u1, v1 = rect
    for t in np.nonzero(active)[0]:
        p = (tri_uv[t] - [u0, v0]) / [u1 - u0, v1 - v0] * size - 0.5
        x0, y0 = np.floor(p.min(axis=0)).astype(int)
        x1, y1 = np.ceil(p.max(axis=0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        (ax, ay), (bx, by), (cx, cy) = p
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        l3 = 1 - l1 - l2
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        if not inside.any():
            continue
        if mode == "all":
            val = np.broadcast_to(w_tri[t].min(axis=0), l1.shape + (C,))
        else:
            val = l1[..., None] * w_tri[t, 0] + l2[..., None] * w_tri[t, 1] + l3[..., None] * w_tri[t, 2]
        sub = img[y0:y1 + 1, x0:x1 + 1]
        sub[inside] = np.maximum(sub[inside], val[inside])
    return img


# -- skin: a near-white detail map the app tints with the chosen tone
skin_tex = mhmat_textures(os.path.join(ASSETS, "skins", "young_african_female"))["diffuseTexture"]
D = load_px(skin_tex)[..., :3].astype(np.float64)
S = D.shape[0]
nv = len(mesh.vertices)
flag = lambda n: final_flags[n].astype(np.float32)[:, None]
fix = raster(np.hstack([flag("scalp"), np.maximum(flag("nipple"), flag("genitals"))]), S)
scalp_px, private_px = blur(fix[..., 0], 4), blur(fix[..., 1], 6)
lin = srgb2lin(D)
lum = lin @ [0.2126, 0.7152, 0.0722]
skin_px = (scalp_px < 0.05) & (lum > 0.01)
mean = lin[skin_px].mean(axis=0)
# Scalp: the painted hair is lifted out (it becomes the "scalp hair" mask) and filled with nearby skin.
smooth = blur(lin, 40)
fill = np.clip(scalp_px + private_px, 0, 1)[..., None]
clean = lin * (1 - fill) + smooth * fill
ratio = clean / mean
detail = np.clip(ratio ** 0.85 * 0.72, 0, 1)
save_px(lin2srgb(resize(detail, 2048)), os.path.join(OUT, "tex", "skin_detail.png"))
hair_paint = np.clip(1 - (lum / max(lum[skin_px].mean(), 1e-4)) / 0.55, 0, 1) * np.clip(scalp_px * 1.4, 0, 1)
# fine normal map from the high frequencies of the albedo
hp = np.log(np.maximum(lum, 1e-4)) - np.log(np.maximum(blur(lum, 3), 1e-4))
gx = np.gradient(hp, axis=1) * 2.2
gy = np.gradient(hp, axis=0) * 2.2
nrm = np.dstack([-gx, -gy, np.ones_like(gx)])
nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
save_px(resize(nrm * 0.5 + 0.5, 2048), os.path.join(OUT, "tex", "skin_normal.png"))

# -- landmarks (Blender space: Z up, the character faces -Y, her left is +X)
co = np.empty(nv * 3)
mesh.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
eyes_co = coords(assets["Eyes"], mix=False)
eyeL = eyes_co[eyes_co[:, 0] > 0].mean(axis=0)
eyeR = eyes_co[eyes_co[:, 0] < 0].mean(axis=0)
eye_r = np.linalg.norm(eyes_co[eyes_co[:, 0] > 0] - eyeL, axis=1).max()
d = np.linalg.norm(eyeL - eyeR)
lips_c = co[final_flags["lips"]].mean(axis=0)
log("landmarks eyeL", eyeL, "eye_r %.4f" % eye_r, "interocular %.4f" % d, "lips", lips_c)
head_front = co[:, 1] < (eyeL[1] + 0.9 * d)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def ellipse(lx, lz, cx, cz, rx, rz):
    return smoothstep(1.0, 0.45, np.sqrt(((lx - cx) / rx) ** 2 + ((lz - cz) / rz) ** 2))


# vertex adjacency for smoothing
edges = np.empty(len(mesh.edges) * 2, dtype=np.int64)
mesh.edges.foreach_get("vertices", edges)
edges = edges.reshape(-1, 2)
deg = np.bincount(edges.ravel(), minlength=nv).astype(np.float64)


def vsmooth(w, it=2):
    for _ in range(it):
        acc = np.zeros_like(w)
        np.add.at(acc, edges[:, 0], w[edges[:, 1]])
        np.add.at(acc, edges[:, 1], w[edges[:, 0]])
        w = 0.5 * w + 0.5 * acc / np.maximum(deg, 1)[:, None]
    return w


def side(E, s):
    lx = (co[:, 0] - E[0]) * s / d
    lz = (co[:, 2] - E[2]) / d
    ly = -(co[:, 1] - E[1]) / d
    return lx, lz, ly


reg = {k: np.zeros(nv) for k in ("eyelid", "linerUp", "linerLow", "under", "blush", "contour", "highlight", "brow")}
brow_co = coords(assets[f"Brows_{BROWS[0]}"], mix=False)
for E, s in ((eyeL, 1), (eyeR, -1)):
    lx, lz, ly = side(E, s)
    near_side = (co[:, 0] * s > -0.02 * d)
    rad = np.linalg.norm(co - E, axis=1) / d
    rr = eye_r / d
    # The lid margin hugs the eyeball: a thin shell just outside its radius.
    lid_ring = smoothstep(rr * 1.2, rr * 1.04, rad) * near_side * head_front
    reg["linerUp"] = np.maximum(reg["linerUp"], lid_ring * smoothstep(0.0, 0.06, lz) * smoothstep(0.34, 0.24, lz))
    wing = smoothstep(0.06, 0.0, np.abs(lz - (0.05 + (lx - 0.22) * 0.55))) * smoothstep(0.2, 0.26, lx) * smoothstep(0.52, 0.42, lx)
    reg["linerUp"] = np.maximum(reg["linerUp"], wing * near_side * head_front)
    reg["linerLow"] = np.maximum(reg["linerLow"], lid_ring * smoothstep(-0.02, -0.07, lz) * smoothstep(-0.32, -0.2, lz))
    reg["eyelid"] = np.maximum(reg["eyelid"], ellipse(lx, lz, 0.04, 0.17, 0.46, 0.25) * smoothstep(-0.04, 0.04, lz) * near_side * head_front)
    reg["under"] = np.maximum(reg["under"], ellipse(lx, lz, 0.02, -0.3, 0.42, 0.2) * near_side * head_front)
    reg["blush"] = np.maximum(reg["blush"], ellipse(lx, lz, 0.34, -0.78, 0.42, 0.34) * near_side * head_front)
    # contour: hollow under the cheekbone, temple and along the jaw
    a, b = np.array([0.78, -0.5]), np.array([0.28, -1.02])
    p = np.stack([lx, lz], axis=1)
    t = np.clip(((p - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1)
    dist = np.linalg.norm(p - (a + t[:, None] * (b - a)), axis=1)
    hollow = smoothstep(0.2, 0.06, dist)
    temple = ellipse(lx, lz, 0.62, 0.55, 0.22, 0.32)
    reg["contour"] = np.maximum(reg["contour"], np.maximum(hollow, temple * 0.7) * near_side * head_front)
    reg["highlight"] = np.maximum(reg["highlight"], ellipse(lx, lz, 0.42, -0.42, 0.3, 0.13) * near_side * head_front)
# nose bridge + cupid's bow highlight, nose-side contour
mid = np.abs(co[:, 0]) / d
lz0 = (co[:, 2] - eyeL[2]) / d
bridge = smoothstep(0.09, 0.03, mid) * smoothstep(-0.75, -0.55, lz0) * smoothstep(0.15, 0.0, lz0) * head_front
reg["highlight"] = np.maximum(reg["highlight"], bridge)
lz_l = (co[:, 2] - lips_c[2]) / d
bow = smoothstep(0.1, 0.02, mid) * smoothstep(0.05, 0.12, lz_l) * smoothstep(0.3, 0.18, lz_l) * head_front * (1 - final_flags["lips"])
reg["highlight"] = np.maximum(reg["highlight"], bow * 0.8)
nose_side = smoothstep(0.1, 0.14, mid) * smoothstep(0.26, 0.18, mid) * smoothstep(-0.7, -0.45, lz0) * smoothstep(0.1, -0.1, lz0) * head_front
reg["contour"] = np.maximum(reg["contour"], nose_side * 0.6)
# brow fill: skin under the brow cards
from mathutils.kdtree import KDTree  # noqa: E402

kd = KDTree(len(brow_co))
for i, c in enumerate(brow_co):
    kd.insert(c, i)
kd.balance()
for i in np.nonzero(head_front)[0]:
    _c, _j, dist = kd.find(co[i])
    reg["brow"][i] = smoothstep(0.006, 0.0015, dist)

lips = vsmooth(flag("lips"), 2)[:, 0]
lip_liner = np.clip(vsmooth(lips[:, None], 1)[:, 0] * (1 - lips) * 4 + lips * (1 - vsmooth(lips[:, None], 3)[:, 0]) * 2.5, 0, 1)
face = smoothstep(eyeL[2] - 2.0 * d, eyeL[2] - 1.5 * d, co[:, 2]) * (1 - vsmooth(flag("scalp"), 2)[:, 0]) * (1 - vsmooth(flag("ears"), 1)[:, 0] * 0.5)
for k in reg:
    reg[k] = vsmooth(reg[k][:, None], 2)[:, 0]
reg["linerUp"] = np.clip(reg["linerUp"] * 1.2, 0, 1)

# The head's main UV island sits on the right of the MakeHuman layout; the mouth cavity and
# inner sockets are separate islands on the left that makeup never touches.
head_tris = np.isin(tri_verts, np.nonzero(co[:, 2] > eyeL[2] - 2.2 * d)[0]).all(axis=1) & (tri_uv[:, :, 0].mean(axis=1) > 0.55)
head_uv = tri_uv[head_tris].reshape(-1, 2)
pad = 0.004
face_rect = [float(head_uv[:, 0].min() - pad), float(head_uv[:, 1].min() - pad), float(head_uv[:, 0].max() + pad), float(head_uv[:, 1].max() + pad)]
MS = 1024
log("face rect", face_rect)
fa = raster(np.stack([lips, reg["linerUp"], reg["eyelid"], reg["blush"]], axis=1), MS, face_rect)
fb = raster(np.stack([reg["contour"], reg["highlight"], reg["under"], reg["brow"]], axis=1), MS, face_rect)
fc_w = np.stack([face, lip_liner, np.zeros(nv), reg["linerLow"]], axis=1)
fc = raster(fc_w, MS, face_rect)
# scalp hair: the hair painted in the source texture, resampled into the face window
u0, v0, u1, v1 = face_rect
ys, xs = np.mgrid[0:MS, 0:MS]
su = ((u0 + (xs + 0.5) / MS * (u1 - u0)) * S).astype(int).clip(0, S - 1)
sv = ((v0 + (ys + 0.5) / MS * (v1 - v0)) * S).astype(int).clip(0, S - 1)
fc[..., 2] = hair_paint[sv, su]
save_px(fa, os.path.join(OUT, "masks", "face_a.png"))
save_px(fb, os.path.join(OUT, "masks", "face_b.png"))
save_px(fc, os.path.join(OUT, "masks", "face_c.png"))
nails = raster(np.maximum(flag("fingernails"), flag("toenails")), 1024)[..., 0]
save_px(np.dstack([nails, np.zeros_like(nails), np.zeros_like(nails), np.ones_like(nails)]), os.path.join(OUT, "masks", "body.png"))

# body-hide masks: skin faces fully inside an outfit's delete group are discarded at runtime
hide_files = {}
for key in [f"Outfit_{c}" for c in OUTFITS] + [f"Shoes_{s}" for s in SHOES]:
    asset = key.split("_", 1)[1]
    g = "Delete." + asset
    if g not in final_flags:
        continue
    m = raster(final_flags[g].astype(np.float32)[:, None], 1024, mode="all")[..., 0]
    hide_files[key] = save_px(m, os.path.join(OUT, "masks", f"hide_{asset}.png"))

# eyes
for e in EYES:
    tex = load_px(os.path.join(ASSETS, "eyes", "materials", f"{e}_eye.png"))
    # RGBA: the alpha is the clear cornea over the iris. MakeHuman's irises are tuned for its
    # litsphere shader and read too saturated (brown turns red) under PBR + ACES: calm them.
    l = tex[..., :3] @ [0.2126, 0.7152, 0.0722]
    tex[..., :3] = l[..., None] + (tex[..., :3] - l[..., None]) * 0.5
    save_px(resize(tex, 512), os.path.join(OUT, "eyes", f"{e}.png"))


def tint_ready(path, size, keep_alpha=True):
    """Grayscale (luminance normalised to ~0.8) so the app can dye it; alpha kept."""
    px = load_px(path)
    lum = px[..., :3] @ [0.2126, 0.7152, 0.0722]
    a = px[..., 3]
    m = lum[a > 0.5].mean() if (a > 0.5).any() else lum.mean()
    g = np.clip(lum / max(m, 1e-4) * 0.62, 0, 1)
    out = np.dstack([g, g, g, a if keep_alpha else np.ones_like(a)])
    return resize(out, size)


# ----------------------------------------------------------------------------- 5. materials


def material(name, color_path=None, normal_path=None, alpha=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if color_path:
        img = bpy.data.images.load(color_path, check_existing=True)
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = img
        nt.links.new(n.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(n.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.surface_render_method = "DITHERED"
    if normal_path:
        img = bpy.data.images.load(normal_path, check_existing=True)
        img.colorspace_settings.name = "Non-Color"
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = img
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


assign(human, material("Skin", os.path.join(OUT, "tex", "skin_detail.png"), os.path.join(OUT, "tex", "skin_normal.png")))
assign(assets["Eyes"], material("Eyes", os.path.join(OUT, "eyes", "brown.png"), alpha=True))
for b in BROWS:
    p = save_px(tint_ready(mhmat_textures(os.path.join(ASSETS, "eyebrows", b))["diffuseTexture"], 256), os.path.join(OUT, "tex", f"{b}.png"))
    assign(assets[f"Brows_{b}"], material("Brows", p, alpha=True))
for l in LASHES:
    p = save_px(tint_ready(mhmat_textures(os.path.join(ASSETS, "eyelashes", l))["diffuseTexture"], 256), os.path.join(OUT, "tex", f"{l}.png"))
    assign(assets[f"Lashes_{l}"], material("Lashes", p, alpha=True))
for h in HAIR:
    t = mhmat_textures(os.path.join(ASSETS, "hair", h))
    p = save_px(tint_ready(t["diffuseTexture"], 1024), os.path.join(OUT, "tex", f"{h}.png"))
    nrm = None
    if "normalmapTexture" in t:
        nrm = save_px(resize(load_px(t["normalmapTexture"])[..., :3], 1024), os.path.join(OUT, "tex", f"{h}_n.png"))
    assign(assets[f"Hair_{h}"], material("Hair", p, nrm, alpha=True))
for c in list(OUTFITS) + list(SHOES):
    key = f"Outfit_{c}" if c in OUTFITS else f"Shoes_{c}"
    t = mhmat_textures(os.path.join(ASSETS, "clothes", c))
    p = save_px(resize(load_px(t["diffuseTexture"]), 1024), os.path.join(OUT, "tex", f"{c}.png"))
    nrm = None
    if "normalmapTexture" in t:
        nrm = save_px(resize(load_px(t["normalmapTexture"])[..., :3], 1024), os.path.join(OUT, "tex", f"{c}_n.png"))
    assign(assets[key], material("Fabric", p, nrm, alpha=True))

# ----------------------------------------------------------------------------- 6. export


def export(path, objs):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    deselect_all()
    rig.select_set(True)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_morph=True,
        export_morph_normal=True,
        export_animations=False,
        export_apply=False,
        export_yup=True,
        export_image_format="AUTO",
        export_texcoords=True,
        export_normals=True,
    )
    log("exported", path, "%.1f MB" % (os.path.getsize(path) / 1e6))


export(os.path.join(OUT, "body.glb"), [human, assets["Eyes"], *[assets[f"Brows_{b}"] for b in BROWS], *[assets[f"Lashes_{l}"] for l in LASHES]])
for h in HAIR:
    export(os.path.join(OUT, "hair", f"{h}.glb"), [assets[f"Hair_{h}"]])
for c in OUTFITS:
    export(os.path.join(OUT, "outfits", f"{c}.glb"), [assets[f"Outfit_{c}"]])
for s in SHOES:
    export(os.path.join(OUT, "shoes", f"{s}.glb"), [assets[f"Shoes_{s}"]])


def morph_entry(name, group):
    return {"id": name, "neg": f"{name}_Neg" in body_keys, "pos": f"{name}_Pos" in body_keys, "group": group}


manifest = {
    "version": 1,
    "license": "CC0-1.0 (MakeHuman / MPFB system assets)",
    "generator": "scripts/character/build_character.py",
    "macros": MACROS,
    "heightM": float(co[:, 2].max() - co[:, 2].min()),
    "morphs": [morph_entry(n, "face") for n in FACE_MORPHS] + [morph_entry(n, "body") for n in BODY_MORPHS],
    "faceRect": face_rect,
    "masks": {
        "faceA": ["lips", "linerUpper", "eyelid", "blush"],
        "faceB": ["contour", "highlight", "underEye", "browFill"],
        "faceC": ["face", "lipLiner", "scalpHair", "linerLower"],
        "body": ["nails"],
    },
    "eyes": EYES,
    "brows": BROWS,
    "lashes": LASHES,
    "hair": [{"id": k, "name": v, "morphs": asset_keys[f"Hair_{k}"]} for k, v in HAIR.items()],
    "outfits": [{"id": k, "name": v, "hideMask": f"Outfit_{k}" in hide_files} for k, v in OUTFITS.items()],
    "shoes": [{"id": k, "name": v, "hideMask": f"Shoes_{k}" in hide_files} for k, v in SHOES.items()],
}
with open(os.path.join(OUT, "character.json"), "w") as f:
    json.dump(manifest, f, indent=2)
log("done", OUT)

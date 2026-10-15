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
from bl_ext.blender_org.mpfb.services.rigservice import RigService  # noqa: E402
from bl_ext.blender_org.mpfb.services.targetservice import TargetService  # noqa: E402

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "character-out")
TARGETS = LocationService.get_mpfb_data("targets")
ASSETS = LocationService.get_user_data()

# ----------------------------------------------------------------------------- what to build

# The base female (~/Downloads/base_female.blend) as MPFB macros: female, age 0.5 = 25 years, always an adult.
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "base_female.json")) as _f:
    MACROS = {k: v for k, v in json.load(_f).items() if not k.startswith("_")}

# Each slider: (negative recipe, positive recipe). A recipe is a list of ("target", weight)
# or ("macro:<name>", value) entries. Bilateral targets list both sides.
def lr(name, w=1.0):
    return [(f"l-{name}", w), (f"r-{name}", w)]


FACE_MORPHS = {
    "NoseWidth": ([("nose-scale-horiz-decr", 1), ("nose-flaring-decr", 0.6)], [("nose-scale-horiz-incr", 1), ("nose-flaring-incr", 0.6)]),
    "NoseBridge": ([("nose-width1-decr", 1)], [("nose-width1-incr", 1)]),
    "NoseTip": ([("nose-point-down", 1)], [("nose-point-up", 1)]),
    "NoseLength": ([("nose-scale-vert-decr", 1)], [("nose-scale-vert-incr", 1)]),
    # the tip's width: Neg = a sharper, narrower tip (clinic: nose refine, tip lift)
    "NoseTipWidth": ([("nose-point-width-decr", 1), ("nose-width3-decr", 0.6)], [("nose-point-width-incr", 1), ("nose-width3-incr", 0.6)]),
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
    "Thighs": ([("measure-thigh-circ-decr", 1)], [("measure-thigh-circ-incr", 1)] + lr("upperleg-fat-incr", 0.5)),
    # Plus-size arms: upper and lower arm and the shoulder soften together (girth only; arm LENGTH
    # follows the skeleton, i.e. her height, never her weight: see skeleton_consistent below).
    "Arms": (lr("upperarm-fat-decr") + lr("lowerarm-fat-decr", 0.8), lr("upperarm-fat-incr") + lr("lowerarm-fat-incr", 0.8) + [("measure-upperarm-circ-incr", 0.4)]),
    "Calves": (lr("lowerleg-fat-decr") + [("measure-calf-circ-decr", 0.5)], lr("lowerleg-fat-incr") + [("measure-calf-circ-incr", 0.5)]),
    "NeckFull": ([("measure-neck-circ-decr", 0.8)], [("neck-double-incr", 1), ("measure-neck-circ-incr", 0.6)]),
    "Softness": ([("macro:weight", 0.15)], [("macro:weight", 0.95)]),
    "Muscle": ([("macro:muscle", 0.2)], [("macro:muscle", 0.85)]),
    # Presentation: MakeHuman's gender macro from the base (0, feminine) to 1 (masculine). Only the
    # positive side differs from the base, so 0.5..1 in the app goes feminine -> masculine.
    # The masculine end IS the user's male base body (~/Downloads/base_male.blend), exactly: its
    # macros and every body target it sets (MALE_BASE below). Its face targets are left out so each
    # man keeps his own face sliders; its race mix too (race mostly shapes the face).
    "Masc": ([("macro:gender", 0.0)], "MALE_BASE"),
    # A man's weight, on the male base itself (every man is the male base; only height and this
    # change between them): 0.5 = the base (weight 0.7), 0 = lean (0.4), 1 = heavy (1.0). Its deltas
    # are taken relative to the male base, so it adds on top of Masc_Pos. Men keep Softness etc. at 0.5.
    "MascSoft": ("MALE_LEAN", "MALE_HEAVY"),
    # A pregnancy bump (only on a doll that asks for it): one-sided, 0.5 = none .. 1 = full term.
    "Pregnant": ([], [("stomach-pregnant-incr", 1.5)]),
}

# ~/Downloads/base_male.blend, read off its MPFB properties and shape keys: macros, then every body
# target at its value. Left out: its face targets (cheek/chin/ear/eye/brow/mouth/nose: each man keeps
# his own face), race (face) and "bulge-incr" (under clothing; it pushed through trousers).
MALE_MACROS = [("macro:gender", 1.0), ("macro:muscle", 0.3), ("macro:weight", 0.7), ("macro:proportions", 0.9), ("macro:height", 0.7), ("macro:cupsize", 0.4), ("macro:firmness", 1.0)]
MALE_TARGETS = [
    ("hip-scale-depth-incr", 0.84), ("hip-trans-down", 0.99), ("hip-waist-down", 0.33), ("measure-knee-circ-decr", 0.07),
    ("neck-scale-depth-incr", 0.06), ("pelvis-tone-decr", 0.99), ("stomach-navel-in", 0.21), ("stomach-tone-incr", 1.0),
    ("torso-muscle-pectoral-incr", 1.0),
] + lr("upperleg-fat-incr", 0.21) + lr("foot-scale-decr", 1.0)
MALE_BASE = MALE_MACROS + MALE_TARGETS


def _male_at_weight(w):
    return [(n, w if n == "macro:weight" else v) for n, v in MALE_MACROS] + MALE_TARGETS


_NAMED = {"MALE_BASE": MALE_BASE, "MALE_LEAN": _male_at_weight(0.4), "MALE_HEAVY": _male_at_weight(1.0)}
for _grp in (BODY_MORPHS,):
    for _k, (_n, _p) in list(_grp.items()):
        _grp[_k] = (_NAMED.get(_n, _n) if isinstance(_n, str) else _n, _NAMED.get(_p, _p) if isinstance(_p, str) else _p)
# morphs whose deltas are relative to another morph's full shape (subtracted after baking)
RELATIVE_TO = {"MascSoft_Neg": "Masc_Pos", "MascSoft_Pos": "Masc_Pos"}

EYES = ["brown", "brownlight", "green", "grey", "bluegreen"]
BROWS = ["eyebrow001", "eyebrow006", "eyebrow010", "eyebrow003", "eyebrow008"]
LASHES = ["eyelashes01", "eyelashes02", "eyelashes03"]
# id -> (source, name). "blend": built by scripts/character/hair/style_<id>.py into
# art/blender/hair/hair_<id>.blend (object "Hair_<id>", fitted, skinned, with the float attributes
# _tip/_strand/_section; textures in art/hair_tex/<id>.png). The MPFB library styles (pixie = short04,
# short02, bob02, long01, ponytail01, braid01) are fitted there too (mpfbkit.py) so they carry the same
# attributes and sit over clothing. "mpfb:<asset>" (fit here from the library) is still supported.
HAIR = {
    "afro_short": ("blend", "Short wide afro"),
    "afro_big": ("blend", "Big puffy afro"),
    "afro_puffs": ("blend", "Two afro puffs"),
    "afro_fringe": ("blend", "Cute fringe afro"),
    "two_braids": ("blend", "Two braided ponytails"),
    "fulani_braids": ("blend", "Fulani braids"),
    "goddess_braids": ("blend", "Boho Fulani braids"),
    "long_curls": ("blend", "Long curly wig"),
    "box_braids": ("blend", "Box braids"),
    "knotless_braids": ("blend", "Knotless braids"),
    "cornrows": ("blend", "Cornrows"),
    "twists": ("blend", "Two-strand twists"),
    "bantu_knots": ("blend", "Bantu knots"),
    "locs": ("blend", "Locs"),
    "locs_retwist": ("blend", "Retwisted locs"),
    "microlocs": ("blend", "Microlocs"),
    "freeform_locs": ("blend", "Freeform locs"),
    "faux_locs": ("blend", "Faux locs"),
    "curls": ("blend", "Natural curls"),
    "braid_out": ("blend", "Braid-out (loose)"),
    "wavy_wig": ("blend", "Wavy wig"),
    "leave_out": ("blend", "Leave-out"),
    "bun": ("blend", "Sleek high bun"),
    "bonnet": ("blend", "Satin bonnet"),
    "pixie": ("blend", "Pixie cut"),
    "short02": ("blend", "Short natural"),
    "bob02": ("blend", "Silk-press bob"),
    "long01": ("blend", "Straight wig"),
    "ponytail01": ("blend", "Sleek ponytail"),
    "braid01": ("blend", "Single braid"),
    "jayda_braids": ("blend", "Jayda Wayda braids"),
    "doechii_cornrows": ("blend", "Sculpted cornrows"),
    "long_straight_fringe": ("blend", "Long straight wig with fringe"),
    "short_locs": ("blend", "Short locs"),
}
HAIR_BLENDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "art", "blender", "hair")
HAIR_TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "art", "hair_tex")
OUTFITS = {
    "female_sportsuit01": "Studio set",
    "female_casualsuit01": "Weekend casual",
    "female_casualsuit02": "Denim day",
    "female_elegantsuit01": "Evening",
    "male_casualsuit01": "Easy tee & jeans",
    "male_casualsuit02": "Weekend layers",
    "male_casualsuit03": "Street casual",
    "male_casualsuit04": "Relaxed knit",
    "male_casualsuit05": "Smart casual",
    "male_casualsuit06": "Off-duty",
    "male_elegantsuit01": "Tailored suit",
    "male_worksuit01": "Workwear",
}
SHOES = {"shoes01": "Brown brogues", "shoes02": "Grey trainers", "shoes03": "Black loafers", "shoes04": "Black lace-ups", "shoes05": "White trainers", "shoes06": "Navy sneakers"}
MORPH_EPS = 0.0008  # metres; a mesh only gets a morph that moves it more than this

# Facial expressions from MakeHuman's expression units (FACS-style), mixed by her ethnicity weights so
# they fit her face. Single-sided shape keys "Expr_<Name>" (0 = rest, 1 = full), baked onto the body and
# refitted onto brows, lashes and hair like the sliders, so lids and lashes close together.
_race = MACROS["race"]
_race_sum = sum(_race.values())


def unit(name, w=1.0):
    return [(f"expression/units/{r}/{name}", w * _race[r] / _race_sum) for r in ("african", "asian", "caucasian") if _race.get(r, 0) > 0]


EXPRESSIONS = {
    "Expr_BlinkL": unit("eye-left-closure"),
    "Expr_BlinkR": unit("eye-right-closure"),
    "Expr_Sleepy": unit("eye-left-slit", 0.85) + unit("eye-right-slit", 0.85) + unit("eyebrows-left-down", 0.25) + unit("eyebrows-right-down", 0.25),
    "Expr_Smile": unit("mouth-corner-puller") + unit("mouth-elevation", 0.15),
    "Expr_Open": unit("mouth-open"),
    "Expr_Pout": unit("mouth-pursing", 0.8) + unit("mouth-protusion", 0.4),
    "Expr_BrowsUp": unit("eyebrows-left-up") + unit("eyebrows-right-up"),
    "Expr_Worried": unit("eyebrows-left-inner-up") + unit("eyebrows-right-inner-up"),
    "Expr_Squint": unit("eye-left-slit", 0.55) + unit("eye-right-slit", 0.55),
    "Expr_Wince": unit("eye-left-closure", 0.6) + unit("eye-right-closure", 0.6) + unit("nose-compression", 0.6) + unit("mouth-compression", 0.4),
}

# ----------------------------------------------------------------------------- helpers

def log(*a):
    print("[dollscene]", *a, flush=True)


def target_path(name):
    if "/" in name:  # a path under the targets folder, e.g. expression/units/african/mouth-open
        p = os.path.join(TARGETS, name + ".target.gz")
        if os.path.exists(p):
            return p
        raise FileNotFoundError(name)
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

# Start from empty module folders so a removed or renamed asset doesn't linger and get shipped.
import shutil  # noqa: E402

for _d in ("hair", "outfits", "shoes", "pieces"):
    shutil.rmtree(os.path.join(OUT, _d), ignore_errors=True)

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
custom = {}  # key -> object: hand-built hair, already fitted and skinned in its .blend


def add_custom_hair(h):
    path = os.path.join(HAIR_BLENDS, f"hair_{h}.blend")
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [f"Hair_{h}"]
    obj = dst.objects[0]
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = rig
    for m in obj.modifiers:
        if m.type == "ARMATURE":
            m.object = rig
    custom[f"Hair_{h}"] = obj
    return obj


for h, (source, _name) in list(HAIR.items()):
    if source == "blend":
        # DOLLSCENE_SKIP_MISSING_HAIR=1 lets a test build run while a style is still being made.
        if os.environ.get("DOLLSCENE_SKIP_MISSING_HAIR") == "1" and not os.path.exists(os.path.join(HAIR_BLENDS, f"hair_{h}.blend")):
            log("SKIPPING missing hair", h)
            del HAIR[h]
            continue
        add_custom_hair(h)
    else:
        add("hair", source.split(":", 1)[1], "Hair", f"Hair_{h}")
for c in OUTFITS:
    add("clothes", c, "Clothes", f"Outfit_{c}")
for s in SHOES:
    add("clothes", s, "Clothes", f"Shoes_{s}")

# Store outfits: built by scripts/character/outfit/build_outfits.py on this same base mesh
# (art/blender/outfits/outfit_<id>.blend, object "Outfit_<id>", skinned, with "_src" = the body
# vertex each shell vertex came from, "hide_src" = covered body vertices, "ease" = skirt width at
# the hands). They join `custom` (shape keys, weight cleanup, export) but take their morph deltas
# from the body below, not from the head like the hand-built hair.
OUTFIT_BLENDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "art", "blender", "pieces")
# Wardrobe pieces (scripts/character/outfit/build_pieces.py): one slot each (top, bottom, dress,
# shoes), recoloured in the app through three colour slots. Saved as piece_<id>.blend, object
# "Piece_<id>"; here they are renamed Outfit_<id> so they ride the store-outfit path below.
with open(os.path.join(OUTFIT_BLENDS, "catalog.json")) as _f:
    STORE_OUTFITS = {k: v for k, v in json.load(_f).items() if os.path.exists(os.path.join(OUTFIT_BLENDS, f"piece_{k}.blend"))}
# the shipped MakeHuman outfits: classic sets at the thrift store (and a few elsewhere)
OUTFIT_STORES = {
    "female_casualsuit01": "okrika", "female_casualsuit02": "okrika", "male_casualsuit01": "okrika", "male_casualsuit04": "okrika",
    "female_elegantsuit01": "moncherie", "male_casualsuit05": "okrika",
    "male_elegantsuit01": "dopebyfabby", "female_sportsuit01": "novasport", "male_casualsuit06": "novasport",
    "male_casualsuit02": "okrika",
    "male_worksuit01": "tolaptsd", "male_casualsuit03": "tolaptsd",
}
store_meta = {}
for oid in STORE_OUTFITS:
    path = os.path.join(OUTFIT_BLENDS, f"piece_{oid}.blend")
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [f"Piece_{oid}"]
    obj = dst.objects[0]
    obj.name = f"Outfit_{oid}"
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = rig
    for m in obj.modifiers:
        if m.type == "ARMATURE":
            m.object = rig
    custom[f"Outfit_{oid}"] = obj
    store_meta[oid] = {"hide": json.loads(obj.get("hide_src", "[]")), "ease": float(obj.get("ease", 0.0))}
    log("store outfit", oid, len(obj.data.vertices), "verts")

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

# Skeleton-consistent morphs. The app ships ONE skeleton (the base female's), but MakeHuman's macros
# move the joints: the masculine end of the gender macro puts the head 13 cm higher, makes the
# forearm 28% and the hand 22% longer and the legs 11 cm longer. Baked as plain shape keys over the
# unchanged skeleton, that stretched the arms past the hips with oversized hands (the "arms far too
# long" defect) and pulled the face off its head bone. So for every slider we refit the rig the way
# MakeHuman would, and subtract from each vertex the displacement of the bones it is skinned to
# (interpolated along each bone, so a lengthened forearm counts as the stretch it is). What remains is
# the shape change relative to the skeleton: girth, softness, contours. Proportions (limb lengths,
# neck, legs-to-torso, head height) stay the base's 7.5-head adult on every body, and arm length scales
# with her height only.
_DEFORM_BONES = [b.name for b in rig.data.bones if b.use_deform]
assert np.allclose(np.array(rig.matrix_world), np.eye(4)) and np.allclose(np.array(human.matrix_world), np.eye(4))


def joint_positions():
    bpy.context.view_layer.update()
    RigService.refit_existing_armature(rig, human)
    bpy.context.view_layer.update()
    return (np.array([list(rig.data.bones[n].head_local) for n in _DEFORM_BONES]), np.array([list(rig.data.bones[n].tail_local) for n in _DEFORM_BONES]))


def bone_weights(obj):
    """(n_verts, n_bones) skin weights over the deform bones, normalised per vertex."""
    col = {obj.vertex_groups[n].index: j for j, n in enumerate(_DEFORM_BONES) if n in obj.vertex_groups}
    W = np.zeros((len(obj.data.vertices), len(_DEFORM_BONES)))
    for v in obj.data.vertices:
        for g in v.groups:
            j = col.get(g.group)
            if j is not None:
                W[v.index, j] = g.weight
    s = W.sum(axis=1, keepdims=True)
    return np.where(s > 0, W / np.maximum(s, 1e-12), 0.0)


def bone_drift(co_, W, J0, J1):
    """Per-vertex displacement of the bones it rides, from rig fit J0 to J1 (lerped along each bone)."""
    (H0, T0), (H1, T1) = J0, J1
    dH, dT = H1 - H0, T1 - T0
    out = np.zeros_like(co_)
    for j in np.nonzero((W > 0).any(axis=0))[0]:
        if not (np.abs(dH[j]).max() > 1e-6 or np.abs(dT[j]).max() > 1e-6):
            continue
        m = W[:, j] > 0
        seg = T0[j] - H0[j]
        s_ = np.clip(((co_[m] - H0[j]) @ seg) / max(seg @ seg, 1e-12), 0, 1)
        out[m] += W[m, j, None] * (dH[j] + s_[:, None] * (dT[j] - dH[j]))
    return out


J_NEUTRAL = joint_positions()
W_BODY = bone_weights(human)
W_ASSETS = {k: bone_weights(o) for k, o in assets.items()}

for group in (FACE_MORPHS, BODY_MORPHS):
    for morph, (neg, pos) in group.items():
        for suffix, recipe in (("_Neg", neg), ("_Pos", pos)):
            apply_recipe(recipe)
            refit_assets()
            J = joint_positions()
            drift = float(max(np.abs(J[0] - J_NEUTRAL[0]).max(), np.abs(J[1] - J_NEUTRAL[1]).max()))
            d = {"__body__": coords(human) - neutral_body - bone_drift(neutral_body, W_BODY, J_NEUTRAL, J)}
            for k, o in assets.items():
                d[k] = coords(o, mix=False) - neutral_assets[k] - bone_drift(neutral_assets[k], W_ASSETS[k], J_NEUTRAL, J)
            deltas[morph + suffix] = d
            clear_recipe(recipe)
            log("morph", morph + suffix, "max body delta %.4f m" % np.abs(d["__body__"]).max(), "joint drift removed %.4f m" % drift)

for _name, _base in RELATIVE_TO.items():
    for _k in deltas[_name]:
        deltas[_name][_k] = deltas[_name][_k] - deltas[_base][_k]
    log("morph", _name, "relative to", _base, "max body delta %.4f m" % np.abs(deltas[_name]["__body__"]).max())

_J = joint_positions()
assert np.allclose(_J[0], J_NEUTRAL[0], atol=1e-5) and np.allclose(_J[1], J_NEUTRAL[1], atol=1e-5), "rig did not return to the neutral fit"

for name, recipe in EXPRESSIONS.items():
    apply_recipe(recipe)
    refit_assets()
    d = {"__body__": coords(human) - neutral_body}
    for k, o in assets.items():
        d[k] = coords(o, mix=False) - neutral_assets[k]
    deltas[name] = d
    clear_recipe(recipe)
    log("expression", name, "max body delta %.4f m" % np.abs(d["__body__"]).max())

refit_assets()

# ChestFlat: a male chest. MakeHuman's masculine end keeps (even pushes forward) the base's breast
# mound and nipple point, so men read as having breasts. This key smooths the mound away on the
# masculine body (Masc_Pos + Bust_Neg): a Laplacian relax of the front of the chest around each
# nipple, strongest at the point, fading to nothing by the armpit, sternum and ribs. Masculine
# dolls wear it at 1 (shared/studio/presets.ts).
from mathutils.kdtree import KDTree  # noqa: E402

_E = np.empty(len(human.data.edges) * 2, dtype=np.int64)
human.data.edges.foreach_get("vertices", _E)
_E = _E.reshape(-1, 2)
_P = neutral_body + deltas["Masc_Pos"]["__body__"]
_gi = human.vertex_groups["nipple"].index
_nip = np.array([any(g.group == _gi and g.weight > 0.5 for g in v.groups) for v in human.data.vertices])
_w = np.zeros(len(_P))
for _s in (1, -1):
    _sel = _nip & (neutral_body[:, 0] * _s > 0)
    if not _sel.any():
        continue
    _c = _P[_sel].mean(axis=0)
    _d = np.linalg.norm((_P - _c) * np.array([1.0, 0.6, 1.0]), axis=1)
    _front = _P[:, 1] < _c[1] + 0.05
    _w = np.maximum(_w, np.clip((0.115 - _d) / (0.115 - 0.035), 0, 1) ** 1.5 * _front)
# the nipple itself and its ring relax fully (a man's nipple sits flat on the pec, no point)
_nring = _nip.copy()
for _ in range(3):  # the nipple and three rings around it relax fully
    _r2 = _nring.copy()
    _r2[_E[_nring[_E[:, 0]], 1]] = True
    _r2[_E[_nring[_E[:, 1]], 0]] = True
    _nring = _r2
_w = np.where(_nring, 1.0, _w)
_Ps = _P.copy()
_deg = np.bincount(_E.ravel(), minlength=len(_P)).astype(np.float64)
for _ in range(320):
    _acc = np.zeros_like(_Ps)
    np.add.at(_acc, _E[:, 0], _Ps[_E[:, 1]])
    np.add.at(_acc, _E[:, 1], _Ps[_E[:, 0]])
    _avg = _acc / np.maximum(_deg, 1)[:, None]
    _Ps += (_avg - _Ps) * (0.5 * _w)[:, None]
_dchest = _Ps - _P
_kd_all = KDTree(len(neutral_body))
for _j, _p in enumerate(neutral_body):
    _kd_all.insert(_p, _j)
_kd_all.balance()
deltas["ChestFlat_Pos"] = {"__body__": _dchest}
for k, o in assets.items():
    _near = np.array([_kd_all.find(p)[1] for p in neutral_assets[k]], dtype=np.int64)
    deltas["ChestFlat_Pos"][k] = _dchest[_near]
log("morph ChestFlat_Pos", "max body delta %.4f m" % np.abs(_dchest).max())

# BackStraight: men stand with a straight back. The base keeps a woman's lumbar sway (the back
# curves in hard between the shoulder blades and the seat), which reads as a concave back on a male
# body. On the masculine body, the hollow of the lower back is filled towards the straight line
# from the shoulder blades to the seat, fading out across the back and at the sides. Masculine dolls
# wear it at 1 (shared/studio/presets.ts).
_Pm = neutral_body + deltas["Masc_Pos"]["__body__"]
_zb = _Pm[:, 2]
_H = _zb.max() - _zb.min()
_z0 = _zb.min()
_mid = np.abs(_Pm[:, 0]) < 0.03
_back_of = lambda f: float(_Pm[_mid & (np.abs(_zb - (_z0 + f * _H)) < 0.008 * _H)][:, 1].max())
_f_hi, _f_lo = 0.735, 0.505
_y_hi, _y_lo = _back_of(_f_hi), _back_of(_f_lo)
_dback = np.zeros_like(_Pm)
_bgi = human.vertex_groups["body"].index
_bodyv = np.array([any(g.group == _bgi and g.weight > 0.5 for g in v.groups) for v in human.data.vertices])
for _f in np.arange(_f_lo + 0.01, _f_hi, 0.005):
    _band = (np.abs(_zb - (_z0 + _f * _H)) < 0.0026 * _H) & _bodyv
    if not _band.any():
        continue
    _sel = _band & _mid
    if not _sel.any():
        continue
    _ycur = float(_Pm[_sel][:, 1].max())
    _t = (_f - _f_lo) / (_f_hi - _f_lo)
    _yline = _y_lo + (_y_hi - _y_lo) * _t
    _fill = max(0.0, _yline - _ycur - 0.004)  # leave a natural little curve
    if _fill <= 0:
        continue
    _ys = _Pm[_band][:, 1]
    _xs = _Pm[_band][:, 0]
    _half = max(0.06, float(np.abs(_xs).max()) * 0.85)
    _w_x = np.clip(np.cos(np.clip(np.abs(_xs) / _half, 0, 1) * math.pi / 2), 0, 1) ** 1.5
    _ymid = float(np.median(_ys))
    _w_y = np.clip((_ys - _ymid) / max(_ycur - _ymid, 1e-4), 0, 1) ** 1.5
    _dback[np.nonzero(_band)[0], 1] = _fill * _w_x * _w_y
# smooth it over the surface so it never makes a ridge
for _ in range(25):
    _acc = np.zeros_like(_dback)
    np.add.at(_acc, _E[:, 0], _dback[_E[:, 1]])
    np.add.at(_acc, _E[:, 1], _dback[_E[:, 0]])
    _dback = _dback * 0.5 + 0.5 * _acc / np.maximum(_deg, 1)[:, None]
deltas["BackStraight_Pos"] = {"__body__": _dback}
for k, o in assets.items():
    _near = np.array([_kd_all.find(p)[1] for p in neutral_assets[k]], dtype=np.int64)
    deltas["BackStraight_Pos"][k] = _dback[_near]
log("morph BackStraight_Pos", "max body delta %.4f m" % np.abs(_dback).max(), "lumbar hollow line %.3f -> %.3f" % (_y_lo, _y_hi))

# Hand-built hair has no MPFB fitting data: each vertex follows the nearest head/neck skin (inverse
# distance over 4 neighbours), so face sliders reshape the hair with the skull. Hanging lengths
# take the delta at the nape, i.e. they ride along rigidly.
from mathutils.kdtree import KDTree  # noqa: E402

_body_grp = human.vertex_groups["body"].index
_neck_z = (rig.matrix_world @ rig.data.bones["mixamorig:Neck"].head_local).z
# the nipple and five rings round it: where a garment's shape changes are relaxed (see below)
_bust_soft = _nring.copy()
for _ in range(2):
    _r2 = _bust_soft.copy()
    _r2[_E[_bust_soft[_E[:, 0]], 1]] = True
    _r2[_E[_bust_soft[_E[:, 1]], 0]] = True
    _bust_soft = _r2

# Soft nipples: the tips are relaxed into the breast (the areola stays in the skin texture), at rest
# and in every shape key, so a fitted top, corset or dress lies smoothly over the bust and nothing
# pierces the fabric. Done before garments copy the body's changes, so they match exactly.
_bdeg = np.maximum(np.bincount(_E.ravel(), minlength=len(neutral_body)), 1).astype(np.float64)


def _relax(f, mask, iters=40, k=0.6):
    f = f.copy()
    for _ in range(iters):
        acc = np.zeros_like(f)
        np.add.at(acc, _E[:, 0], f[_E[:, 1]])
        np.add.at(acc, _E[:, 1], f[_E[:, 0]])
        f[mask] += (acc[mask] / _bdeg[mask][:, None] - f[mask]) * k
    return f


neutral_body[:] = _relax(neutral_body, _bust_soft, iters=90, k=0.7)
for _name, _d in deltas.items():
    if _name != "ChestFlat_Pos":
        _d["__body__"] = _relax(_d["__body__"], _bust_soft, iters=90, k=0.7)
log("soft nipples", int(_nring.sum()), "verts at rest,", int(_bust_soft.sum()), "in the keys")

_anchor = np.array([any(g.group == _body_grp and g.weight > 0.5 for g in v.groups) for v in human.data.vertices]) & (neutral_body[:, 2] > _neck_z - 0.02)
_anchor_idx = np.nonzero(_anchor)[0]
_kd = KDTree(len(_anchor_idx))
for _j, _i in enumerate(_anchor_idx):
    _kd.insert(neutral_body[_i], _j)
_kd.balance()
neutral_custom = {}
for k, o in custom.items():
    if k.startswith("Outfit_"):
        continue
    co_ = coords(o, mix=False)
    neutral_custom[k] = co_
    nbr = np.empty((len(co_), 4), dtype=np.int64)
    wts = np.empty((len(co_), 4))
    for vi, p in enumerate(co_):
        hits = _kd.find_n(p, 4)
        nbr[vi] = [_anchor_idx[h[1]] for h in hits]
        w = np.array([1.0 / max(h[2], 1e-4) for h in hits])
        wts[vi] = w / w.sum()
    for name, d in deltas.items():
        d[k] = (d["__body__"][nbr] * wts[..., None]).sum(axis=1)


# Store outfits: a shell vertex takes the morph deltas of the body vertex it was cut from (so it
# follows every shape exactly); tube vertices (skirts) blend the 6 nearest skin vertices below the neck.
_body_in = np.array([any(g.group == _body_grp and g.weight > 0.5 for g in v.groups) for v in human.data.vertices])
_below = np.nonzero(_body_in & (neutral_body[:, 2] < _neck_z))[0]
_kd_b = KDTree(len(_below))
for _j, _i in enumerate(_below):
    _kd_b.insert(neutral_body[_i], _j)
_kd_b.balance()
for k, o in custom.items():
    if not k.startswith("Outfit_"):
        continue
    co_ = coords(o, mix=False)
    neutral_custom[k] = co_
    src_ = np.empty(len(co_), dtype=np.int32)
    o.data.attributes["_src"].data.foreach_get("value", src_)
    assert src_.max() < len(neutral_body), "store outfit was built on a different base mesh"
    nbr = np.empty((len(co_), 6), dtype=np.int64)
    wts = np.empty((len(co_), 6))
    for vi, p in enumerate(co_):
        if src_[vi] >= 0:
            nbr[vi] = src_[vi]
            wts[vi] = 1 / 6
            continue
        hits = _kd_b.find_n(p, 6)
        nbr[vi] = [_below[h[1]] for h in hits]
        w = np.array([1.0 / max(h[2], 1e-4) ** 2 for h in hits])
        wts[vi] = w / w.sum()
    for name, d in deltas.items():
        d[k] = (d["__body__"][nbr] * wts[..., None]).sum(axis=1)
    # Over the nipples the fabric stays smooth in EVERY body shape: a shell vertex copies its body
    # vertex's changes exactly, and the bust keys grow the nipple's point, which would push straight
    # through a fitted top. There the changes are relaxed over the garment's own surface.
    _over = (src_ >= 0) & _bust_soft[np.maximum(src_, 0)]
    if _over.any():
        _ge = np.empty(len(o.data.edges) * 2, dtype=np.int64)
        o.data.edges.foreach_get("vertices", _ge)
        _ge = _ge.reshape(-1, 2)
        _gdeg = np.maximum(np.bincount(_ge.ravel(), minlength=len(co_)), 1).astype(np.float64)
        for name, d in deltas.items():
            f_ = d[k].copy()
            for _ in range(40):
                acc = np.zeros_like(f_)
                np.add.at(acc, _ge[:, 0], f_[_ge[:, 1]])
                np.add.at(acc, _ge[:, 1], f_[_ge[:, 0]])
                f_[_over] += (acc[_over] / _gdeg[_over][:, None] - f_[_over]) * 0.6
            d[k] = f_
    o.data.attributes.remove(o.data.attributes["_src"])

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
for k, o in custom.items():
    asset_keys[k] = add_keys(o, neutral_custom[k], [(n, d[k]) for n, d in deltas.items()])

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
for obj in [human, *assets.values(), *custom.values()]:
    for g in obj.vertex_groups:
        if g.name.startswith("mixamorig:"):
            g.name = g.name.replace("mixamorig:", "")
    for m in list(obj.modifiers):
        if m.type in ("MASK", "SUBSURF"):
            obj.modifiers.remove(m)
for k, o in assets.items():
    o.name = k
hair_objs = {h: custom.get(f"Hair_{h}") or assets[f"Hair_{h}"] for h in HAIR}

# Skin-weight cleanup at the shoulders. With the arms relaxed down from the A-pose, linear blend
# skinning folded ~30 triangles at each garment's armpit/shoulder seam (the "torn sleeve" shards):
# MakeHuman's weights change too abruptly between Spine2, Shoulder and Arm, and the glTF export
# then keeps only the 4 strongest bones per vertex. Smoothing those weights over the mesh (and
# keeping the 4 strongest, renormalised, ourselves) removes the folds; measured in the app with
# the relaxed pose, the sports top went from 34 folded triangles to 0-1.
_DEFORM = {b.name for b in rig.data.bones if b.use_deform}
_SHOULDER = ["LeftShoulder", "LeftArm", "RightShoulder", "RightArm"]


def smooth_skin(obj, bones=_SHOULDER, iters=12, alpha=0.5, rings=2):
    me = obj.data
    nv = len(me.vertices)
    groups = [g for g in obj.vertex_groups if g.name in _DEFORM]
    if not groups or not len(me.edges):
        return 0
    col = {g.index: j for j, g in enumerate(groups)}
    W = np.zeros((nv, len(groups)), dtype=np.float64)
    for v in me.vertices:
        for g in v.groups:
            j = col.get(g.group)
            if j is not None:
                W[v.index, j] = g.weight
    s = W.sum(axis=1, keepdims=True)
    W = np.where(s > 0, W / np.maximum(s, 1e-12), W)
    tgt = [col[obj.vertex_groups[b].index] for b in bones if b in obj.vertex_groups and obj.vertex_groups[b].index in col]
    if not tgt:
        return 0
    region = (W[:, tgt] > 1e-4).any(axis=1)
    e = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    for _ in range(rings):
        grow = region.copy()
        grow[e[region[e[:, 0]], 1]] = True
        grow[e[region[e[:, 1]], 0]] = True
        region = grow
    deg = np.bincount(e.ravel(), minlength=nv).astype(np.float64)

    def top4(W):
        # what the glTF export keeps: the 4 strongest bones, renormalised
        keep = np.argsort(-W, axis=1)[:, :4]
        out = np.zeros_like(W)
        np.put_along_axis(out, keep, np.take_along_axis(W, keep, axis=1), axis=1)
        return out / np.maximum(out.sum(axis=1, keepdims=True), 1e-12)

    # Smooth what will actually be exported: cut to 4 bones, smooth, cut again, smooth again.
    # (Smoothing the full weights and cutting afterwards left ~20 folds per garment.)
    for _round in range(2):
        W = top4(W)
        for _ in range(iters):
            acc = np.zeros_like(W)
            np.add.at(acc, e[:, 0], W[e[:, 1]])
            np.add.at(acc, e[:, 1], W[e[:, 0]])
            avg = acc / np.maximum(deg, 1)[:, None]
            W[region] = (1 - alpha) * W[region] + alpha * avg[region]
    idx = np.argsort(-W, axis=1)[:, :4]
    top = np.take_along_axis(W, idx, axis=1)
    top /= np.maximum(top.sum(axis=1, keepdims=True), 1e-12)
    verts = [int(i) for i in np.nonzero(region)[0]]
    for g in groups:
        g.remove(verts)
    for vi in verts:
        for k in range(4):
            if top[vi, k] > 1e-4:
                groups[idx[vi, k]].add([vi], float(top[vi, k]), "REPLACE")
    return len(verts)


def hair_off_arms(obj):
    """Hair must ride the head, neck and spine only. MPFB's library hair inherits the body's
    shoulder/arm weights where it lies on the shoulders, so its lengths followed the arms and
    swung through the chest and arms whenever they moved (the 'hair through the body' defect).
    Those weights move to the upper spine (Spine2), which carries the shoulders' rest position."""
    arm = [g for g in obj.vertex_groups if g.name in _DEFORM and any(k in g.name for k in ("Shoulder", "Arm", "Hand"))]
    if not arm:
        return 0
    spine = obj.vertex_groups.get("Spine2") or obj.vertex_groups.new(name="Spine2")
    idx = {g.index for g in arm}
    moved = 0
    for v in obj.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in idx)
        if w <= 0:
            continue
        cur = next((g.weight for g in v.groups if g.group == spine.index), 0.0)
        spine.add([v.index], cur + w, "REPLACE")
        moved += 1
    for g in arm:
        obj.vertex_groups.remove(g)
    return moved


_hair_set = set(hair_objs.values())
for _o in [human, *assets.values(), *custom.values()]:
    if _o.name.startswith(("Brows_", "Lashes_")) or _o is assets.get("Eyes"):
        continue
    if _o in _hair_set:
        log("hair weights moved off the arms", _o.name, hair_off_arms(_o), "verts")
        continue
    log("smoothed shoulder weights", _o.name, smooth_skin(_o), "verts")

# "_tip" (0 at the root .. 1 at the ends) drives the app's ombre. Hand-built hair carries its own;
# library hair gets one from how far each vertex sits off the skin and how far it hangs below the crown.
_skin_kd = KDTree(len(neutral_body))
for _i in np.nonzero(keep)[0]:
    _skin_kd.insert(neutral_body[_i], int(_i))
_skin_kd.balance()
for h, o in hair_objs.items():
    if "_tip" in o.data.attributes:
        continue
    co_ = coords(o, mix=False)
    off = np.array([_skin_kd.find(p)[2] for p in co_])
    drop = co_[:, 2].max() - co_[:, 2]
    t = 0.35 * off / max(np.percentile(off, 95), 1e-4) + 0.65 * drop / max(drop.max(), 1e-4)
    a = o.data.attributes.new("_tip", "FLOAT", "POINT")
    a.data.foreach_set("value", np.clip(t, 0, 1).astype(np.float32))

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

# -- skincare regions: where products land when the hands work over the face (face_d / face_e)
E = (eyeL + eyeR) / 2
lz0 = (co[:, 2] - E[2]) / d
ax = np.abs(co[:, 0]) / d
not_scalp = 1 - vsmooth(flag("scalp"), 2)[:, 0]
r_fore = face * smoothstep(0.42, 0.7, lz0) * not_scalp * head_front
r_cheek = {s: ellipse(co[:, 0] * s / d, lz0, 0.82, -0.62, 0.62, 0.5) * (co[:, 0] * s > 0) * head_front for s in (1, -1)}
r_nose = smoothstep(0.34, 0.16, ax) * smoothstep(-0.95, -0.75, lz0) * smoothstep(0.12, -0.05, lz0) * head_front
lzl = (co[:, 2] - lips_c[2]) / d
r_chin = smoothstep(0.85, 0.5, ax) * smoothstep(-0.3, -0.45, lzl) * smoothstep(-1.45, -1.15, lzl) * head_front
r_perim = face * np.clip(smoothstep(1.05, 1.45, ax) + smoothstep(-1.2, -1.6, lzl), 0, 1)
inner = np.zeros(nv)
for EE, s in ((eyeL, 1), (eyeR, -1)):
    lx, lz, _ly = side(EE, s)
    inner = np.maximum(inner, ellipse(lx, lz, -0.38, -0.02, 0.16, 0.13) * head_front)
r_browbone = np.zeros(nv)
for EE, s in ((eyeL, 1), (eyeR, -1)):
    lx, lz, _ly = side(EE, s)
    r_browbone = np.maximum(r_browbone, ellipse(lx, lz, 0.18, 0.36, 0.42, 0.12) * head_front)
smooth_ = lambda a: vsmooth(a[:, None], 2)[:, 0]
fd = raster(np.stack([smooth_(r_fore), smooth_(r_cheek[1]), smooth_(r_cheek[-1]), smooth_(r_nose)], axis=1), MS, face_rect)
fe = raster(np.stack([smooth_(r_chin), smooth_(r_perim), smooth_(inner), smooth_(r_browbone)], axis=1), MS, face_rect)
save_px(fd, os.path.join(OUT, "masks", "face_d.png"))
save_px(fe, os.path.join(OUT, "masks", "face_e.png"))

# -- landmarks, wipe paths, blemish spots, nail and piercing anchors (glTF model space: x, z, -y)
vert_uv = np.zeros((nv, 2))
_lp = np.empty(len(mesh.loops) * 2)
uv_layer.foreach_get("uv", _lp)
_lp = _lp.reshape(-1, 2)
_lv = np.empty(len(mesh.loops), dtype=np.int64)
mesh.loops.foreach_get("vertex_index", _lv)
for li in np.argsort(_lp[:, 0]):  # later (larger u) wins: the head island sits on the right
    vert_uv[_lv[li]] = _lp[li]
vnorm = np.empty(nv * 3)
mesh.vertices.foreach_get("normal", vnorm)
vnorm = vnorm.reshape(-1, 3)
gl = lambda p: [round(float(p[0]), 5), round(float(p[2]), 5), round(float(-p[1]), 5)]
front_y = E[1] + 0.5 * d


def snap_front(x, z, rad=0.22):
    m = (np.abs(co[:, 0] - x) < rad * d) & (np.abs(co[:, 2] - z) < rad * d) & (co[:, 1] < front_y + 1.2 * d)
    idx = np.nonzero(m)[0]
    if not len(idx):
        return int(np.argmin(np.linalg.norm(co - [x, E[1] - d, z], axis=1)))
    return int(idx[np.argmin(co[idx, 1])])


def snap_near(p):
    return int(np.argmin(np.linalg.norm(co - np.asarray(p), axis=1)))


def mark(i):
    return {"p": gl(co[i]), "n": gl(vnorm[i]), "uv": [round(float(vert_uv[i][0]), 5), round(float(1 - vert_uv[i][1]), 5)]}


ex = lambda f: E[0] + f * d
ez = lambda f: E[2] + f * d
lmz = lambda f: lips_c[2] + f * d
landmarks = {
    "foreheadC": snap_front(ex(0), ez(0.85)),
    "foreheadL": snap_front(ex(0.65), ez(0.8)),
    "foreheadR": snap_front(ex(-0.65), ez(0.8)),
    "cheekL": snap_front(ex(0.85), ez(-0.6)),
    "cheekR": snap_front(ex(-0.85), ez(-0.6)),
    "noseBridge": snap_front(ex(0), ez(-0.15)),
    "noseTip": snap_front(ex(0), ez(-0.62)),
    "chin": snap_front(ex(0), lmz(-0.75)),
    "underEyeL": snap_front(ex(0.5), ez(-0.32)),
    "underEyeR": snap_front(ex(-0.5), ez(-0.32)),
    "lips": snap_front(ex(0), lmz(0)),
    "lipCornerL": snap_front(ex(0.42), lmz(0.02)),
    "lipCornerR": snap_front(ex(-0.42), lmz(0.02)),
    "templeL": snap_near([E[0] + 1.45 * d, E[1] + 0.35 * d, ez(0.35)]),
    "templeR": snap_near([E[0] - 1.45 * d, E[1] + 0.35 * d, ez(0.35)]),
    "jawL": snap_near([E[0] + 1.15 * d, E[1] + 0.25 * d, lmz(-0.55)]),
    "jawR": snap_near([E[0] - 1.15 * d, E[1] + 0.25 * d, lmz(-0.55)]),
    "neck": snap_front(ex(0), lmz(-2.3), rad=0.5),
}
ears = final_flags["ears"]
for s, nm in ((1, "L"), (-1, "R")):
    idx = np.nonzero(ears & (co[:, 0] * s > 0))[0]
    if len(idx):
        landmarks["earLobe" + nm] = int(idx[np.argmin(co[idx, 2])])
        landmarks["earHelix" + nm] = int(idx[np.argmax(co[idx, 2] + co[idx, 1] * 0.5)])
        landmarks["ear" + nm] = int(idx[np.argmin(np.linalg.norm(co[idx] - co[idx].mean(axis=0), axis=1))])
tip = co[landmarks["noseTip"]]
landmarks["septum"] = snap_near([0.0, tip[1] + 0.12 * d, tip[2] - 0.2 * d])
landmarks["nostrilL"] = snap_front(ex(0.22), ez(-0.7))
landmarks["nostrilR"] = snap_front(ex(-0.22), ez(-0.7))
landmarks["labret"] = snap_front(ex(0), lmz(-0.38))
landmarks["browEndR"] = snap_front(ex(-0.95), ez(0.32))
H_ = float(co[:, 2].max() - co[:, 2].min())
# navel: on the front midline, ~60% of her height up (front-most points of that band, then the
# deepest of them, i.e. the hollow)
_bi = np.nonzero((np.abs(co[:, 0]) < 0.012) & (np.abs(co[:, 2] - (co[:, 2].min() + 0.6 * H_)) < 0.05) & (co[:, 1] < 0))[0]
if len(_bi):
    _front = _bi[np.argsort(co[_bi, 1])[: max(3, len(_bi) // 3)]]
    landmarks["navel"] = int(_front[np.argmax(co[_front, 1])])


def path(points):
    return [mark(snap_front(ex(x), z))["p"] for x, z in points]


strokes = {
    "forehead": path([(x, ez(0.78)) for x in np.linspace(-0.95, 0.95, 7)]),
    # circles around each cheek (x, z both in interocular units)
    "cheekL": [mark(snap_front(ex(0.82 + 0.26 * math.cos(a)), ez(-0.6 + 0.22 * math.sin(a))))["p"] for a in np.linspace(0, 2 * math.pi, 9)],
    "cheekR": [mark(snap_front(ex(-0.82 + 0.26 * math.cos(a)), ez(-0.6 + 0.22 * math.sin(a))))["p"] for a in np.linspace(0, 2 * math.pi, 9)],
    "nose": path([(0, ez(-0.1)), (0, ez(-0.35)), (0, ez(-0.58)), (0.15, ez(-0.66)), (-0.15, ez(-0.66))]),
    "chin": path([(x, lmz(-0.72)) for x in np.linspace(-0.45, 0.45, 5)]),
    "underEyeL": path([(x, ez(-0.34)) for x in np.linspace(0.25, 0.78, 4)]),
    "underEyeR": path([(x, ez(-0.34)) for x in np.linspace(-0.25, -0.78, 4)]),
    "lips": path([(x, lmz(0.02)) for x in np.linspace(-0.42, 0.42, 5)]),
}
# blemish spots: forehead, cheeks, chin, nose side, jaw. r: the uv radius of a ~3.5 mm spot there.
_ed = np.empty(len(mesh.edges) * 2, dtype=np.int64)
mesh.edges.foreach_get("vertices", _ed)
_ed = _ed.reshape(-1, 2)


def uv_per_m(i):
    nb = np.concatenate([_ed[_ed[:, 0] == i, 1], _ed[_ed[:, 1] == i, 0]])
    if not len(nb):
        return 4.0
    return float(np.mean(np.linalg.norm(vert_uv[nb] - vert_uv[i], axis=1) / np.maximum(np.linalg.norm(co[nb] - co[i], axis=1), 1e-5)))


spots = []
for name, x, z in (("forehead1", -0.42, ez(0.7)), ("forehead2", 0.32, ez(0.9)), ("cheekL", 0.95, ez(-0.5)), ("cheekR", -0.78, ez(-0.72)),
                   ("chin", 0.14, lmz(-0.7)), ("nose", 0.24, ez(-0.5)), ("jawR", -0.95, lmz(-0.45)), ("cheekL2", 0.62, ez(-0.85))):
    i = snap_front(ex(x), z)
    m_ = mark(i)
    m_["id"] = name
    m_["r"] = round(0.0035 * uv_per_m(i), 5)
    spots.append(m_)

# nails: each fingernail patch, the distal finger bone it rides on, its centre, normal and pointing direction
nail_idx = np.nonzero(final_flags["fingernails"])[0]
distal = [f"{side_}Hand{f}3" for side_ in ("Left", "Right") for f in ("Thumb", "Index", "Middle", "Ring", "Pinky")]
bone_tip = {b: np.array(rig.matrix_world @ rig.data.bones[b].tail_local) for b in distal if b in rig.data.bones}
bone_head = {b: np.array(rig.matrix_world @ rig.data.bones[b].head_local) for b in bone_tip}
nails_out = []
if len(nail_idx) and bone_tip:
    names_ = list(bone_tip)
    tips_ = np.array([bone_tip[b] for b in names_])
    owner = np.argmin(np.linalg.norm(co[nail_idx][:, None, :] - tips_[None], axis=2), axis=1)
    for bi, b in enumerate(names_):
        vi = nail_idx[owner == bi]
        if len(vi) < 3:
            continue
        c = co[vi].mean(axis=0)
        n = vnorm[vi].mean(axis=0)
        n /= max(np.linalg.norm(n), 1e-6)
        dvec = bone_tip[b] - bone_head[b]
        dvec = dvec - n * dvec.dot(n)
        dvec /= max(np.linalg.norm(dvec), 1e-6)
        wv = np.cross(n, dvec)
        span = co[vi] - c
        nails_out.append({"bone": b, "p": gl(c), "n": gl(n), "dir": gl(dvec), "width": round(float(np.ptp(span @ wv)), 5), "length": round(float(np.ptp(span @ dvec)), 5)})


def ring(z, mask_, around=None):
    """Centre and mean radius of the body cross-section at height z (Blender), within mask_."""
    sel = np.nonzero(mask_ & (np.abs(co[:, 2] - z) < 0.006))[0]
    if not len(sel):
        return None
    c = co[sel].mean(axis=0)
    r = float(np.linalg.norm((co[sel] - c)[:, :2], axis=1).mean())
    return {"p": gl(c), "r": round(r, 5)}


neck_z = float((rig.matrix_world @ rig.data.bones["Neck"].head_local).z)
jewel = {"neckBase": ring(neck_z + 0.012, np.abs(co[:, 0]) < 0.09)}
for side_ in ("Left", "Right"):
    # wrist: the forearm cross-section 1.5 cm above the hand bone
    hb = np.array(rig.matrix_world @ rig.data.bones[f"{side_}Hand"].head_local)
    sel = np.nonzero(np.linalg.norm(co - hb, axis=1) < 0.05)[0]
    fa_dir = np.array(rig.data.bones[f"{side_}Hand"].head_local - rig.data.bones[f"{side_}ForeArm"].head_local)
    fa_dir /= np.linalg.norm(fa_dir)
    sec = sel[np.abs((co[sel] - hb) @ fa_dir + 0.015) < 0.006]
    if len(sec):
        c = co[sec].mean(axis=0)
        jewel[f"wrist{side_[0]}"] = {"p": gl(c), "r": round(float(np.linalg.norm((co[sec] - c) - np.outer((co[sec] - c) @ fa_dir, fa_dir), axis=1).mean()), 5), "dir": gl(fa_dir), "bone": f"{side_}Hand"}
    rb = f"{side_}HandRing1"
    if rb in rig.data.bones:
        h0 = np.array(rig.matrix_world @ rig.data.bones[rb].head_local)
        t0 = np.array(rig.matrix_world @ rig.data.bones[rb].tail_local)
        mid = h0 + (t0 - h0) * 0.45
        fd_ = (t0 - h0) / max(np.linalg.norm(t0 - h0), 1e-6)
        sec = np.nonzero((np.linalg.norm(co - mid, axis=1) < 0.02) & (np.abs((co - mid) @ fd_) < 0.003))[0]
        if len(sec):
            c = co[sec].mean(axis=0)
            jewel[f"ring{side_[0]}"] = {"p": gl(c), "r": round(float(np.linalg.norm((co[sec] - c) - np.outer((co[sec] - c) @ fd_, fd_), axis=1).mean()), 5), "dir": gl(fd_), "bone": rb}
# industrial piercing: a bar across the top of the ear, from the forward helix to the back of the rim
for s, nm in ((1, "L"), (-1, "R")):
    idx = np.nonzero(ears & (co[:, 0] * s > 0))[0]
    if len(idx):
        top = idx[co[idx, 2] > np.percentile(co[idx, 2], 72)]
        jewel["industrialA" + nm] = {"p": gl(co[top[np.argmin(co[top, 1])]]), "r": 0.0}
        jewel["industrialB" + nm] = {"p": gl(co[top[np.argmax(co[top, 1])]]), "r": 0.0}

# tattoo anchors: where on the body UV a tattoo sits, how many UV units a metre of skin is there,
# and which UV direction is "up" on the skin (along the limb / up the body), glTF UV convention.
_body_ok = final_flags["body"] if "body" in final_flags else np.ones(len(co), dtype=bool)


def bone_pt(name, t=0.0):
    b = rig.data.bones[name]
    h, tl = np.array(rig.matrix_world @ b.head_local), np.array(rig.matrix_world @ b.tail_local)
    return h + (tl - h) * t, (tl - h) / max(np.linalg.norm(tl - h), 1e-6)


def uv_jacobian(i):
    nb = np.concatenate([_ed[_ed[:, 0] == i, 1], _ed[_ed[:, 1] == i, 0]])
    dP = co[nb] - co[i]
    dU = vert_uv[nb] - vert_uv[i]
    J, *_ = np.linalg.lstsq(dP, dU, rcond=None)  # dU = dP @ J  (3x2)
    return J


# UV seams: a vertex whose loops carry different UVs (and its neighbours) has no single place in the
# texture, and its UV-per-metre is meaningless across the cut: tattoos never anchor there
_uvmin = np.full((nv, 2), np.inf)
_uvmax = np.full((nv, 2), -np.inf)
np.minimum.at(_uvmin, _lv, _lp)
np.maximum.at(_uvmax, _lv, _lp)
_seam = (np.abs(_uvmax - _uvmin).max(axis=1) > 1e-4)
_near_seam = _seam.copy()
_near_seam[_ed[_seam[_ed[:, 0]], 1]] = True
_near_seam[_ed[_seam[_ed[:, 1]], 0]] = True


def tattoo(p, r, pick, up):
    sel = np.nonzero(_body_ok & ~_near_seam & (np.linalg.norm(co - p, axis=1) < r))[0]
    if not len(sel):
        sel = np.nonzero(_body_ok & ~_seam & (np.linalg.norm(co - p, axis=1) < r * 1.6))[0]
    i = int(sel[np.argmax(pick(co[sel]))])
    up = np.asarray(up, dtype=float)
    up = up - vnorm[i] * up.dot(vnorm[i])
    J = uv_jacobian(i)
    d = up @ J
    d = d / max(np.linalg.norm(d), 1e-9)
    # the skin's right (seen from outside) in UV: tells the app whether this UV island is mirrored
    rt = np.cross(up / max(np.linalg.norm(up), 1e-9), vnorm[i]) @ J
    rt = rt / max(np.linalg.norm(rt), 1e-9)
    return {"uv": [round(float(vert_uv[i][0]), 5), round(float(1 - vert_uv[i][1]), 5)], "s": round(uv_per_m(i), 4), "up": [round(float(d[0]), 4), round(float(-d[1]), 4)], "right": [round(float(rt[0]), 4), round(float(-rt[1]), 4)], "p": gl(co[i]), "n": gl(vnorm[i])}


Z = np.array([0, 0, 1.0])
tattoos = {}
for side_, sg in (("Left", 1), ("Right", -1)):
    S_ = side_[0]
    fa, fa_d = bone_pt(f"{side_}ForeArm", 0.55)
    tattoos["forearm" + S_] = tattoo(fa, 0.05, lambda P: -P[:, 1], -fa_d)
    ua, ua_d = bone_pt(f"{side_}Arm", 0.35)
    tattoos["upperArm" + S_] = tattoo(ua, 0.06, lambda P, sg=sg: P[:, 0] * sg, -ua_d)
    sh, _ = bone_pt(f"{side_}Arm", 0.05)
    tattoos["shoulderBack" + S_] = tattoo(sh, 0.07, lambda P: P[:, 1], Z)
    ft, ft_d = bone_pt(f"{side_}Foot", 0.0)
    tattoos["ankle" + S_] = tattoo(ft + np.array([0, 0, 0.03]), 0.045, lambda P, sg=sg: P[:, 0] * sg, Z)
    lg, lg_d = bone_pt(f"{side_}Leg", 0.5)
    tattoos["calf" + S_] = tattoo(lg, 0.07, lambda P: P[:, 1], -lg_d)
    th, th_d = bone_pt(f"{side_}UpLeg", 0.4)
    tattoos["thigh" + S_] = tattoo(th, 0.1, lambda P, sg=sg: P[:, 0] * sg - P[:, 1] * 0.5, -th_d)
    hp, _ = bone_pt(f"{side_}UpLeg", 0.0)
    tattoos["hip" + S_] = tattoo(hp + np.array([0, 0, 0.03]), 0.09, lambda P, sg=sg: -P[:, 1] + P[:, 0] * sg * 0.6, Z)
    sp2, _ = bone_pt("Spine2", 0.2)
    tattoos["ribs" + S_] = tattoo(sp2 + np.array([0.0, 0, -0.06]), 0.16, lambda P, sg=sg: P[:, 0] * sg, Z)
    tattoos["chest" + S_] = tattoo(np.array([0.065 * sg, -0.08, neck_z - 0.075]), 0.06, lambda P: -P[:, 1], Z)
    wr, wr_d = bone_pt(f"{side_}Hand", 0.0)
    tattoos["wrist" + S_] = tattoo(wr - wr_d * 0.02, 0.035, lambda P: -P[:, 1], -wr_d)
    # the side of the neck (below the ear) and the face (on the cheekbone, under the outer eye)
    nks, _ = bone_pt("Neck", 0.45)
    tattoos["neckSide" + S_] = tattoo(nks + np.array([0.04 * sg, -0.005, 0]), 0.03, lambda P, sg=sg: P[:, 0] * sg - np.abs(P[:, 1]) * 0.3, Z)
    fc = co[landmarks["cheek" + S_]] * 0.45 + co[landmarks["temple" + S_]] * 0.55 + np.array([0, 0, -0.012])
    tattoos["face" + S_] = tattoo(fc, 0.012, lambda P: -P[:, 1], Z)
nk, _ = bone_pt("Neck", 0.3)
tattoos["nape"] = tattoo(nk, 0.06, lambda P: P[:, 1], Z)
sp0, _ = bone_pt("Spine", 0.2)
tattoos["lowerBack"] = tattoo(sp0, 0.12, lambda P: P[:, 1] - np.abs(P[:, 0]) * 2, Z)
tattoos["sternum"] = tattoo(np.array([0, -0.1, neck_z - 0.2]), 0.08, lambda P: -P[:, 1] - np.abs(P[:, 0]) * 2, Z)
log("landmarks", len(landmarks), "spots", len(spots), "nails", len(nails_out), "jewellery anchors", [k for k, v in jewel.items() if v], "tattoo anchors", len(tattoos))
care_data = {
    "landmarks": {k: mark(i) for k, i in landmarks.items()},
    "strokes": strokes,
    "spots": spots,
    "nails": nails_out,
    "jewellery": {k: v for k, v in jewel.items() if v},
    "tattoos": tattoos,
}
nails = raster(np.maximum(flag("fingernails"), flag("toenails")), 1024)[..., 0]
save_px(np.dstack([nails, np.zeros_like(nails), np.zeros_like(nails), np.ones_like(nails)]), os.path.join(OUT, "masks", "body.png"))

# body-hide masks: skin faces fully inside an outfit's delete group are discarded at runtime
hide_files = {}
_final_index = np.cumsum(keep) - 1
for oid, meta in store_meta.items():
    m_ = np.zeros(len(co), dtype=np.float32)
    idx_ = np.array([i for i in meta["hide"] if keep[i]], dtype=np.int64)
    if len(idx_):
        m_[_final_index[idx_]] = 1.0
        m = raster(m_[:, None], 1024, mode="all")[..., 0]
        hide_files[f"Outfit_{oid}"] = save_px(m, os.path.join(OUT, "masks", f"hide_{oid}.png"))
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
for h, (source, _name) in HAIR.items():
    if source == "blend":
        # Hand-built: textures are already tint-ready (art/hair_tex). Swap the Blender preview shaders
        # for plain exportable ones; "Accent"/"Bead" slots (cuffs, beads) keep their own colour.
        o = hair_objs[h]
        for i, m in enumerate(o.data.materials):
            if m.name.startswith("HairFuzz"):
                o.data.materials[i] = material("HairFuzz", os.path.join(HAIR_TEX, f"{h}_fuzz.png"), alpha=True)
            elif m.name.startswith("Hair"):
                nrm = os.path.join(HAIR_TEX, f"{h}_n.png")
                o.data.materials[i] = material("Hair", os.path.join(HAIR_TEX, f"{h}.png"), nrm if os.path.exists(nrm) else None, alpha=True)
        continue
    src = source.split(":", 1)[1]
    t = mhmat_textures(os.path.join(ASSETS, "hair", src))
    p = save_px(tint_ready(t["diffuseTexture"], 1024), os.path.join(OUT, "tex", f"{h}.png"))
    nrm = None
    if "normalmapTexture" in t:
        nrm = save_px(resize(load_px(t["normalmapTexture"])[..., :3], 1024), os.path.join(OUT, "tex", f"{h}_n.png"))
    assign(hair_objs[h], material("Hair", p, nrm, alpha=True))
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
        export_attributes=True,  # "_tip" for the hair ombre
    )
    log("exported", path, "%.1f MB" % (os.path.getsize(path) / 1e6))


export(os.path.join(OUT, "body.glb"), [human, assets["Eyes"], *[assets[f"Brows_{b}"] for b in BROWS], *[assets[f"Lashes_{l}"] for l in LASHES]])
for h in HAIR:
    export(os.path.join(OUT, "hair", f"{h}.glb"), [hair_objs[h]])
for c in OUTFITS:
    export(os.path.join(OUT, "outfits", f"{c}.glb"), [assets[f"Outfit_{c}"]])
for oid in STORE_OUTFITS:
    export(os.path.join(OUT, "pieces", f"{oid}.glb"), [custom[f"Outfit_{oid}"]])
for s in SHOES:
    export(os.path.join(OUT, "shoes", f"{s}.glb"), [assets[f"Shoes_{s}"]])

# Loader silhouettes: a light copy of the body (no shape keys, decimated) and a few hair shapes, on the
# same rig, so the boot screen can walk three dolls before the full 3 MB character has downloaded.
sil_mat = bpy.data.materials.new("Silhouette")
sil = []
for src_obj, ratio, nm in [(human, 0.22, "Sil_Body")] + [(hair_objs[h], 0.35, f"Sil_{h}") for h in ("ponytail01", "bob02", "afro_big", "afro") if h in hair_objs][:3]:
    o = src_obj.copy()
    o.data = src_obj.data.copy()
    bpy.context.scene.collection.objects.link(o)
    o.shape_key_clear()
    o.name = o.data.name = nm
    for m in list(o.modifiers):
        if m.type != "ARMATURE":
            o.modifiers.remove(m)
    activate(o)
    dec = o.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = ratio
    bpy.ops.object.modifier_move_to_index(modifier="Decimate", index=0)
    bpy.ops.object.modifier_apply(modifier="Decimate")
    o.data.materials.clear()
    o.data.materials.append(sil_mat)
    for a in [a.name for a in o.data.attributes if a.name.startswith("_")]:
        o.data.attributes.remove(o.data.attributes[a])
    sil.append(o)
export(os.path.join(OUT, "silhouette.glb"), sil)


def morph_entry(name, group):
    return {"id": name, "neg": f"{name}_Neg" in body_keys, "pos": f"{name}_Pos" in body_keys, "group": group}


manifest = {
    "version": 1,
    "license": "CC0-1.0 (MakeHuman / MPFB system assets)",
    "generator": "scripts/character/build_character.py",
    "macros": MACROS,
    "heightM": float(co[:, 2].max() - co[:, 2].min()),
    "morphs": [morph_entry(n, "face") for n in FACE_MORPHS] + [morph_entry(n, "body") for n in BODY_MORPHS] + [morph_entry("ChestFlat", "body"), morph_entry("BackStraight", "body")],
    "faceRect": face_rect,
    "masks": {
        "faceA": ["lips", "linerUpper", "eyelid", "blush"],
        "faceB": ["contour", "highlight", "underEye", "browFill"],
        "faceC": ["face", "lipLiner", "scalpHair", "linerLower"],
        "faceD": ["forehead", "cheekL", "cheekR", "nose"],
        "faceE": ["chin", "perimeter", "innerCorner", "browBone"],
        "body": ["nails"],
    },
    "eyes": EYES,
    "brows": BROWS,
    "lashes": LASHES,
    "hair": [{"id": k, "name": v, "morphs": asset_keys[f"Hair_{k}"]} for k, (_src, v) in HAIR.items()],
    "outfits": [{"id": k, "name": v, "store": OUTFIT_STORES.get(k), "ease": 0.0, "hideMask": f"Outfit_{k}" in hide_files} for k, v in OUTFITS.items()]
,
    "shoes": [{"id": k, "name": v, "hideMask": f"Shoes_{k}" in hide_files} for k, v in SHOES.items()],
    # wardrobe pieces: slot, store, default colours (primary, secondary, accent), finish, and for
    # shoes the foot arch (radians) and how far they lift the doll (m)
    "pieces": [
        {"id": k, "name": v["name"], "slot": v["slot"], "store": v["store"], "colors": v["colors"], "finish": v.get("finish", "cotton"), "ease": round(store_meta[k]["ease"], 4), "hideMask": f"Outfit_{k}" in hide_files, **({"arch": v["arch"], "lift": v["lift"]} if "arch" in v else {})}
        for k, v in STORE_OUTFITS.items()
    ],
    "expressions": [n for n in EXPRESSIONS if n in body_keys],
    "care": care_data,
}
with open(os.path.join(OUT, "character.json"), "w") as f:
    json.dump(manifest, f, indent=2)
log("done", OUT)

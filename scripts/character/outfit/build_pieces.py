"""
Reusable, recolourable wardrobe pieces for DollScene (Phase 0 of the October 2026 brief).

    /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/character/outfit/build_pieces.py [-- <id> ...]
    PIECE_RENDER=0 skips the preview sheets; OUTFIT_ENGINE=cycles OUTFIT_SAMPLES=16 renders on the CPU.

Every piece is ONE slot (top, bottom, dress, shoes) and is shared by every doll: dolls are presets
that reference pieces plus three colours each. A piece's texture doesn't hold colour. It holds:

    R  detail: weave, shading, seams, fades, sequin sparkle (≈0.72 is "the colour itself")
    G  where the SECONDARY colour goes (a print, a trim, a stripe, embroidery)
    B  where the ACCENT colour goes (an outline, stitching, buttons, a second motif)
    A  holes (lace, mesh, rips): 0 = no fabric

and primary = 1 - G - B. The app mixes primary / secondary / accent per doll, so Bibi's crop tank in
red and yellow, green and yellow, blue and orange... is one asset. Material names carry the finish:
Piece_cotton, Piece_satin, Piece_denim, Piece_sequin, Piece_velvet, Piece_lace (alpha), Piece_net
(alpha), Piece_leather (shoes). Shapes are made as in garmentkit.py (shells cut from the body: no
clipping on any body; tubes for skirts). Shoes are built on feet posed for their heel (arch), and
store the arch and the lift the doll needs.

Store names (src/studio/rooms.ts): thai, moncherie, novasport, dopebyfabby, dejideji, tolaptsd,
okrika (the thrift store), booty.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import build_outfits as bo  # noqa: E402
import garmentkit as gk  # noqa: E402
from garmentkit import smoothstep  # noqa: E402

T = 2048
TT = 1024
OUT_DIR = os.path.join(gk.ART, "pieces")
TEX_DIR = os.path.join(gk.ROOT, "art", "piece_tex")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(TEX_DIR, exist_ok=True)

# id -> {name, slot, store, colors, finish, ...}: written to art/blender/pieces/catalog.json
CATALOG = {}

ROUGH = {"cotton": 0.8, "satin": 0.36, "denim": 0.9, "sequin": 0.3, "velvet": 0.7, "lace": 0.7, "net": 0.7, "leather": 0.42, "patent": 0.18}
METAL = {"sequin": 0.35}


# ----------------------------------------------------------------------------- encoding & painting


def zeros(shape):
    return np.zeros(shape[:2], dtype=np.float64)


def paint_shell(base, faces, F, fn, height_fn, strength=2.4):
    """fn(P, N, C, Fm) -> (D, W2, W3, A or None) over the body-UV raster; Fm = the cut field."""
    P, N, C, Fm = gk.position_map(base, faces, T, scalar=F)
    D, W2, W3, A = fn(P, N, C, Fm)
    rgb = np.dstack([np.clip(D, 0, 1), np.clip(W2, 0, 1), np.clip(W3, 0, 1)])
    rgb = gk.dilate_fill(rgb, C, it=12)
    a = np.ones(C.shape) if A is None else np.where(C > 0, np.clip(A, 0, 1), 1.0)
    if A is not None:
        a = gk.dilate_fill(np.dstack([a, a, a]), C, it=12)[..., 0]
    hgt = height_fn((T, T))
    return np.dstack([rgb, a]), gk.normal_from_height(hgt, strength)


def paint_tube(part, fn, height_fn, strength=2.4):
    """fn(U, V, ang) with U metres around from the front centre, V metres down from the top."""
    umax, vmax = part.dims
    ys, xs = np.mgrid[0:TT, 0:TT].astype(np.float64)
    U = (xs + 0.5) / TT * umax
    V = (1 - (ys + 0.5) / TT) * vmax
    ang = (xs + 0.5) / TT * 2 * math.pi
    D, W2, W3, A = fn(U, V, ang)
    a = np.ones(U.shape) if A is None else np.clip(A, 0, 1)
    return np.dstack([np.clip(D, 0, 1), np.clip(W2, 0, 1), np.clip(W3, 0, 1), a]), gk.normal_from_height(height_fn((TT, TT)), strength)


def preview_material(name, tex, nrm, colors, finish, alpha):
    """Blender preview only: decode the slots with the piece's default colours."""
    mat = bpy.data.materials.new(name + "_preview")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = ROUGH.get(finish, 0.75)
    bsdf.inputs["Metallic"].default_value = METAL.get(finish, 0.0)
    img = bpy.data.images.load(tex, check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(t.outputs["Color"], sep.inputs["Color"])
    lin = [gk.srgb2lin(gk.hexrgb(c)) for c in colors]
    # w1 = 1 - w2 - w3
    sub1 = nt.nodes.new("ShaderNodeMath")
    sub1.operation = "SUBTRACT"
    sub1.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs["Green"], sub1.inputs[1])
    sub2 = nt.nodes.new("ShaderNodeMath")
    sub2.operation = "SUBTRACT"
    sub2.use_clamp = True
    nt.links.new(sub1.outputs[0], sub2.inputs[0])
    nt.links.new(sep.outputs["Blue"], sub2.inputs[1])
    acc = None
    for w_out, c in ((sub2.outputs[0], lin[0]), (sep.outputs["Green"], lin[1]), (sep.outputs["Blue"], lin[2])):
        vm = nt.nodes.new("ShaderNodeVectorMath")
        vm.operation = "SCALE"
        vm.inputs[0].default_value = (*c,)
        nt.links.new(w_out, vm.inputs["Scale"])
        if acc is None:
            acc = vm.outputs[0]
        else:
            add = nt.nodes.new("ShaderNodeVectorMath")
            add.operation = "ADD"
            nt.links.new(acc, add.inputs[0])
            nt.links.new(vm.outputs[0], add.inputs[1])
            acc = add.outputs[0]
    k = nt.nodes.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = 1 / 0.72
    nt.links.new(sep.outputs["Red"], k.inputs[0])
    sc = nt.nodes.new("ShaderNodeVectorMath")
    sc.operation = "SCALE"
    nt.links.new(acc, sc.inputs[0])
    nt.links.new(k.outputs[0], sc.inputs["Scale"])
    nt.links.new(sc.outputs[0], bsdf.inputs["Base Color"])
    if alpha:
        nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
        mat.surface_render_method = "DITHERED"
    if nrm:
        nimg = bpy.data.images.load(nrm, check_existing=True)
        nimg.colorspace_settings.name = "Non-Color"
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = nimg
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


class Piece:
    """One wardrobe piece: parts, materials (each a finish), skin to hide, catalog metadata."""

    def __init__(self, base, pid, name, slot, store, colors, **meta):
        self.base = base
        self.id = pid
        self.parts = []
        self.mats = []
        self.previews = []
        self.hide = set()
        self.ease = 0.0
        self.n = 0
        CATALOG[pid] = {"name": name, "slot": slot, "store": store, "colors": colors, **meta}
        self.colors = colors

    def _material(self, finish, rgba, nrm):
        self.n += 1
        t = gk.save_rgba(rgba, os.path.join(TEX_DIR, f"{self.id}_p{self.n}.png"))
        n = gk.save_rgba(nrm, os.path.join(TEX_DIR, f"{self.id}_p{self.n}_n.png"))
        alpha = finish in ("lace", "net") or (rgba[..., 3] < 0.99).any()
        name = f"Piece_{finish}"
        self.mats.append(gk.material(name, t, n, alpha=alpha, roughness=ROUGH.get(finish, 0.75), metallic=METAL.get(finish, 0.0)))
        self.previews.append(preview_material(name, t, n, self.colors, finish, alpha))
        return len(self.mats) - 1

    def shell(self, F, ok, offset, fn, height, finish="cotton", inflate=20, rate=0.6, strength=2.4, hide_margin=0.035):
        base = self.base
        faces = base.faces_field(F, ok)
        rgba, nrm = paint_shell(base, faces, F, fn, height, strength)
        mi = self._material(finish, rgba, nrm)
        part = gk.shell(base, faces, offset, inflate=inflate, inflate_rate=rate, mat=mi, field=F)
        self.parts.append(part)
        if hide_margin is not None and rgba[..., 3].min() > 0.99:
            # skin under the fabric is hidden only well inside the edges: never at a hem or opening
            self.hide |= bo.covered(F, hide_margin) & set(i for f in faces for i in base.faces[f])
        return part

    def tube(self, rings, fn, height, finish="cotton", follow=0.6, radial=None, slit=None, strength=2.4, under=()):
        base = self.base
        part = gk.tube(base, rings, mat=0, radial=radial, slit=slit)
        if under:
            gk.over(part, list(under))
        rgba, nrm = paint_tube(part, fn, height, strength)
        part.mat = self._material(finish, rgba, nrm)
        gk.tube_weights(base, part, follow)
        self.parts.append(part)
        for z, c, r in part.rings:
            if 0.6 < z < 0.9:
                self.ease = max(self.ease, float(np.max(r - gk.hull_ring(base, z)[1])))
        return part

    def save(self, thickness=0.0016, even=True):
        CATALOG[self.id]["ease"] = round(self.ease, 4)
        CATALOG[self.id].update(getattr(self, "extra", {}))
        obj = gk.finish(self.base, self.id, self.parts, self.mats, self.hide, ease=self.ease, thickness=thickness, folder="pieces", prefix="Piece", even=even)
        if os.environ.get("PIECE_RENDER", "1") != "0":
            for i, m in enumerate(self.previews):
                obj.data.materials[i] = m
            gk.SCREENS_OVERRIDE = os.path.join(gk.ROOT, "art", "screens", "pieces")
            os.makedirs(gk.SCREENS_OVERRIDE, exist_ok=True)
            old = gk.SCREENS
            gk.SCREENS = gk.SCREENS_OVERRIDE
            try:
                ex = getattr(self, "extra", {})
                if "arch" in ex:
                    import shoes  # noqa: E402

                    def heeled():
                        shoes.pose_feet(self.base, ex["arch"])
                        self.base.rig.location.z += ex["lift"]
                        bpy.context.view_layer.update()

                    gk.render_sheet(self.base, self.id, obj, center=0.12 + ex["lift"] * 0.5, ortho=0.5, before=heeled, size=640)
                else:
                    gk.render_sheet(self.base, self.id, obj)
            finally:
                gk.SCREENS = old
        write_catalog()


def write_catalog():
    path = os.path.join(OUT_DIR, "catalog.json")
    old = {}
    if os.path.exists(path):
        with open(path) as f:
            old = json.load(f)
    old.update(CATALOG)
    with open(path, "w") as f:
        json.dump(old, f, indent=2)


# ----------------------------------------------------------------------------- detail maps (R channel)


def knit_D(P, shade=0.1):
    return 0.72 + shade * 0.5 * gk.noise3(P, 0.09, seed=3)


def satin_D(P):
    return 0.72 + 0.09 * gk.noise3(P, 0.12, seed=5) + 0.05 * gk.noise3(P, 0.03, seed=6)


def velvet_D(P, N):
    # velvet: soft mottling, a little lighter where the pile catches the light
    return 0.66 + 0.08 * gk.noise3(P, 0.05, seed=7) + 0.08 * smoothstep(0.2, 0.9, np.abs(N[..., 0]))


def binding(Fm, C, width=0.008):
    """A clean bound edge along every hem / neckline / armhole (the field is ~metres from the edge)."""
    return smoothstep(width * 1.2, width * 0.7, Fm) * (C > 0)


def front_mask(N):
    return smoothstep(-0.2, -0.55, N[..., 1])


# ----------------------------------------------------------------------------- prints as masks


def butterfly_masks(P, N, cx, cz, size):
    x, z = P[..., 0] - cx, P[..., 2] - cz
    fill, lines, ant = gk.butterfly(x, z, size=size)
    edge = np.clip(gk.blur(fill.astype(np.float64), 2) * (1 - fill) * 4 + ant, 0, 1)
    f = front_mask(N)
    return fill * f, np.clip(lines * fill + edge, 0, 1) * f


def text_masks(P, N, cx, cz, text, height, weight=0.2):
    x, z = P[..., 0] - cx, P[..., 2] - cz
    return gk.stroke_text(x, z, text, height=height, weight=weight) * front_mask(N)


def flower_masks(U, V, scale=0.1, seed=4):
    """Original scattered five-petal blooms: (petals, centres+leaves)."""
    petals = np.zeros(U.shape)
    other = np.zeros(U.shape)
    cell = scale
    gx, gy = np.floor(U / cell), np.floor(V / cell)
    for jx in (-1, 0, 1):
        for jy in (-1, 0, 1):
            cx_i, cy_i = gx + jx, gy + jy
            h = (np.sin(cx_i * 127.1 + cy_i * 311.7) * 43758.5453) % 1
            h2 = (np.sin(cx_i * 269.5 + cy_i * 183.3) * 43758.5453) % 1
            px, py = (cx_i + 0.2 + 0.6 * h) * cell, (cy_i + 0.2 + 0.6 * h2) * cell
            dx, dy = U - px, V - py
            r = np.sqrt(dx * dx + dy * dy)
            th = np.arctan2(dy, dx) + h * 6.28
            size = cell * (0.22 + 0.12 * h2)
            pet = r < size * (0.62 + 0.38 * np.abs(np.cos(th * 2.5)))
            petals = np.maximum(petals, pet)
            other = np.maximum(other, r < size * 0.22)
            a_ = h * 9
            lx, ly = dx - size * 1.25 * np.cos(a_), dy - size * 1.25 * np.sin(a_)
            lu, lv = lx * np.cos(a_) + ly * np.sin(a_), -lx * np.sin(a_) + ly * np.cos(a_)
            other = np.maximum(other, ((lu / (size * 0.55)) ** 2 + (lv / (size * 0.2)) ** 2 < 1) & ~pet)
    return petals * (1 - other), other


def adire_masks(U, V, tile=0.085):
    tx, ty = np.floor(U / tile), np.floor(V / tile)
    fx, fy = U / tile - tx, V / tile - ty
    kind = ((tx + ty) % 3).astype(int)
    dx, dy = fx - 0.5, fy - 0.5
    r = np.sqrt(dx * dx + dy * dy)
    rings = (np.sin(r * 2 * math.pi * 4) > 0.3) & (r < 0.45)
    ladder = ((np.abs(dx) < 0.32) & (np.sin(fy * 2 * math.pi * 6) > 0.4)) | (np.abs(np.abs(dx) - 0.36) < 0.03)
    dots = (((np.abs(dx) < 0.04) | (np.abs(dy) < 0.04)) & (np.sin((fx + fy) * 40) > 0)) | (r < 0.08)
    mark = np.choose(kind, [rings, ladder, dots]).astype(float)
    edge = ((fx < 0.03) | (fy < 0.03)).astype(float)
    return mark * (1 - edge), edge


def ankara_masks(U, V, tile=0.12):
    row = np.floor(V / tile)
    fx = U / tile + (row % 2) * 0.5
    lx, ly = fx - np.floor(fx) - 0.5, V / tile - row - 0.5
    r = np.sqrt(lx * lx + ly * ly)
    bulls = r < 0.42
    ring = np.floor(r / 0.085) % 2 == 0
    leaves = (np.sin(U * 160) * np.cos(V * 160)) > 0.75
    return (bulls & ring).astype(float), ((bulls & ~ring) | (~bulls & leaves) | (r < 0.08)).astype(float)


def tartan_masks(U, V, sett=0.07):
    def bands(t):
        f = (t / sett) % 1
        return (f < 0.32).astype(float), (np.abs(f - 0.66) < 0.025).astype(float)

    d1, l1 = bands(U)
    d2, l2 = bands(V)
    dark = np.clip(d1 * 0.5 + d2 * 0.5, 0, 1)
    line = np.maximum(l1, l2)
    return dark * (1 - line), line


def lace_alpha(P, scale=0.012, seed=2):
    """Floral lace: little rosettes on a fine net. 1 = thread, 0 = hole."""
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    ang = np.arctan2(x, -y) * 0.16
    u, v = ang / scale, z / scale
    net = (np.abs((u + v) % 1 - 0.5) > 0.38) | (np.abs((u - v) % 1 - 0.5) > 0.38)
    cu, cv = np.floor(u / 3) * 3 + 1.5, np.floor(v / 3) * 3 + 1.5
    rr = np.sqrt((u - cu) ** 2 + (v - cv) ** 2)
    rose = (rr < 1.1) & (np.sin(np.arctan2(v - cv, u - cu) * 5 + rr * 3) > -0.3) | (rr < 0.35)
    return (net | rose).astype(float)


def net_alpha(P, cell=0.008):
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    ang = np.arctan2(x, -y) * 0.16
    a = np.abs(((ang + z) / cell) % 1 - 0.5)
    b = np.abs(((ang - z) / cell) % 1 - 0.5)
    return ((a > 0.4) | (b > 0.4)).astype(float)


def embroidery_masks(P, N, scale=0.09):
    """Original gold embroidery for velvet: rosette medallions on a lattice with scrolling leaves."""
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    ang = np.arctan2(x, -y) * 0.16
    u, v = ang / scale, z / scale
    row = np.floor(v)
    uu = u + (row % 2) * 0.5
    lx, ly = uu - np.floor(uu) - 0.5, v - row - 0.5
    r = np.sqrt(lx * lx + ly * ly)
    th = np.arctan2(ly, lx)
    petals = (r < 0.32 * (0.7 + 0.3 * np.abs(np.cos(th * 4)))) & (r > 0.08)
    ringm = np.abs(r - 0.38) < 0.025
    scroll = (np.abs(np.sin(th * 2 + r * 14)) < 0.12) & (r > 0.42) & (r < 0.5)
    gold = (petals | ringm | scroll).astype(float)
    centre = (r < 0.07).astype(float)
    return gold, centre


# ----------------------------------------------------------------------------- tops


def crop_tank(base):
    """Bibi's crop tank: ribbed, a crop just above the navel, ONE small butterfly dead-centre on the chest."""
    p = Piece(base, "top_crop_tank", "Butterfly crop tank", "top", "thai", ["#C8102E", "#FFC72C", "#2A1200"])
    zc = base.z_chest
    hem = base.z_waist - 0.035
    F, ok = bo.top_field(base, hem, neck_front=0.035, neck_back=0.09, neck_w=0.062, strap=(0.045, 0.1))

    def fn(P, N, C, Fm):
        # ONE small butterfly, dead centre on the chest (about 3.5 cm across)
        w2, w3 = butterfly_masks(P, N, 0.0, zc - 0.02, 0.036)
        w3 = np.maximum(w3, binding(Fm, C) * 0.0)
        return knit_D(P, 0.12), w2, w3, None

    p.shell(F, ok, 0.0035, fn, lambda s: gk.knit(s, 2.4), inflate=30)
    p.save()


def tank(base):
    p = Piece(base, "top_tank", "Ribbed tank", "top", "thai", ["#F4F1EA", "#1C1C1C", "#C9A06A"])
    F, ok = bo.top_field(base, base.z_hip + 0.04, neck_front=0.04, neck_back=0.09, neck_w=0.062, strap=(0.045, 0.1))
    off = lambda i: 0.0035 + 0.004 * smoothstep(base.z_hip + 0.12, base.z_hip + 0.04, base.co[i, 2])
    p.shell(F, ok, off, lambda P, N, C, Fm: (knit_D(P), binding(Fm, C), zeros(P.shape), None), lambda s: gk.knit(s, 2.4), inflate=30)
    p.save()


def cami(base):
    p = Piece(base, "top_cami", "Satin cami", "top", "moncherie", ["#9CB89A", "#F4EFE6", "#C9A06A"])
    F, ok = bo.top_field(base, base.z_waist - 0.02, neck_front=-0.01, neck_back=-0.03, neck_w=0.2, curve_k=0.0, strap=(0.072, 0.088))

    def fn(P, N, C, Fm):
        # a lace trim along the neckline (secondary), scalloped
        top = (P[..., 2] > base.z_chest - 0.06) & (Fm < 0.016)
        scallop = 0.5 + 0.5 * np.sin(np.arctan2(P[..., 0], -P[..., 1]) * 90)
        return satin_D(P), top * (scallop > 0.2), zeros(P.shape), None

    p.shell(F, ok, 0.003, fn, lambda s: gk.satin(s), finish="satin", inflate=30, strength=1.2)
    p.save()


def corset(base):
    p = Piece(base, "top_corset", "Sweetheart corset", "top", "moncherie", ["#F2B8C6", "#E39AAD", "#FFFFFF"])
    zc = base.z_chest
    F, ok = bo.top_field(base, base.z_waist - 0.07, strapless=True, front_line=bo.sweetheart_front(zc), back_line=lambda x: zc - 0.035 + 0 * x)

    def fn(P, N, C, Fm):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        ang = np.arctan2(x, -y)
        ph = (ang / (math.pi / 6)) % 1
        seams = (np.abs(ph - 0.5) < 0.04).astype(float)
        lace = ((y > 0.02) & (np.abs(x) < 0.03) & (np.abs(((z * 60) % 1) - 0.5) < 0.12)).astype(float)
        trim = binding(Fm, C, 0.01) * (z > zc - 0.06)
        return satin_D(P), seams, np.maximum(lace, trim), None

    p.shell(F, ok, 0.004, fn, lambda s: gk.satin(s), finish="satin", inflate=35, strength=1.4)
    p.save()


def bandeau(base):
    p = Piece(base, "top_bandeau", "Bandeau", "top", "dopebyfabby", ["#0B6E4F", "#0E8A63", "#D9B35B"])
    zc = base.z_chest
    F, ok = bo.top_field(base, zc - 0.1, strapless=True, front_line=lambda x: zc - 0.005 + 0 * x, back_line=lambda x: zc - 0.04 + 0 * x)

    def fn(P, N, C, Fm):
        x, z = P[..., 0], P[..., 2]
        ring = (np.abs(np.sqrt((x / 0.014) ** 2 + ((z - (zc - 0.05)) / 0.02) ** 2) - 1) < 0.25) * front_mask(N)
        return satin_D(P), binding(Fm, C, 0.006), ring, None

    p.shell(F, ok, 0.003, fn, lambda s: gk.satin(s), finish="satin", inflate=30, strength=1.0)
    p.save()


def tee(base, pid, name, store, colors, hem, sleeve, neck=0.075, off=0.0035, inflate=25, graphic=None, holes=None, ringer=False):
    p = Piece(base, pid, name, "top", store, colors)
    zc = base.z_chest
    F, ok = bo.top_field(base, hem, neck_front=neck, neck_back=0.11, neck_w=0.07, sleeve_len=sleeve)

    def fn(P, N, C, Fm):
        w2, w3 = (graphic(P, N, zc) if graphic else (zeros(P.shape), zeros(P.shape)))
        if ringer:
            w3 = np.maximum(w3, binding(Fm, C, 0.012))
        a = holes(P, N) if holes else None
        return knit_D(P, 0.1), w2, w3, a

    p.shell(F, ok, off, fn, lambda s: gk.knit(s, 2.0), finish="net" if holes else "cotton", inflate=inflate, rate=0.65, strength=2.0)
    p.save()


def g_angel(P, N, zc):
    x, z = P[..., 0], P[..., 2] - (zc - 0.055)
    heart = ((x / 0.022) ** 2 + ((z - 0.008 - 0.6 * np.abs(x)) / 0.02) ** 2 < 1) * front_mask(N)
    wings = np.zeros(x.shape)
    for s in (1, -1):
        for k in range(3):
            wings = np.maximum(wings, (((x - s * (0.03 + k * 0.01)) / 0.012) ** 2 + ((z - 0.005 - k * 0.004) / 0.006) ** 2 < 1) * front_mask(N))
    word = text_masks(P, N, 0.0, zc - 0.095, "ANGEL", 0.016, 0.2)
    return np.maximum(heart, word), wings


def g_norules(P, N, zc):
    x, z = P[..., 0], P[..., 2] - (zc - 0.07)
    # the words sit under the bust, narrow enough to stay on the front of any body
    ink = np.clip(gk.stroke_text(x, z + 0.075, "NO RULES", height=0.027, weight=0.22) * front_mask(N), 0, 1)
    bolt = np.clip(bo.lightning(x, z - 0.03, 0.12) + bo.star(x - 0.07, z - 0.06, 0.018) + bo.star(x + 0.075, z - 0.01, 0.012), 0, 1) * front_mask(N)
    crack = gk.noise3(P, 0.003, 4) > -0.3
    return ink * crack, bolt * crack


def g_wild(P, N, zc):
    # high on the chest, between the collarbones and the bust (never over the bust itself)
    x, z = P[..., 0], P[..., 2] - (zc + 0.05)
    ink = gk.stroke_text(x, z, "WILD", height=0.032, weight=0.22) * front_mask(N)
    stars = np.clip(bo.star(x - 0.062, z, 0.011) + bo.star(x + 0.062, z, 0.011), 0, 1) * front_mask(N)
    return ink, stars


def g_flames(P, N, zc):
    """Original flames licking up from the hem (Y2K)."""
    x, z = P[..., 0], P[..., 2]
    ang = np.arctan2(x, -y_of(P))
    base_z = zc - 0.33
    h = 0.12 + 0.07 * np.sin(ang * 7) + 0.04 * np.sin(ang * 13 + 1)
    t = (z - base_z) / h
    flame = (t < 1) & (np.sin(ang * 22 + t * 3) * (1 - t) > -0.4 + t * 0.6)
    core = flame & (t < 0.55) & (np.sin(ang * 22 + t * 3) * (1 - t) > 0.1 + t * 0.4)
    return flame.astype(float) * (1 - core), core.astype(float)


def y_of(P):
    return P[..., 1]


def tee_holes(P, N):
    h = np.zeros(P.shape[:2])
    for (cx, cz, r) in ((0.06, 1.0, 0.012), (-0.09, 0.92, 0.009), (0.11, 1.15, 0.007)):
        dd = np.sqrt((P[..., 0] - cx) ** 2 + (P[..., 2] - cz) ** 2) + gk.noise3(P, 0.006, 2) * 0.004
        h = np.maximum(h, (dd < r) * front_mask(N))
    return 1 - h


def mesh_top(base):
    p = Piece(base, "top_mesh", "Mesh long sleeve", "top", "tolaptsd", ["#0A0A0A", "#0A0A0A", "#8A8A8A"])
    F, ok = bo.top_field(base, base.z_hip + 0.02, neck_front=0.07, neck_back=0.11, neck_w=0.068, sleeve_len=0.98)
    p.shell(F, ok, 0.003, lambda P, N, C, Fm: (knit_D(P, 0.05), zeros(P.shape), binding(Fm, C, 0.01), np.maximum(net_alpha(P), binding(Fm, C, 0.01))), lambda s: gk.knit(s, 1.6) * 0.3, finish="net", inflate=20, strength=1.0)
    p.save()


def sports_bra(base):
    p = Piece(base, "top_sports_bra", "Sports bra", "top", "novasport", ["#2D5BD0", "#FFFFFF", "#FF6A00"])
    zc = base.z_chest
    F, ok = bo.top_field(base, zc - 0.135, neck_front=0.01, neck_back=0.05, neck_w=0.09, curve_k=8.0, strap=(0.05, 0.1))

    def fn(P, N, C, Fm):
        band = smoothstep(zc - 0.105, zc - 0.11, P[..., 2]) * (C > 0)
        return knit_D(P, 0.06), band, binding(Fm, C, 0.005) * (1 - band), None

    p.shell(F, ok, 0.0025, fn, lambda s: gk.knit(s, 1.6), inflate=25)
    p.save()


def bralette(base):
    p = Piece(base, "top_lace_bralette", "Lace bralette", "top", "booty", ["#B0124A", "#F2B8C6", "#D9B35B"])
    zc = base.z_chest
    F, ok = bo.top_field(base, zc - 0.115, neck_front=-0.02, neck_back=0.0, neck_w=0.11, curve_k=-0.6, strap=(0.068, 0.082))

    def fn(P, N, C, Fm):
        edge = binding(Fm, C, 0.01)
        return satin_D(P), edge, zeros(P.shape), np.maximum(lace_alpha(P), edge)

    p.shell(F, ok, 0.0025, fn, lambda s: gk.satin(s), finish="lace", inflate=25, strength=1.0)
    p.save()


def buba(base):
    p = Piece(base, "top_buba", "Adire buba", "top", "dejideji", ["#1E2A5C", "#7E9BD6", "#D9A441"])
    F, ok = bo.top_field(base, base.z_waist - 0.09, neck_front=0.06, neck_back=0.11, neck_w=0.072, sleeve_len=0.72)
    arm = base.arm_d < 0.1

    def off(idx):
        bell = np.where(arm[idx], 0.065 * smoothstep(0.2, 0.72, base.arm_t[idx]) ** 1.3, 0.0)
        return 0.011 + bell

    def fn(P, N, C, Fm):
        w2, w3 = adire_masks(*bo.around(P))
        return 0.72 + 0.04 * gk.noise3(P, 0.03, 9), w2, np.maximum(w3, binding(Fm, C, 0.012)), None

    p.shell(F, ok, off, fn, lambda s: gk.twill(s, 3.0) * 0.5, inflate=45, rate=0.6, strength=1.2)
    p.save()


def peplum(base):
    p = Piece(base, "top_peplum", "Ankara peplum top", "top", "dejideji", ["#F2A33A", "#1B7F79", "#E4572E"])
    F, ok = bo.top_field(base, base.z_waist - 0.01, neck_front=0.03, neck_back=0.08, neck_w=0.085, curve_k=4.0, strap=(0.05, 0.12))
    bod = p.shell(F, ok, 0.006, lambda P, N, C, Fm: (0.72 + 0.03 * gk.noise3(P, 0.03, 4), *ankara_masks(*bo.around(P), tile=0.07), None), lambda s: gk.twill(s, 2.4) * 0.4, inflate=30, strength=1.0)
    zt = base.z_waist + 0.0
    rings = [(zt - i * 0.035, 0.03 + i * 0.002, 0.05 * (i / 4) ** 1.4) for i in range(5)]
    p.tube(rings, lambda U, V, a: (0.72 + 0 * U, *ankara_masks(U + 0.03, V, tile=0.07), None), lambda s: gk.twill(s, 2.4) * 0.4, follow=0.2, radial=lambda a, k: 0.014 * k * np.sin(a * 8), under=[bod])
    p.save()


# ----------------------------------------------------------------------------- bottoms


def denim_masks(base, fade=0.35):
    """Jeans as masks: R = wash (fading on the thighs and knees, whiskers, seams), G = topstitching
    thread, B = buttons/rivets."""
    def fn(P, N, C, Fm):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        g = gk.noise3(P, 0.05, seed=5)
        front = smoothstep(-0.1, -0.6, N[..., 1])
        thigh = front * smoothstep(base.z_knee - 0.05, base.z_knee + 0.12, z) * smoothstep(base.z_hip - 0.02, base.z_hip - 0.12, z)
        knee = front * np.exp(-((z - base.z_knee - 0.01) / 0.05) ** 2)
        whisk = front * np.exp(-((z - (base.z_hip - 0.035)) / 0.02) ** 2) * (0.5 + 0.5 * np.sin(np.abs(x) * 260))
        D = 0.62 + 0.25 * np.clip(fade * (thigh * 0.8 + knee * 0.6 + whisk * 0.5) / 0.35, 0, 1) + 0.05 * g
        outer = smoothstep(0.75, 0.95, np.abs(N[..., 0])) * (np.sign(N[..., 0]) == np.sign(x))
        D = D - 0.18 * smoothstep(0.985, 0.995, np.abs(N[..., 0])) * outer
        zt = float(z[C > 0].max())
        D = D - 0.12 * smoothstep(zt - 0.037, zt - 0.033, z)
        thread = np.zeros(x.shape)
        thread += ((np.abs(z - (zt - 0.036)) < 0.0012) | (np.abs(z - (zt - 0.004)) < 0.0012)) * (np.sin((x + y) * 900) > 0)
        thread += (np.abs(x - 0.012) < 0.0012) * (z < zt - 0.04) * (z > zt - 0.16) * (y < 0) * (np.sin(z * 900) > 0)
        for s in (1, -1):
            r = np.sqrt((x - s * 0.135) ** 2 + (z - zt) ** 2)
            thread += (np.abs(r - 0.075) < 0.0014) * (y < 0) * (x * s > 0.06) * (z < zt - 0.035)
            bx, bz = x - s * 0.085, z - (zt - 0.11)
            inside = (np.abs(bx) < 0.06 - np.maximum(0, -(bz + 0.03)) * 0.6) & (bz > -0.08) & (bz < 0.03) & (y > 0.02)
            edge = inside & ~((np.abs(bx) < 0.054 - np.maximum(0, -(bz + 0.03)) * 0.6) & (bz > -0.074) & (bz < 0.024))
            thread += edge
        btn = (np.sqrt(x ** 2 + (z - (zt - 0.02)) ** 2) < 0.007) & (y < 0)
        D = D + 0.0 * btn
        hem = binding(Fm, C, 0.012) * (z < base.z_knee)
        D = D - 0.06 * hem
        thread = np.maximum(np.clip(thread, 0, 1), ((np.abs(Fm - 0.008) < 0.0012) & (z < base.z_knee)) * (np.sin((x + z) * 900) > 0))
        return D, thread, btn.astype(float)

    return fn


def jeans_piece(base, pid, name, store, colors, fit="slim", rips=None, flare=0.0, top_off=0.06, hem_z=None):
    p = Piece(base, pid, name, "bottom", store, colors)
    F, ok = bo.legs_field(base, base.z_waist - top_off, hem_z if hem_z is not None else base.z_ankle + 0.03)
    k, h = base.z_knee, base.z_hip
    co, nrm = base.co, base.normal

    def off(idx):
        z = co[idx, 2]
        o = 0.0045 + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, z)
        if fit == "baggy":
            # baggy is a loose STRAIGHT leg, not a thick thigh: close over the hips and thighs (a
            # touch of ease), the room added from mid-thigh down so the leg hangs straight to the
            # hem; inner sides stay modest so the legs never meet
            outward = np.clip(nrm[idx, 0] * np.sign(co[idx, 0]) * 0.5 + 0.5, 0, 1)
            grow = smoothstep(h + 0.02, h - 0.1, z) * 0.006 + smoothstep(h - 0.12, k + 0.04, z) * 0.026 + smoothstep(k, base.z_ankle, z) * 0.016
            o = o + grow * (0.35 + 0.65 * outward)
        if flare:
            o = o + flare * smoothstep(k + 0.02, base.z_ankle + 0.03, z) ** 1.6
        return o

    dm = denim_masks(base)

    def fn(P, N, C, Fm):
        D, W2, W3 = dm(P, N, C, Fm)
        A = None
        if rips:
            hole, fray = bo.rip_field(P, N, rips)
            W2 = np.maximum(W2 * (1 - fray), np.clip((np.sin(P[..., 2] * 2600) > 0.2) * fray, 0, 1))
            A = 1.0 - hole
        return D, W2, W3, A

    part = p.shell(F, ok, off, fn, lambda s: gk.twill(s, 2.2), finish="denim", inflate=24 if fit == "baggy" else 10, rate=0.5, strength=2.6, hide_margin=0.06)
    return p, part


def baggy_jeans(base):
    p, _ = jeans_piece(base, "bottom_baggy_jeans", "Baggy jeans", "thai", ["#7FA3C9", "#D8A04A", "#B8B8B8"], fit="baggy", top_off=0.085, hem_z=base.z_ankle - 0.025)
    p.save()


def skinny_jeans(base):
    p, _ = jeans_piece(base, "bottom_skinny_jeans", "Skinny jeans", "okrika", ["#2B3A55", "#C99A55", "#9A9A9A"])
    p.save()


def ripped_jeans(base):
    p, _ = jeans_piece(base, "bottom_ripped_jeans", "Ripped skinny jeans", "tolaptsd", ["#1E1E22", "#D8D8D8", "#9A9A9A"], rips=[(1, base.z_knee + 0.02, 0.045, 0.03), (-1, base.z_knee - 0.01, 0.05, 0.035), (1, base.z_hip - 0.12, 0.03, 0.022)])
    p.save()


def cargo(base):
    p = Piece(base, "bottom_cargo", "Cargo pants", "bottom", "okrika", ["#5A5A3C", "#4A4A30", "#C9A06A"])
    F, ok = bo.legs_field(base, base.z_waist - 0.07, base.z_ankle - 0.02)
    h, k = base.z_hip, base.z_knee
    co, nrm = base.co, base.normal

    def off(idx):
        z = co[idx, 2]
        outward = np.clip(nrm[idx, 0] * np.sign(co[idx, 0]) * 0.5 + 0.5, 0, 1)
        # a straight, roomy leg (no thigh curve): close over the hips, the room from mid-thigh down
        grow = smoothstep(h + 0.02, h - 0.1, z) * 0.006 + smoothstep(h - 0.12, k + 0.04, z) * 0.028 + smoothstep(k, base.z_ankle, z) * 0.012
        return 0.006 + grow * (0.35 + 0.65 * outward) + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, z)

    def fn(P, N, C, Fm):
        x, z = P[..., 0], P[..., 2]
        side = smoothstep(0.6, 0.85, np.abs(N[..., 0])) * (np.sign(N[..., 0]) == np.sign(x))
        pocket = side * (z < k + 0.2) * (z > k + 0.02)
        flap = side * (z < k + 0.2) * (z > k + 0.165)
        edge = pocket * ((np.abs(z - (k + 0.02)) < 0.003) | (np.abs(z - (k + 0.2)) < 0.003))
        stitch = (binding(Fm, C, 0.01) + edge) > 0
        return 0.72 + 0.05 * gk.noise3(P, 0.04, 6) - 0.08 * pocket + 0.05 * flap, flap, stitch.astype(float), None

    p.shell(F, ok, off, fn, lambda s: gk.twill(s, 2.8), finish="cotton", inflate=24, rate=0.5, strength=2.2, hide_margin=0.06)
    p.save()


def flare_pants(base):
    p = Piece(base, "bottom_flare_pants", "High-waist flares", "bottom", "dopebyfabby", ["#0B6E4F", "#0E8A63", "#0B6E4F"])
    CATALOG[p.id]["slot"] = "bottom"
    F, ok = bo.legs_field(base, base.z_waist + 0.0, base.z_ankle - 0.01)
    k = base.z_knee
    off = lambda idx: 0.005 + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, base.co[idx, 2]) + 0.042 * smoothstep(k + 0.04, base.z_ankle, base.co[idx, 2]) ** 1.5

    def fn(P, N, C, Fm):
        x, y = P[..., 0], P[..., 1]
        crease = (np.abs(x - np.sign(x) * 0.095) < 0.0015) & (y < -0.04) & (P[..., 2] < base.z_hip - 0.05)
        return satin_D(P), crease.astype(float), zeros(P.shape), None

    p.shell(F, ok, off, fn, lambda s: gk.knit(s, 1.6) * 0.3, finish="satin", inflate=10, rate=0.5, strength=1.0, hide_margin=0.06)
    p.save()


def leggings(base):
    p = Piece(base, "bottom_leggings", "Leggings", "bottom", "novasport", ["#141414", "#FFFFFF", "#2D5BD0"])
    F, ok = bo.legs_field(base, base.z_waist + 0.0, base.z_ankle + 0.02)

    def fn(P, N, C, Fm):
        side = smoothstep(0.9, 0.97, np.abs(N[..., 0])) * (np.sign(N[..., 0]) == np.sign(P[..., 0]))
        return knit_D(P, 0.05), side, binding(Fm, C, 0.012) * (P[..., 2] > base.z_hip), None

    p.shell(F, ok, 0.0022, fn, lambda s: gk.knit(s, 1.4), inflate=6, strength=1.2)
    p.save()


def lace_briefs(base):
    p = Piece(base, "bottom_lace_briefs", "Lace briefs", "bottom", "booty", ["#B0124A", "#F2B8C6", "#D9B35B"])
    F, ok = bo.legs_field(base, base.z_hip + 0.06, base.z_crotch - 0.045)

    def fn(P, N, C, Fm):
        edge = binding(Fm, C, 0.01)
        return satin_D(P), edge, zeros(P.shape), np.maximum(lace_alpha(P), edge)

    p.shell(F, ok, 0.0025, fn, lambda s: gk.satin(s), finish="lace", inflate=10, strength=1.0)
    p.save()


def skirt(base, pid, name, store, colors, rings, fn, height, finish="cotton", radial=None, slit=None, follow=0.6):
    p = Piece(base, pid, name, "bottom", store, colors)
    p.tube(rings, fn, height, finish=finish, radial=radial, slit=slit, follow=follow)
    p.save()


def wb(fn, depth=0.03):
    """Add a waistband (accent) to a tube colour function."""
    def g(U, V, a):
        D, W2, W3, A = fn(U, V, a)
        band = smoothstep(depth + 0.002, depth - 0.002, V)
        return D - 0.04 * band, W2 * (1 - band), np.maximum(W3, band), A

    return g


def mini_rings(base, flare=0.034):
    zt = base.z_waist - 0.04
    return [(zt, 0.008, 0.0), (zt - 0.05, 0.009, 0.0), (base.z_hip + 0.06, 0.011, 0.004), (base.z_hip - 0.01, 0.013, flare * 0.4), (base.z_hip - 0.07, 0.013, flare * 0.75), (base.z_hip - 0.12, 0.013, flare)]


def skirts(base, which):
    k = lambda U: 0.72 + 0.04 * gk.value_noise(U.shape, 60, 2)
    z0 = np.zeros
    if which == "bottom_mini_skirt":
        skirt(base, which, "A-line mini skirt", "thai", ["#EEEBE3", "#D8D2C4", "#B8B8B8"], mini_rings(base), wb(lambda U, V, a: (k(U) + 0.04 * gk.twill(U.shape, 2.0), z0(U.shape), z0(U.shape), None)), lambda s: gk.twill(s, 2.0), finish="denim")
    elif which == "bottom_pleated_mini":
        pleats = lambda a, kk: 0.009 * (0.3 + 0.7 * kk) * np.abs(((a / (2 * math.pi) * 28) % 1) - 0.5) * 2
        skirt(base, which, "Tartan pleated mini", "tolaptsd", ["#A61E22", "#141414", "#F2C14E"], mini_rings(base, 0.04), wb(lambda U, V, a: (k(U), *tartan_masks(U, V), None)), lambda s: gk.twill(s, 2.0) * 0.5, radial=pleats)
    elif which == "bottom_satin_mini":
        skirt(base, which, "Satin mini skirt", "moncherie", ["#EBA9BA", "#F7D6E0", "#FFFFFF"], mini_rings(base, 0.04), wb(lambda U, V, a: (0.72 + 0.08 * np.sin(a * 14) ** 2, z0(U.shape), z0(U.shape), None), 0.02), lambda s: gk.satin(s), finish="satin", radial=lambda a, kk: 0.006 * kk * np.sin(a * 14))
    elif which == "bottom_midi_skirt":
        zt = base.z_waist + 0.01
        rings = [(zt - i * 0.06, 0.006 + min(i, 3) * 0.002, 0.11 * (i / 12) ** 1.5) for i in range(13)]
        skirt(base, which, "Floral midi skirt", "thai", ["#F6EFE3", "#E8735A", "#4FA65E"], rings, wb(lambda U, V, a: (k(U), *flower_masks(U, V, 0.1), None), 0.035), lambda s: gk.satin(s) * 0.6, radial=lambda a, kk: 0.012 * kk * kk * np.sin(a * 9), follow=0.45)
    elif which == "bottom_pencil_skirt":
        zt = base.z_waist + 0.0
        rings = [(zt - i * 0.04, 0.01, 0.0) for i in range(16)]
        skirt(base, which, "Ankara pencil skirt", "dejideji", ["#F2A33A", "#1B7F79", "#E4572E"], rings, wb(lambda U, V, a: (0.72 + 0 * U, *ankara_masks(U, V), None)), lambda s: gk.twill(s, 2.4) * 0.4, follow=0.75)
    elif which == "bottom_iro":
        zt = base.z_waist - 0.02
        rings = [(zt - i * 0.05, 0.016 + min(i, 2) * 0.002, 0.012 * (i / 18)) for i in range(19)]

        def iro(U, V, a):
            w2, w3 = adire_masks(U, V)
            hem = np.abs(V - (rings[0][0] - rings[-1][0]) + 0.03) < 0.012
            fold = np.abs(a - 0.55) < 0.012
            return 0.72 - 0.25 * fold, w2 * (1 - hem), np.maximum(w3, hem), None

        skirt(base, which, "Adire iro (wrapper)", "dejideji", ["#1E2A5C", "#7E9BD6", "#D9A441"], rings, iro, lambda s: gk.twill(s, 3.0) * 0.5, follow=0.35)


# ----------------------------------------------------------------------------- dresses


def slip_dress(base):
    p = Piece(base, "dress_slip", "Satin slip dress", "dress", "moncherie", ["#C9A7D8", "#E6D3EF", "#FFFFFF"])
    F, ok = bo.top_field(base, base.z_waist - 0.03, neck_front=-0.035, neck_back=0.0, neck_w=0.11, curve_k=-0.55, strap=(0.068, 0.082))
    bod = p.shell(F, ok, 0.003, lambda P, N, C, Fm: (satin_D(P), binding(Fm, C, 0.006) * (P[..., 2] > base.z_chest - 0.1), zeros(P.shape), None), lambda s: gk.satin(s), finish="satin", inflate=35, strength=1.0)
    zt = base.z_waist
    rings = [(zt - i * 0.044, 0.008 + min(i, 4) * 0.002, 0.06 * (i / 16) ** 1.6) for i in range(17)]
    p.tube(rings, lambda U, V, a: (0.72 + 0.05 * np.sin(a * 3 + V * 1.5) + 0.03 * gk.value_noise(U.shape, 60, 2), np.zeros(U.shape), np.zeros(U.shape), None), lambda s: gk.satin(s), finish="satin", follow=0.5, radial=lambda a, k: 0.008 * k * np.sin(a * 7), slit=(60, 9, base.z_knee + 0.12), under=[bod])
    p.save()


def sequin_mini(base):
    """Ifeoma's gold dress: sequins throughout, a plunging V, a fitted mini."""
    p = Piece(base, "dress_sequin_mini", "Gold sequin mini", "dress", "dopebyfabby", ["#D9B35B", "#F2D98A", "#FFFFFF"])

    def seq(shape):
        hgt, sp = gk.sequins(shape, 7.0)
        return 0.6 + 0.25 * hgt + 0.15 * sp, (sp > 0.85).astype(float) * hgt

    F, ok = bo.top_field(base, base.z_hip + 0.04, neck_front=-0.03, neck_back=0.03, neck_w=0.1, curve_k=-0.5, strap=(0.05, 0.085))
    top = p.shell(F, ok, 0.003, lambda P, N, C, Fm: (*seq(P.shape[:2]), zeros(P.shape), None), lambda s: gk.sequins(s, 7.0)[0], finish="sequin", inflate=25, strength=3.0)
    rings = [(base.z_hip + 0.07, 0.006, 0.0), (base.z_hip + 0.02, 0.006, 0.0), (base.z_hip - 0.02, 0.006, 0.0), (base.z_hip - 0.06, 0.006, 0.0), (base.z_hip - 0.1, 0.006, 0.0), (base.z_hip - 0.14, 0.006, 0.002), (base.z_hip - 0.17, 0.006, 0.004)]
    p.tube(rings, lambda U, V, a: (*seq(U.shape), np.zeros(U.shape), None), lambda s: gk.sequins(s, 7.0)[0], finish="sequin", follow=0.7, under=[top], strength=3.0)
    p.save()


def velvet_mini(base):
    """Amaka (refs 3 and 4): an off-shoulder black velvet mini with gold embroidery, puffed bands
    over the upper arms, a fitted bodice and a short skirt with a draped tail at the side."""
    p = Piece(base, "dress_velvet_mini", "Velvet & gold mini", "dress", "dejideji", ["#0B0B0E", "#C9A04A", "#E4572E"])
    zc = base.z_chest
    co = base.co
    x, z = co[:, 0], co[:, 2]
    # off the shoulders but well above the bust: straight across the upper chest and back
    top_edge = zc + 0.075 - 2.5 * x * x
    F_torso = np.minimum(z - (base.z_hip + 0.03), top_edge - z)
    F_torso = np.where(base.is_arm, -1.0, F_torso)
    # off-shoulder puffs: a band around each upper arm just below the shoulder
    F_arm = np.where(base.arm_d < 0.1, np.minimum(base.arm_t - 0.06, 0.28 - base.arm_t) * 0.6, -1.0)
    F = np.maximum(F_torso, F_arm)
    ok = (base.w_head < 0.3) & (base.w_hand < 0.05)
    arm = base.arm_d < 0.1
    off = lambda idx: 0.004 + np.where(arm[idx], 0.02 * np.sin(np.clip((base.arm_t[idx] - 0.06) / 0.22, 0, 1) * math.pi), 0.0)

    def fn(P, N, C, Fm):
        gold, centre = embroidery_masks(P, N)
        trim = binding(Fm, C, 0.009)
        return velvet_D(P, N), gold * (1 - trim), np.maximum(centre, trim * 0), None

    bod = p.shell(F, ok, off, fn, lambda s: gk.satin(s) * 0.4, finish="velvet", inflate=30, strength=0.8)
    rings = [(base.z_hip + 0.06, 0.01, 0.0), (base.z_hip + 0.01, 0.012, 0.0), (base.z_hip - 0.05, 0.013, 0.008), (base.z_hip - 0.11, 0.013, 0.016), (base.z_hip - 0.16, 0.013, 0.022)]

    def skirt_fn(U, V, a):
        u = U / 0.09
        v = V / 0.09
        row = np.floor(v)
        uu = u + (row % 2) * 0.5
        lx, ly = uu - np.floor(uu) - 0.5, v - row - 0.5
        r = np.sqrt(lx * lx + ly * ly)
        th = np.arctan2(ly, lx)
        gold = ((r < 0.32 * (0.7 + 0.3 * np.abs(np.cos(th * 4)))) & (r > 0.08)) | (np.abs(r - 0.38) < 0.025)
        tail = smoothstep(0.06, 0.0, np.abs(((a - 1.7 + math.pi) % (2 * math.pi)) - math.pi))
        return 0.64 + 0.06 * gk.value_noise(U.shape, 40, 3) + 0.08 * tail, gold.astype(float), (r < 0.07).astype(float), None

    p.tube(rings, skirt_fn, lambda s: gk.satin(s) * 0.4, finish="velvet", follow=0.6, radial=lambda a, k: 0.03 * k * smoothstep(0.5, 0.0, abs(((a - 1.7 + math.pi) % (2 * math.pi)) - math.pi)), under=[bod])
    p.save()


def lace_bodysuit(base):
    p = Piece(base, "dress_lace_bodysuit", "Lace bodysuit", "dress", "booty", ["#111111", "#B0124A", "#D9B35B"])
    F, ok = bo.top_field(base, base.z_crotch - 0.04, neck_front=-0.02, neck_back=0.0, neck_w=0.11, curve_k=-0.6, strap=(0.068, 0.082))

    def fn(P, N, C, Fm):
        edge = binding(Fm, C, 0.01)
        return satin_D(P), edge, zeros(P.shape), np.maximum(lace_alpha(P), edge)

    p.shell(F, ok, 0.0025, fn, lambda s: gk.satin(s), finish="lace", inflate=25, strength=1.0)
    p.save()


# ----------------------------------------------------------------------------- October 14 additions


def stripes3(N, w=0.03, gap=0.075):
    """Three parallel stripes down the outer side of a leg or arm (on the side-facing surface)."""
    outer = smoothstep(0.7, 0.85, np.abs(N[..., 0]))
    ny = N[..., 1]
    band = np.zeros(ny.shape)
    for c in (-gap, 0.0, gap):
        band = np.maximum(band, (np.abs(ny - c) < w).astype(float))
    return band * outer


def trousers(base, pid, name, store, colors, width=1.0, finish="cotton", stripes=False, crease=False, top_off=0.06, hem_z=None, band=0.035):
    """Long trousers of any width (wide, track, tailored): the legs of a jeans shell without denim."""
    p = Piece(base, pid, name, "bottom", store, colors)
    F, ok = bo.legs_field(base, base.z_waist - top_off, hem_z if hem_z is not None else base.z_ankle - 0.02)
    k, h = base.z_knee, base.z_hip
    co, nrm = base.co, base.normal

    def off(idx):
        z = co[idx, 2]
        o = 0.0045 + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, z)
        outward = np.clip(nrm[idx, 0] * np.sign(co[idx, 0]) * 0.5 + 0.5, 0, 1)
        if width > 1.2:
            # wide-leg: fitted over the hips (no balloon), the leg falling wide and straight from
            # mid-thigh to a wide hem
            grow = smoothstep(h + 0.02, h - 0.12, z) * 0.012 + smoothstep(h - 0.1, k + 0.05, z) * 0.03 * width + smoothstep(k, base.z_ankle, z) * 0.012
            return o + grow * (0.45 + 0.55 * outward)
        grow = smoothstep(h + 0.02, h - 0.2, z) * 0.03 + smoothstep(k, base.z_ankle, z) * 0.026
        return o + width * grow * (0.35 + 0.65 * outward)

    def fn(P, N, C, Fm):
        z = P[..., 2]
        zt = float(z[C > 0].max())
        D = 0.72 + 0.03 * gk.noise3(P, 0.03, 4)
        top = smoothstep(zt - band - 0.002, zt - band + 0.002, z)
        D = D - 0.05 * top
        if crease:
            front = smoothstep(-0.9, -0.99, N[..., 1])
            D = D - 0.07 * front * (z < h - 0.05)
        W2 = stripes3(N) * (z < zt - band) if stripes else zeros(P.shape)
        W3 = top
        return D, W2, W3, None

    p.shell(F, ok, off, fn, lambda s: gk.twill(s, 2.4) * (0.6 if finish != "satin" else 0.3), finish=finish, inflate=26 if width > 0.6 else 14, rate=0.5, strength=1.6, hide_margin=0.06)
    p.save()


def maxi_dress(base):
    """A long, fully covered empire-line maxi (Grace, pregnant): a modest lined bodice with full,
    wide straps ending just under the bust (thick enough that nothing shows through), and the skirt
    falling from there, over the bump, to the ankles: one continuous line, no step at the waist."""
    p = Piece(base, "dress_maxi", "Lilac maxi dress", "dress", "moncherie", ["#B9A2D8", "#E8DDF4", "#FFFFFF"])
    under_bust = base.z_chest - 0.085
    F, ok = bo.top_field(base, under_bust - 0.02, neck_front=0.0, neck_back=0.05, neck_w=0.075, curve_k=6.0, strap=(0.05, 0.1))
    bod = p.shell(F, ok, 0.0065, lambda P, N, C, Fm: (satin_D(P), binding(Fm, C, 0.006) * (P[..., 2] > base.z_chest - 0.12), zeros(P.shape), None), lambda s: gk.satin(s), finish="satin", inflate=60, strength=1.0)
    z0 = under_bust
    z1 = base.z_ankle + 0.035
    n = 24
    # clear of the belly from the start (the bump grows into it), then a soft A-line to the hem
    rings = [(z0 - (z0 - z1) * i / n, 0.02 + 0.03 * np.sin(min(1.0, i / (n * 0.35)) * np.pi / 2), 0.07 * (i / n) ** 1.3) for i in range(n + 1)]
    p.tube(rings, lambda U, V, a: (0.72 + 0.05 * np.sin(a * 5 + V * 2.0) + 0.03 * gk.value_noise(U.shape, 60, 2), np.zeros(U.shape), np.zeros(U.shape), None), lambda s: gk.satin(s), finish="satin", follow=0.5, radial=lambda a, kk: 0.01 * kk * np.sin(a * 8), under=[bod])
    p.save()


def baddie_top(base):
    """A tight square-neck crop top (Mei's two-piece)."""
    p = Piece(base, "top_square_crop", "Square-neck crop top", "top", "booty", ["#0B0B0E", "#1A1A1E", "#D9B35B"])
    F, ok = bo.top_field(base, base.z_waist + 0.015, neck_front=-0.005, neck_back=0.06, neck_w=0.07, curve_k=0.0, strap=(0.04, 0.095))
    p.shell(F, ok, 0.0025, lambda P, N, C, Fm: (knit_D(P, 0.06), zeros(P.shape), binding(Fm, C, 0.005), None), lambda s: gk.knit(s, 1.6), inflate=30, strength=1.2)
    p.save()


def micro_skirt(base):
    """A very short, fitted mini (Mei)."""
    zt = base.z_waist - 0.03
    rings = [(zt, 0.006, 0.0), (zt - 0.05, 0.007, 0.0), (base.z_hip + 0.04, 0.008, 0.002), (base.z_hip - 0.01, 0.009, 0.006), (base.z_hip - 0.055, 0.009, 0.01)]
    skirt(base, "bottom_micro_skirt", "Micro mini skirt", "booty", ["#0B0B0E", "#1A1A1E", "#D9B35B"], rings, wb(lambda U, V, a: (0.72 + 0.03 * gk.value_noise(U.shape, 60, 2), zeros(U.shape), zeros(U.shape), None), 0.018), lambda s: gk.satin(s) * 0.5, finish="leather", follow=0.75)


def g_stains(P, N, zc):
    """A worn, slightly dirty tee: soft grubby patches on the front and hem (secondary colour)."""
    patch = smoothstep(0.55, 0.85, gk.noise3(P, 0.06, 7) * 0.5 + 0.5) * smoothstep(0.6, 0.9, gk.noise3(P, 0.02, 8) * 0.5 + 0.5)
    hem = smoothstep(zc - 0.22, zc - 0.32, P[..., 2]) * smoothstep(0.4, 0.8, gk.noise3(P, 0.03, 9) * 0.5 + 0.5)
    return np.clip(patch * 0.7 + hem * 0.5, 0, 0.8), zeros(P.shape)


def overalls(base):
    """Denim bib overalls (Chloe): straight legs, a front bib to the chest, straps over the shoulders
    crossing the back, brass buttons. Worn over a top (the bib sits outside it)."""
    p = Piece(base, "bottom_overalls", "Denim overalls", "bottom", "okrika", ["#5B7FA8", "#D8A04A", "#C9A04A"])
    co = base.co
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    zc = base.z_chest
    legs, ok = bo.legs_field(base, base.z_waist + 0.01, base.z_ankle + 0.0)
    front = y < -0.01
    bib = np.where(front & ~base.is_arm, np.minimum.reduce([0.095 - ax, (zc - 0.035) - z, z - (base.z_waist - 0.06)]), -1.0)
    # straps: up from the bib corners over the shoulders, then crossing down the back to the waist
    sx_front = 0.08
    t_back = np.clip((z - base.z_waist) / max(zc + 0.1 - base.z_waist, 1e-3), 0, 1)
    sx_back = 0.02 + 0.07 * t_back
    strap_c = np.where(front, sx_front, sx_back)
    band = np.minimum(0.016 - np.abs(ax - strap_c), (base.z_neck - 0.005) - z)
    strap = np.where(z > np.where(front, zc - 0.05, base.z_waist - 0.02), band, -1.0)
    strap = np.where(base.is_arm | (base.w_head > 0.3), -1.0, strap)
    F = np.maximum.reduce([legs, bib, strap])
    ok2 = (base.w_head < 0.3) & (base.w_hand < 0.05) & (base.w_foot < 0.35) & ~base.is_arm
    k, h = base.z_knee, base.z_hip
    nrm = base.normal

    def off(idx):
        zz = co[idx, 2]
        o = 0.006 + 0.004 * smoothstep(base.z_crotch + 0.02, base.z_crotch - 0.03, zz)
        upper = zz > base.z_waist - 0.06
        o = np.where(upper, 0.012, o)  # bib and straps sit over the top worn under them
        outward = np.clip(nrm[idx, 0] * np.sign(co[idx, 0]) * 0.5 + 0.5, 0, 1)
        grow = smoothstep(h + 0.02, h - 0.2, zz) * 0.016 + smoothstep(k, base.z_ankle, zz) * 0.012
        return o + grow * (0.35 + 0.65 * outward)

    dm = denim_masks(base, fade=0.25)

    def fn(P, N, C, Fm):
        D, W2, W3 = dm(P, N, C, Fm)
        px, pz = np.abs(P[..., 0]), P[..., 2]
        btn = (np.sqrt((px - 0.08) ** 2 + (pz - (zc - 0.045)) ** 2) < 0.009) * (P[..., 1] < 0)
        btn = np.maximum(btn, (np.sqrt((px - 0.1) ** 2 + (pz - (base.z_waist - 0.035)) ** 2) < 0.008) * 1.0)
        pocket = (px < 0.055) & (pz < zc - 0.06) & (pz > zc - 0.16) & (P[..., 1] < 0)
        edge = pocket & ~((px < 0.05) & (pz < zc - 0.065) & (pz > zc - 0.155))
        return D, np.maximum(W2, edge.astype(float)), np.maximum(W3, btn), None

    p.shell(F, ok & ok2 | (ok2 & (z > base.z_waist)), off, fn, lambda s: gk.twill(s, 2.2), finish="denim", inflate=24, rate=0.5, strength=2.4, hide_margin=0.06)
    p.save()


def track_jacket(base):
    """A zip-up track jacket with three stripes down the sleeves (Femi)."""
    p = Piece(base, "top_track_jacket", "Track jacket", "top", "novasport", ["#141E3C", "#FFFFFF", "#E8E8E8"])
    F, ok = bo.top_field(base, base.z_hip + 0.02, neck_front=0.085, neck_back=0.12, neck_w=0.062, sleeve_len=0.97)

    def fn(P, N, C, Fm):
        x = P[..., 0]
        zip_ = (np.abs(x) < 0.0035) * (P[..., 1] < 0)
        sleeve = smoothstep(0.17, 0.2, np.abs(x))
        W2 = stripes3(N, 0.028, 0.07) * sleeve
        cuff = binding(Fm, C, 0.02)
        return 0.72 + 0.03 * gk.noise3(P, 0.02, 5) - 0.05 * cuff, W2 * (1 - cuff), np.maximum(zip_, cuff).astype(float), None

    p.shell(F, ok, 0.007, fn, lambda s: gk.knit(s, 1.2) * 0.5, finish="satin", inflate=32, rate=0.6, strength=1.0)
    p.save()


def suit_jacket(base):
    """A tailored single-breasted jacket (Chidi): long sleeves to the wrist, covering the hips; the
    shirt and tie show in the V between the lapels (secondary = shirt, accent = tie and buttons)."""
    p = Piece(base, "top_suit_jacket", "Tailored jacket", "top", "dopebyfabby", ["#1E2740", "#F4F4F2", "#5A6E9A"])
    zc = base.z_chest
    F, ok = bo.top_field(base, base.z_hip - 0.06, neck_front=0.09, neck_back=0.13, neck_w=0.058, sleeve_len=0.96)

    def fn(P, N, C, Fm):
        x, z = P[..., 0], P[..., 2]
        ax = np.abs(x)
        fr = P[..., 1] < 0
        vtop = zc + 0.11
        vbot = zc - 0.12
        halfw = 0.075 * np.clip((z - vbot) / (vtop - vbot), 0, 1)
        shirt = (ax < halfw) & (z > vbot) & fr
        tie = (ax < 0.012 + 0.006 * np.clip((vtop - z) / 0.2, 0, 1)) & (z > vbot - 0.0) & (z < vtop - 0.01) & fr
        lapel = (np.abs(ax - halfw) < 0.006) & (z > vbot) & fr
        btn = (np.sqrt(x ** 2 + (z - (vbot - 0.03)) ** 2) < 0.007) & fr
        btn |= (np.sqrt(x ** 2 + (z - (vbot - 0.11)) ** 2) < 0.007) & fr
        pocket = (np.abs(ax - 0.09) < 0.045) & (np.abs(z - (base.z_hip + 0.02)) < 0.003) & fr
        D = 0.72 + 0.02 * gk.noise3(P, 0.01, 4) - 0.12 * lapel - 0.1 * pocket - 0.06 * binding(Fm, C, 0.012)
        return D, (shirt & ~tie).astype(float), np.maximum(tie, btn).astype(float), None

    p.shell(F, ok, 0.008, fn, lambda s: gk.twill(s, 3.0) * 0.4, finish="cotton", inflate=36, rate=0.6, strength=1.0)
    p.save()


# ----------------------------------------------------------------------------- registry

GARMENTS = {
    "top_crop_tank": crop_tank,
    "top_tank": tank,
    "top_cami": cami,
    "top_corset": corset,
    "top_bandeau": bandeau,
    "top_baby_tee": lambda b: tee(b, "top_baby_tee", "Y2K baby tee", "thai", ["#F7C6D9", "#E0457B", "#FFFFFF"], b.z_waist - 0.025, 0.17, graphic=g_angel, ringer=True),
    "top_oversized_tee": lambda b: tee(b, "top_oversized_tee", "No Rules oversized tee", "tolaptsd", ["#232323", "#EDE8DD", "#E63946"], b.z_hip + 0.02, 0.36, off=0.012, inflate=32, graphic=g_norules, holes=tee_holes),
    "top_crop_tee": lambda b: tee(b, "top_crop_tee", "Wild crop tee", "tolaptsd", ["#6E6E72", "#141414", "#F2C14E"], b.z_chest - 0.13, 0.22, off=0.01, inflate=30, graphic=g_wild),
    "top_flame_tee": lambda b: tee(b, "top_flame_tee", "Flame tee", "okrika", ["#111111", "#FF6A00", "#FFD23F"], b.z_hip + 0.0, 0.34, off=0.012, inflate=32, graphic=g_flames),
    "top_buba": buba,
    "top_peplum": peplum,
    "top_mesh": mesh_top,
    "top_sports_bra": sports_bra,
    "top_lace_bralette": bralette,
    "bottom_baggy_jeans": baggy_jeans,
    "bottom_skinny_jeans": skinny_jeans,
    "bottom_ripped_jeans": ripped_jeans,
    "bottom_cargo": cargo,
    "bottom_flare_pants": flare_pants,
    "bottom_leggings": leggings,
    "bottom_lace_briefs": lace_briefs,
    "bottom_mini_skirt": lambda b: skirts(b, "bottom_mini_skirt"),
    "bottom_pleated_mini": lambda b: skirts(b, "bottom_pleated_mini"),
    "bottom_satin_mini": lambda b: skirts(b, "bottom_satin_mini"),
    "bottom_midi_skirt": lambda b: skirts(b, "bottom_midi_skirt"),
    "bottom_pencil_skirt": lambda b: skirts(b, "bottom_pencil_skirt"),
    "bottom_iro": lambda b: skirts(b, "bottom_iro"),
    "dress_slip": slip_dress,
    "dress_sequin_mini": sequin_mini,
    "dress_velvet_mini": velvet_mini,
    "dress_lace_bodysuit": lace_bodysuit,
    "dress_maxi": maxi_dress,
    "top_square_crop": baddie_top,
    "bottom_micro_skirt": micro_skirt,
    "top_everyday_tee": lambda b: tee(b, "top_everyday_tee", "Everyday tee", "okrika", ["#F2F0EA", "#B8A68A", "#F2F0EA"], b.z_hip + 0.0, 0.3, off=0.004, inflate=28, graphic=g_stains),
    "bottom_overalls": overalls,
    "bottom_wide_trousers": lambda b: trousers(b, "bottom_wide_trousers", "Wide-leg trousers", "dopebyfabby", ["#E8DCC6", "#D9C9AE", "#C9A04A"], width=1.6, finish="satin"),
    "top_track_jacket": track_jacket,
    "bottom_track_pants": lambda b: trousers(b, "bottom_track_pants", "Track pants", "novasport", ["#141E3C", "#FFFFFF", "#E8E8E8"], width=0.5, stripes=True, band=0.03),
    "top_suit_jacket": suit_jacket,
    "bottom_suit_trousers": lambda b: trousers(b, "bottom_suit_trousers", "Tailored trousers", "dopebyfabby", ["#1E2740", "#1E2740", "#1E2740"], width=0.35, crease=True, band=0.03),
}


def build(ids):
    import shoes  # noqa: E402  (shoes need the posed-foot helpers; see shoes.py)

    registry = {**GARMENTS, **shoes.SHOES}
    for pid in ids or registry:
        base = gk.Base()
        registry[pid](base) if pid in GARMENTS else shoes.SHOES[pid](base, Piece)
        gk.log("built", pid)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    build(args)

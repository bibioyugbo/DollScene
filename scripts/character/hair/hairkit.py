"""
Shared helpers for the hand-built hairstyles (braids, locs, afro...). Run inside Blender 4.5
with MPFB 2, headless:

    Blender -b --python scripts/character/hair/style_<id>.py

Conventions (docs/ASSET_SPEC.md §4):
  * Blender space: Z up, the character faces -Y, her left is +X. Units are metres.
  * Directions from the skull centre: az 0 = front (-Y), 90 = her left (+X), +-180 = back;
    el 0 = horizontal, 90 = straight up.
  * One object per style named "Hair_<id>", skinned to the mixamo rig ("mixamorig:" bone names;
    build_character.py strips the prefix on export).
  * Strand UVs: U wraps the tube, V runs from the root to 0 at the tip.
  * Per-vertex float attributes (exported to glTF as _TIP/_STRAND/_SECTION):
      _tip      0 at the root .. 1 at the tip (the app's ombre; also strand reveal animations)
      _strand   stable strand id (braid / loc / twist / knot) as index / (count - 1); 0 on shells
      _section  scalp section 0..7 (see section_of) of the strand ROOT; shells use each vertex's
                own direction from the skull centre
  * Material "Hair*" is a grayscale texture (luminance ~0.62) the app tints; anything else
    ("Accent" cuffs, "Bead", "Satin" bonnet) keeps its own colour.
  * The app shows the doll with her arms lowered to her sides (src/studio/character/pose.ts) and
    always wearing a top. Head() poses the rig the same way and collides hanging hair with that
    posed body, inflated by BODY_MARGIN below the neck so hair lies on top of clothing.
"""

import json
import math
import os

import addon_utils
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ART = os.path.join(ROOT, "art", "blender")
BASE_BLEND = os.path.join(ART, "base", "base_female_mixamo.blend")
TEX_DIR = os.path.join(ROOT, "art", "hair_tex")
SCREENS = os.path.join(ROOT, "art", "screens", "hair")

HEAD_MARGIN = 0.009  # hair centre lines vs bare skin on the head
BODY_MARGIN = 0.030  # ... vs the body from the base of the neck down (a top sits 1-3 cm off the skin)

addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True)

with open(os.path.join(ROOT, "scripts", "character", "base_female.json")) as _f:
    MACROS = {k: v for k, v in json.load(_f).items() if not k.startswith("_")}


def log(*a):
    print("[hair]", *a, flush=True)


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------- sections

SECTION_NAMES = ["front-left", "front-right", "top-left", "top-right", "left-side", "right-side", "back-left", "back-right"]


def section_of(az, el):
    """Scalp section 0..7 of a direction from the skull centre (az, el in degrees; left = HER left,
    +X, az > 0). One shared definition for every style:

        el >= 58 (crown / top of the head)          -> 2 top-left,   3 top-right
        otherwise |az| <  50 (forehead to temples)   -> 0 front-left, 1 front-right
                  50 <= |az| < 115 (over the ears)   -> 4 left side,  5 right side
                  |az| >= 115 (back of the head/nape)-> 6 back-left,  7 back-right
    The midline (az == 0 or 180 exactly) counts as left."""
    a = ((az + 180.0) % 360.0) - 180.0
    left = a >= 0 or a == -180.0
    if el >= 58:
        s = 2
    elif abs(a) < 50:
        s = 0
    elif abs(a) < 115:
        s = 4
    else:
        s = 6
    return s if left else s + 1


# ----------------------------------------------------------------------------- base file


def build_base():
    """Base female with the mixamo rig (what the app ships), saved as BASE_BLEND."""
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService

    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    human = HumanService.create_human(macro_detail_dict=MACROS)
    HumanService.add_builtin_rig(human, "mixamo", import_weights=True)
    assets = LocationService.get_user_data()
    for kind, name, t in (("eyes", "high-poly", "Eyes"), ("eyebrows", "eyebrow001", "Eyebrows"), ("eyelashes", "eyelashes01", "Eyelashes")):
        p = os.path.join(assets, kind, name, name + ".mhclo")
        HumanService.add_mhclo_asset(p, human, asset_type=t, subdiv_levels=0)
    human.name = "Body"
    os.makedirs(os.path.dirname(BASE_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BASE_BLEND)
    log("saved", BASE_BLEND)


def pose_arms_down(rig):
    """The app's relaxed pose (pose.ts): upper arms aimed (+-0.2, -1, -0.02) and forearms
    (+-0.1, -1, 0.16) in glTF space, i.e. Blender (x, -z, y)."""
    bpy.context.view_layer.update()
    for side, s in (("Left", 1), ("Right", -1)):
        for bn, tgt in ((f"mixamorig:{side}Arm", Vector((0.2 * s, 0.02, -1))), (f"mixamorig:{side}ForeArm", Vector((0.1 * s, -0.16, -1)))):
            pb = rig.pose.bones[bn]
            m = rig.matrix_world @ pb.matrix
            h = m.translation.copy()
            y = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
            r = y.rotation_difference(tgt.normalized()).to_matrix().to_4x4()
            pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(h) @ r @ Matrix.Translation(-h) @ m)
            bpy.context.view_layer.update()


def open_base():
    bpy.ops.wm.open_mainfile(filepath=BASE_BLEND)
    # Preview-only skin so fit screenshots read like the game (the app uses its own skin shader).
    body = bpy.data.objects["Body"]
    skin = bpy.data.materials.new("PreviewSkin")
    skin.use_nodes = True
    bsdf = next(n for n in skin.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.32, 0.17, 0.10, 1)
    bsdf.inputs["Roughness"].default_value = 0.55
    body.data.materials.clear()
    body.data.materials.append(skin)
    pose_arms_down(next(o for o in bpy.data.objects if o.type == "ARMATURE"))
    return Head()


def save_style(style_id):
    path = os.path.join(ART, "hair", f"hair_{style_id}.blend")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups next to the sources
    bpy.ops.wm.save_as_mainfile(filepath=path)
    log("saved", path)
    return path


# ----------------------------------------------------------------------------- head model


class Head:
    """Body surface queries around the head: BVH, scalp points, a spherical frame."""

    def __init__(self):
        self.body = bpy.data.objects["Body"]
        self.rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
        # Rest shape = the shape keys mixed (the armature is at rest). Indices match the base mesh.
        me = self.body.data
        mw = self.body.matrix_world
        k = self.body.shape_key_add(name="__mix", from_mix=True) if me.shape_keys else None
        src = k.data if k else me.vertices
        self.co = np.array([mw @ d.co for d in src])
        if k:
            self.body.shape_key_remove(k)
        # Helpers (joint cubes, tights) are masked in the viewport but still in the mesh: keep only "body" faces.
        gi = self.body.vertex_groups["body"].index
        keep = {v.index for v in me.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups)}
        self.in_body = np.array([i in keep for i in range(len(self.co))])
        # Collision body: the posed (arms lowered) mesh, same topology (the mask is switched off).
        masks = [m for m in self.body.modifiers if m.type == "MASK"]
        for m in masks:
            m.show_viewport = False
        dg = bpy.context.evaluated_depsgraph_get()
        ev = self.body.evaluated_get(dg)
        em = ev.to_mesh()
        self.posed = np.array([ev.matrix_world @ v.co for v in em.vertices])
        ev.to_mesh_clear()
        for m in masks:
            m.show_viewport = True
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        for v in bm.verts:
            v.co = Vector(self.posed[v.index])
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context="VERTS")
        bm.normal_update()
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()
        sg = self.body.vertex_groups["scalp"].index
        self.scalp_mask = np.array([any(g.group == sg and g.weight > 0.5 for g in v.groups) for v in self.body.data.vertices]) & self.in_body
        sc = self.co[self.scalp_mask]
        self.bone = {b.name.replace("mixamorig:", ""): (self.rig.matrix_world @ b.head_local, self.rig.matrix_world @ b.tail_local) for b in self.rig.data.bones}
        hh, ht = self.bone["Head"]
        # Centre of the skull: on the head bone, level with the middle of the scalp.
        self.c = Vector((0.0, float(sc[:, 1].mean()) * 0.6 + hh.y * 0.4, float(sc[:, 2].min() + sc[:, 2].max()) / 2))
        self.top = float(sc[:, 2].max())
        self.z_skull = hh.z  # base of the skull
        self.z_neck = self.bone["Neck"][0].z  # base of the neck
        self.kd_scalp = KDTree(len(sc))
        for i, p in enumerate(sc):
            self.kd_scalp.insert(p, i)
        self.kd_scalp.balance()
        log("head centre", tuple(round(x, 4) for x in self.c), "scalp verts", len(sc), "top", round(self.top, 4))

    # -- directions: az 0 = front (-Y), 90 = her left (+X); el 0 = horizontal, 90 = straight up
    @staticmethod
    def dir(az, el):
        a, e = math.radians(az), math.radians(el)
        return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))

    def angles(self, p):
        d = (Vector(p) - self.c).normalized()
        return math.degrees(math.atan2(d.x, -d.y)), math.degrees(math.asin(max(-1, min(1, d.z))))

    def section(self, p):
        return section_of(*self.angles(p))

    def surf(self, az, el):
        """Point and outward normal on the skin along a direction from the skull centre."""
        return self.surf_dir(self.dir(az, el))

    def surf_dir(self, d):
        d = Vector(d).normalized()
        hit, n, _i, _dist = self.bvh.ray_cast(self.c + d * 0.5, -d, 0.6)
        if hit is None:
            hit, n, _i, _dist = self.bvh.find_nearest(self.c + d * 0.1)
        return hit, n.normalized()

    def path_dirs(self, waypoints, lift=0.0035, step=0.005):
        """A curve on the scalp through (az, el) waypoints; interpolates directions (nlerp), so a
        path may cross the crown. Returns [(point lifted off the skin, normal)]."""
        ds = [self.dir(a, e) for a, e in waypoints]
        out = []
        for d0, d1 in zip(ds, ds[1:]):
            p0, _ = self.surf_dir(d0)
            p1, _ = self.surf_dir(d1)
            k = max(2, int((p1 - p0).length / step))
            for j in range(k):
                p, n = self.surf_dir(d0.lerp(d1, j / k))
                out.append((p + n * lift, n))
        p, n = self.surf_dir(ds[-1])
        out.append((p + n * lift, n))
        return out

    # Natural hairline: elevation (deg from the skull centre) by |azimuth|: forehead, temple,
    # sideburn in front of the ear, ~1 cm over the ear top, down behind the ear, nape at ear-bottom level.
    HAIRLINE = [(0, 31), (35, 25), (55, 15), (70, -4), (80, -12), (92, -6), (108, -10), (125, -26), (150, -44), (180, -50)]

    def hairline(self, az):
        a = abs(((az + 180) % 360) - 180)
        for (a0, e0), (a1, e1) in zip(self.HAIRLINE, self.HAIRLINE[1:]):
            if a <= a1:
                return e0 + (e1 - e0) * (a - a0) / (a1 - a0)
        return self.HAIRLINE[-1][1]

    def on_scalp(self, p, tol=0.006):
        _co, _i, dist = self.kd_scalp.find(p)
        return dist < tol

    def signed(self, p):
        """Signed distance of p from the (posed) skin and the nearest skin point/normal."""
        q, n, _i, _d = self.bvh.find_nearest(p)
        return (Vector(p) - q).dot(n), q, n

    def margin_at(self, p, head_margin=HEAD_MARGIN):
        """Clearance a hair centre line needs at p: head_margin on the head, BODY_MARGIN from the
        base of the neck down (over clothing), blended smoothly down the neck."""
        t = smoothstep(self.z_skull, self.z_neck + 0.004, p.z)  # 0 at the skull base .. 1 at the neck base
        return head_margin + (BODY_MARGIN - head_margin) * t

    def push_out(self, p, margin=None, head_margin=HEAD_MARGIN):
        """Move p outside the body by at least `margin` (default: margin_at(p))."""
        q, n, _i, _d = self.bvh.find_nearest(p)
        if q is None:
            return p
        m = self.margin_at(p, head_margin) if margin is None else margin
        s = (p - q).dot(n)
        if s < m:
            return q + n * m + (p - q - n * s)
        return p

    def drape(self, root, out_dir, length, step=0.012, margin=HEAD_MARGIN, stiff=0.9, gravity=Vector((0, 0, -1)), bend=0.18, iters=3, stop_z=None, body_margin=True):
        """A strand from `root`: starts along out_dir, falls under gravity (a vector, or a function of
        the current point), slides over the body. `margin` is the clearance on the head; below the
        neck it blends to BODY_MARGIN (clothing) unless body_margin=False."""
        pts = [Vector(root)]
        d = Vector(out_dir).normalized()
        n = max(2, int(length / step))
        for i in range(n):
            t = i / n
            # Stiff at the root, then gravity takes over.
            w = stiff * math.exp(-t / max(bend, 1e-3))
            g = gravity(pts[-1]) if callable(gravity) else gravity
            d = (d * w + g * (1 - w)).normalized()
            p = pts[-1] + d * step
            for _ in range(iters):
                p = self.push_out(p, None if body_margin else margin, head_margin=margin)
            seg = p - pts[-1]
            if seg.length > 1e-6:
                p = pts[-1] + seg.normalized() * step
                d = seg.normalized()
            pts.append(p)
            if stop_z is not None and p.z < stop_z:
                break
        return pts

    def lane_gravity(self, lane_x, front=False, lean=None, pull=9.0, max_pull=0.6):
        """Gravity that steers a hanging strand towards its lane: x = lane_x (keeps left/right
        order: strands never cross the spine or slide out onto the lowered arms), in front of the
        shoulders (front=True) or down the back. The pull starts below the jaw."""
        lean = (-0.28 if front else 0.16) if lean is None else lean
        z0 = self.z_skull + 0.02

        def g(p):
            w = smoothstep(z0, z0 - 0.08, p.z)
            dx = max(-max_pull, min(max_pull, (lane_x - p.x) * pull)) * w
            return Vector((dx, lean * (0.3 + 0.7 * w), -1)).normalized()

        return g

    def scalp_path(self, waypoints, lift=0.0035, samples_per_m=180):
        """A curve lying on the scalp through (az, el) waypoints, `lift` above the skin."""
        out = []
        for (a0, e0), (a1, e1) in zip(waypoints, waypoints[1:]):
            p0, _ = self.surf(a0, e0)
            p1, _ = self.surf(a1, e1)
            k = max(2, int((p1 - p0).length * samples_per_m))
            for j in range(k):
                t = j / k
                p, n = self.surf(a0 + (a1 - a0) * t, e0 + (e1 - e0) * t)
                out.append((p + n * lift, n))
        p, n = self.surf(*waypoints[-1])
        out.append((p + n * lift, n))
        return out


def scalp_roots(head, spacing_deg=9.0, el_min_off=1.5, jitter=0.0, seed=0, brick=True, el_top=89.0):
    """Grid of root directions (az, el) over the whole scalp, rows of constant elevation from the
    hairline up to the crown; spacing in degrees of arc (~1.6 mm per degree on this head).
    Returns [(az, el)] ordered front-to-back, left-to-right (stable)."""
    rng = np.random.default_rng(seed)
    out = []
    lo = min(head.hairline(a) for a in range(0, 181, 5))  # lowest hairline elevation (nape)
    el = el_top
    rows = []
    while el > lo:
        rows.append(el)
        el -= spacing_deg
    for ri, el in enumerate(rows):
        circ = max(1, int(round(360 * math.cos(math.radians(el)) / spacing_deg)))
        off = 0.5 if (brick and ri % 2) else 0.0
        for k in range(circ):
            az = -180 + 360 * (k + off) / circ
            if el < head.hairline(az) + el_min_off:
                continue
            a = az + rng.uniform(-jitter, jitter) * spacing_deg / max(math.cos(math.radians(el)), 0.2)
            e = el + rng.uniform(-jitter, jitter) * spacing_deg
            out.append((((a + 180) % 360) - 180, min(e, 89.5)))
    return out


# ----------------------------------------------------------------------------- geometry


class Builder:
    """Accumulates tube/shell geometry with per-vertex UV, _tip, _strand, _section and material."""

    def __init__(self, head):
        self.head = head
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.tip = self.bm.verts.layers.float.new("_tip")
        self.sec = self.bm.verts.layers.float.new("_section")
        self.sid = self.bm.verts.layers.int.new("__sid")
        self.strands = 0
        self.cur_sid = -1
        self.cur_sec = 0

    def begin(self, root=None, section=None):
        """Start a new strand: every vertex added until the next begin() shares its id, and its
        section comes from the root (or is given). Beads/cuffs added after a tube belong to it."""
        self.cur_sid = self.strands
        self.strands += 1
        self.cur_sec = section if section is not None else self.head.section(root)
        return self.cur_sid

    def vert(self, p, tip=0.0, section=None, sid=None):
        """A loose vertex (shells): section from its own direction unless given; strand id -1 -> 0."""
        v = self.bm.verts.new(p)
        v[self.tip] = tip
        v[self.sec] = self.head.section(p) if section is None else section
        v[self.sid] = -1 if sid is None else sid
        return v

    def _v(self, p, tip):
        v = self.bm.verts.new(p)
        v[self.tip] = tip
        v[self.sec] = self.cur_sec
        v[self.sid] = self.cur_sid
        return v

    def tube(self, pts, radius, sides=8, mat=0, frames=None, lobes=0, lobe_amp=0.0, lobe_twist=0.0, tip_from=0.0, tip_to=1.0, cap=True, v_repeat=None, wobble=None, u_offset=0.0, tip_curve=None, squash=1.0, new_strand=True, root=None, section=None):
        """Tube along pts. radius: float or callable(t). lobes: n-lobed cross-section (braids, twists).
        squash < 1 flattens the tube along the frame normal (cornrows). Starts a new strand
        (rooted at `root` or pts[0]) unless new_strand=False."""
        if new_strand:
            self.begin(root if root is not None else pts[0], section)
        bm = self.bm
        n = len(pts)
        rad = radius if callable(radius) else (lambda t, r=radius: r)
        tangents = []
        for i in range(n):
            a = pts[max(i - 1, 0)]
            b = pts[min(i + 1, n - 1)]
            tangents.append((b - a).normalized())
        up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = tangents[0].cross(up).normalized()
        rings = []
        length = 0.0
        lens = [0.0]
        for i in range(1, n):
            length += (pts[i] - pts[i - 1]).length
            lens.append(length)
        length = max(length, 1e-6)
        for i in range(n):
            t = tangents[i]
            if i > 0:
                nrm = (nrm - t * nrm.dot(t)).normalized()
            if frames is not None and frames[i] is not None:
                # caller-supplied "up" (e.g. scalp normal) so cornrows lie flat
                f = Vector(frames[i])
                nrm = (f - t * f.dot(t)).normalized()
            bi = t.cross(nrm).normalized()
            s = lens[i] / length
            r = rad(s)
            sq = squash(s) if callable(squash) else squash
            ring = []
            for k in range(sides):
                th = 2 * math.pi * k / sides
                rr = r * (1 + lobe_amp * math.cos(lobes * th + lobe_twist * lens[i])) if lobes else r
                off = nrm * math.cos(th) * rr * sq + bi * math.sin(th) * rr
                if wobble is not None:
                    off = off + wobble(i, k)
                ring.append(self._v(pts[i] + off, tip_curve(i) if tip_curve else tip_from + (tip_to - tip_from) * s))
            rings.append(ring)
        vrep = v_repeat if v_repeat is not None else length / (2 * math.pi * max(rad(0.3), 1e-4))
        for i in range(n - 1):
            for k in range(sides):
                a, b = rings[i][k], rings[i][(k + 1) % sides]
                c, d = rings[i + 1][(k + 1) % sides], rings[i + 1][k]
                f = bm.faces.new((a, b, c, d))
                f.material_index = mat
                f.smooth = True
                uvs = ((k / sides, lens[i] / length), ((k + 1) / sides, lens[i] / length), ((k + 1) / sides, lens[i + 1] / length), (k / sides, lens[i + 1] / length))
                for loop, (u, vv) in zip(f.loops, uvs):
                    loop[self.uv].uv = (u + u_offset, (1.0 - vv) * vrep)
        if cap:
            c = self._v(pts[-1] + tangents[-1] * rad(1.0) * 0.6, tip_to if not tip_curve else tip_curve(n - 1))
            for k in range(sides):
                f = bm.faces.new((rings[-1][k], rings[-1][(k + 1) % sides], c))
                f.material_index = mat
                f.smooth = True
                for loop in f.loops:
                    loop[self.uv].uv = (0.5 + u_offset, 0.0)
        return rings

    def sphere(self, centre, radius, segs=8, rings=5, mat=1, tip=1.0, scale=(1, 1, 1), axis=None, uv=False):
        """Small UV sphere or squashed bead/cuff (scale z along `axis`); belongs to the current strand."""
        bm = self.bm
        rot = Matrix.Identity(3)
        if axis is not None:
            rot = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized()).to_matrix()
        verts = []
        for i in range(1, rings):
            phi = math.pi * i / rings
            row = []
            for k in range(segs):
                th = 2 * math.pi * k / segs
                p = Vector((math.sin(phi) * math.cos(th) * scale[0], math.sin(phi) * math.sin(th) * scale[1], math.cos(phi) * scale[2])) * radius
                row.append(self._v(Vector(centre) + rot @ p, tip))
            verts.append(row)
        top = self._v(Vector(centre) + rot @ Vector((0, 0, radius * scale[2])), tip)
        bot = self._v(Vector(centre) + rot @ Vector((0, 0, -radius * scale[2])), tip)
        for k in range(segs):
            k2 = (k + 1) % segs
            fs = [bm.faces.new((top, verts[0][k], verts[0][k2])), bm.faces.new((bot, verts[-1][k2], verts[-1][k]))]
            for i in range(len(verts) - 1):
                fs.append(bm.faces.new((verts[i][k], verts[i + 1][k], verts[i + 1][k2], verts[i][k2])))
            for f in fs:
                f.material_index = mat
                f.smooth = True
                if uv:
                    for loop in f.loops:
                        loop[self.uv].uv = (k / segs, 0.5)

    def grid(self, rows, uvs, mat=0, wrap_u=None):
        """Quad grid over rows[j][i] (existing verts) with per-vertex uvs[j][i] = (u, v).
        wrap_u: join the last column to the first; the seam faces get u + wrap_u on the wrapped
        side so the texture runs on. Degenerate quads at poles become triangles."""
        bm = self.bm
        nj, ni = len(rows), len(rows[0])
        cols = ni if wrap_u is not None else ni - 1
        for j in range(nj - 1):
            for i in range(cols):
                i2 = (i + 1) % ni
                q = [rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]]
                quv = [uvs[j][i], uvs[j][i2], uvs[j + 1][i2], uvs[j + 1][i]]
                if i2 == 0:
                    quv[1] = (quv[1][0] + wrap_u, quv[1][1])
                    quv[2] = (quv[2][0] + wrap_u, quv[2][1])
                vs, us = [], []
                for v, uv in zip(q, quv):
                    if v not in vs:
                        vs.append(v)
                        us.append(uv)
                if len(vs) < 3:
                    continue
                try:
                    f = bm.faces.new(vs)
                except ValueError:
                    continue
                f.material_index = mat
                f.smooth = True
                for loop, uv in zip(f.loops, us):
                    loop[self.uv].uv = uv

    def to_object(self, name, materials):
        bm = self.bm
        st = bm.verts.layers.float.new("_strand")
        denom = max(self.strands - 1, 1)
        for v in bm.verts:
            s = v[self.sid]
            v[st] = 0.0 if s < 0 else s / denom
        bm.verts.layers.int.remove(self.sid)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        for m in materials:
            me.materials.append(m)
        log(name, "tris", tris(obj), "verts", len(me.vertices), "strands", self.strands)
        return obj


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def join(objs, name):
    """Join objects (materials merged by slot) into one named object."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = objs[0]
    o.name = o.data.name = name
    return o


def set_point_attr(obj, name, values):
    me = obj.data
    if name in me.attributes:
        me.attributes.remove(me.attributes[name])
    a = me.attributes.new(name, "FLOAT", "POINT")
    a.data.foreach_set("value", np.asarray(values, dtype=np.float32))


def get_point_attr(obj, name):
    me = obj.data
    out = np.zeros(len(me.vertices), dtype=np.float32)
    if name in me.attributes:
        me.attributes[name].data.foreach_get("value", out)
    return out


def shell_attrs(obj, head, tip=None):
    """_strand 0, _section from each vertex's direction (and _tip if given) for shell/library hair."""
    mw = obj.matrix_world
    co = [mw @ v.co for v in obj.data.vertices]
    set_point_attr(obj, "_section", [head.section(p) for p in co])
    set_point_attr(obj, "_strand", np.zeros(len(co)))
    if tip is not None:
        set_point_attr(obj, "_tip", tip)


# ----------------------------------------------------------------------------- skinning


def skin(obj, head, follow=("Head", "Neck", "Spine2", "Spine1"), root_hold=0.05):
    """Weights: everything near the skull rides the Head bone; hanging lengths blend down
    Neck -> Spine2 -> Spine1 by height so long hair follows the upper body."""
    rig = head.rig
    obj.parent = rig
    for m in list(obj.modifiers):
        if m.type == "ARMATURE":
            obj.modifiers.remove(m)
    for g in list(obj.vertex_groups):
        obj.vertex_groups.remove(g)
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    groups = {b: obj.vertex_groups.new(name="mixamorig:" + b) for b in follow}
    me = obj.data
    co = np.array([obj.matrix_world @ v.co for v in me.vertices])
    hz = head.bone["Head"][0].z  # base of the skull
    nz = head.bone["Neck"][0].z
    s2 = head.bone["Spine2"][0].z
    s1 = head.bone["Spine1"][0].z
    near = np.linalg.norm(co - np.array(head.c), axis=1) < 0.135
    for i, p in enumerate(co):
        z = p[2]
        if near[i] or z >= hz:
            w = {"Head": 1.0}
        elif z >= nz:
            t = (hz - z) / max(hz - nz, 1e-4)
            w = {"Head": 1 - 0.5 * t, "Neck": 0.5 * t}
        elif z >= s2:
            t = (nz - z) / max(nz - s2, 1e-4)
            w = {"Head": 0.5 * (1 - t), "Neck": 0.5, "Spine2": 0.5 * t}
        else:
            t = min(1.0, (s2 - z) / max(s2 - s1, 1e-4))
            w = {"Neck": 0.5 * (1 - t), "Spine2": 0.5 + 0.1 * t, "Spine1": 0.4 * t}
        tot = sum(w.values())
        for b, x in w.items():
            if x > 1e-3 and b in groups:
                groups[b].add([i], x / tot, "REPLACE")


# ----------------------------------------------------------------------------- materials & textures


def save_gray(arr, path):
    """arr (H, W) or (H, W, 2) gray[+alpha] in 0..1 -> PNG."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    h, w = arr.shape[:2]
    g = arr if arr.ndim == 2 else arr[..., 0]
    a = np.ones_like(g) if arr.ndim == 2 else arr[..., 1]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(np.dstack([g, g, g, a]).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


def save_normal_from_height(hgt, path, strength=3.0):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    gx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * strength
    gy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * strength
    n = np.dstack([-gx, -gy, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    h, w = hgt.shape
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.dstack([n * 0.5 + 0.5, np.ones((h, w))]).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


def normalise(g, target=0.62):
    return np.clip(g / max(g.mean(), 1e-4) * target, 0, 1)


def normalise_contrast(g, target=0.62, contrast=0.0, gamma=None):
    """Like normalise, but keeps (or deepens) contrast while the mean is 0.62: the 1st..99th
    percentile range is stretched to 0..1, pushed apart by a tanh S-curve (`contrast` > 0 = deeper
    shadows and brighter tops), then a power curve (bisection) sets the mean without clipping."""
    if gamma is not None and not contrast:  # old keyword: gamma > 1 meant "more contrast"
        contrast = max(0.0, (gamma - 1.0) * 3.0)
    p1, p99 = np.percentile(g, [1, 99])
    g = np.clip((g - p1) / max(p99 - p1, 1e-6), 0, 1)
    if contrast > 0:
        g = 0.5 + 0.5 * np.tanh(contrast * (g - 0.5)) / math.tanh(contrast * 0.5)
    # Mean -> target: first lift mids/highs only (g + t g (1 - g) keeps the deep shadows), then,
    # if that is not enough (or the mean is too high), a power curve.
    if g.mean() < target:
        lo, hi = 0.0, 1.0
        for _ in range(40):
            t = (lo + hi) / 2
            if (g + t * g * (1 - g)).mean() > target:
                hi = t
            else:
                lo = t
        g = g + lo * g * (1 - g)
    lo, hi = 0.05, 20.0
    for _ in range(40):
        mid = math.sqrt(lo * hi)
        if (g ** mid).mean() > target:
            lo = mid
        else:
            hi = mid
    return g ** math.sqrt(lo * hi)


def blur(a, r):
    """Separable box blur (2 passes), wraps (tileable)."""
    for _ in range(2):
        for ax in (0, 1):
            a = sum(np.roll(a, k, axis=ax) for k in range(-r, r + 1)) / (2 * r + 1)
    return a


def noise2(shape, scale, seed=0):
    """Tileable value noise (sum of random sinusoids), 0..1."""
    rng = np.random.default_rng(seed)
    h, w = shape
    y, x = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    out = np.zeros(shape)
    for _ in range(24):
        fx, fy = rng.integers(1, scale + 1, 2) * rng.choice([-1, 1], 2)
        out += np.sin(2 * math.pi * (fx * x + fy * y) + rng.uniform(0, 6.28)) / math.hypot(fx, fy)
    out -= out.min()
    return out / max(out.max(), 1e-6)


def tex_braid(T=512, seed=3, tilt=35, lobes_u=3):
    """Three-strand braid stitches (alternating tilted lobes). Returns (gray, height)."""
    y, x = np.mgrid[0:T, 0:T] / T
    lob = np.zeros((T, T))
    for k, off in ((0, 0.0), (1, 0.5)):
        yy = (y * 2 + off) % 1.0 - 0.5
        xx = (x * lobes_u + k * 0.5) % 1.0 - 0.5
        ang = math.radians(tilt if k == 0 else -tilt)
        u = xx * math.cos(ang) - yy * math.sin(ang)
        v = xx * math.sin(ang) + yy * math.cos(ang)
        lob = np.maximum(lob, np.clip(1 - (u / 0.42) ** 2 - (v / 0.3) ** 2, 0, 1))
    fibre = noise2((T, T), 60, seed=seed)
    # fine fibres running along each lobe
    streak = noise2((T, T), 90, seed=seed + 1)
    height = lob ** 0.6
    gray = normalise(0.15 + height * 0.75 + (fibre - 0.5) * 0.16 * height + (streak - 0.5) * 0.1)
    return gray, height + fibre * 0.08


def tex_twist(T=512, seed=5, tilt=40):
    """Two-strand twist: two ropes wound round each other (diagonal grooves twice per turn)."""
    y, x = np.mgrid[0:T, 0:T] / T
    ph = (x * 2 + y * 2) % 1.0  # two ropes per turn, helix
    rope = np.sin(ph * math.pi) ** 0.7
    fibre = noise2((T, T), 70, seed=seed)
    strands = (np.sin((x * 2 + y * 2) * 2 * math.pi * 7 + fibre * 3) * 0.5 + 0.5)
    height = rope
    gray = normalise(0.1 + rope * 0.8 + (strands - 0.5) * 0.15 * rope + (fibre - 0.5) * 0.1)
    return gray, height + strands * 0.05


def tex_loc(T=512, seed=9, fuzz=1.0, crevice=0.6):
    """Felted loc surface: matted fibres, irregular crevices, a few stray fibres."""
    rng = np.random.default_rng(seed)
    base = noise2((T, T), 18, seed=seed) * 0.6 + noise2((T, T), 45, seed=seed + 1) * 0.4
    fibres = np.zeros((T, T))
    yy, xx = np.mgrid[0:T, 0:T]
    for _ in range(int(2200 * fuzz)):
        cx, cy = rng.uniform(0, T, 2)
        L = rng.uniform(6, 22)
        a = rng.uniform(0, math.pi)
        t = np.linspace(-L / 2, L / 2, 24)
        px = ((cx + t * math.cos(a)) % T).astype(int)
        py = ((cy + t * math.sin(a) + np.sin(t * 0.4) * 2) % T).astype(int)
        fibres[py, px] += rng.uniform(0.4, 1.0)
    fibres = blur(np.clip(fibres, 0, 1.4), 1)
    crev = 1 - np.clip(np.abs(noise2((T, T), 10, seed=seed + 2) - 0.5) * 6, 0, 1)  # thin dark crevices
    height = base * 0.7 + fibres * 0.3 - crev * 0.25 * crevice
    gray = normalise_contrast(0.2 + base * 0.5 + fibres * 0.45 - crev * crevice * 0.35, contrast=1.5)
    return gray, height


def tex_coil(T=1024, seed=7, n=5200, dark=True):
    """Tight coils (afros, kinky leave-out). dark=True: deeper contrast (gaps read black)."""
    rng = np.random.default_rng(seed)
    coil = np.zeros((T, T))
    for _ in range(n):
        cx, cy = rng.uniform(0, T, 2)
        r = rng.uniform(3, 8) * T / 1024
        th = np.linspace(0, 2 * math.pi * rng.uniform(1.4, 2.6), 56)
        rr = r * (1 + 0.25 * np.sin(th * 3))
        px = ((cx + rr * np.cos(th)) % T).astype(int)
        py = ((cy + rr * np.sin(th) * 0.8 + th * 0.6) % T).astype(int)
        coil[py, px] += rng.uniform(0.6, 1.0)
    coil = blur(np.clip(coil, 0, 1.6), 1)
    depth = blur(coil, 6)
    clump = noise2((T, T), 12, seed=seed + 1)
    g = 0.05 + coil * 0.8 + depth * 0.5 + (clump - 0.5) * 0.25
    gray = normalise_contrast(g, contrast=5.0 if dark else 0.0)
    return gray, coil + depth + clump * 0.3


def tex_strands(T=1024, seed=11, wave=0.0, waves=4, crimp=0.0, crimps=16, clumps=24):
    """Strands along V (straight / wavy / crimped hair on shells and ribbons): fine fibres,
    clump shading across U; wave/crimp bend the fibres sideways. V tiles once per texture."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:T, 0:T] / T
    xs = x + wave * 0.02 * np.sin(2 * math.pi * waves * y) + crimp * 0.012 * (2 * np.abs((y * crimps) % 1.0 - 0.5) - 0.5)
    ph = rng.uniform(0, 6.28, 6)
    fine = sum(np.sin(2 * math.pi * f * xs + ph[i] + np.sin(2 * math.pi * y * (i + 1)) * 0.6) for i, f in enumerate((97, 151, 211, 263, 331, 401))) / 6
    cl = noise2((T, T), clumps, seed=seed)
    cl = blur(cl, 2)
    # clumps vary across U, slowly along V
    across = np.zeros((T, T))
    for i in range(5):
        across += np.sin(2 * math.pi * (i + 2) * 3 * xs + rng.uniform(0, 6.28)) / (i + 1)
    across = (across - across.min()) / max(np.ptp(across), 1e-6)
    g = 0.35 + across * 0.35 + fine * 0.12 + (cl - 0.5) * 0.25
    if crimp > 0:
        g += crimp * 0.15 * np.cos(2 * math.pi * crimps * y)
    gray = normalise_contrast(g, contrast=1.0)
    return gray, across * 0.6 + fine * 0.2


def write_tex(style_id, gray, height=None, strength=3.0, suffix=""):
    """art/hair_tex/<id><suffix>.png (+ _n normal map from height). Returns (tex, nrm) paths."""
    tex = os.path.join(TEX_DIR, f"{style_id}{suffix}.png")
    save_gray(gray, tex)
    nrm = None
    if height is not None:
        nrm = os.path.join(TEX_DIR, f"{style_id}{suffix}_n.png")
        save_normal_from_height(height, nrm, strength=strength)
    for stale in (os.path.join(TEX_DIR, f"{style_id}_fuzz.png"),):
        if suffix == "" and os.path.exists(stale) and not gray.ndim == 3:
            pass
    return tex, nrm


def hair_material(name, tex_path, nrm_path=None, preview=(0.03, 0.022, 0.02), tip_preview=None, roughness=0.75):
    """Blender preview of the app's hair shader: gray texture x colour, ombre on the _tip attribute."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = roughness
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(tex_path, check_existing=True)
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "_tip"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*preview, 1)
    mix.inputs["B"].default_value = (*(tip_preview or preview), 1)
    nt.links.new(attr.outputs["Fac"], mix.inputs["Factor"])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(mix.outputs["Result"], mul.inputs["A"])
    nt.links.new(tex.outputs["Color"], mul.inputs["B"])
    gain = nt.nodes.new("ShaderNodeMixRGB")  # undo the 0.62 normalisation like the app does
    gain.blend_type = "MULTIPLY"
    gain.inputs["Fac"].default_value = 1.0
    gain.inputs["Color2"].default_value = (1 / 0.62, 1 / 0.62, 1 / 0.62, 1)
    nt.links.new(mul.outputs["Result"], gain.inputs["Color1"])
    nt.links.new(gain.outputs["Color"], bsdf.inputs["Base Color"])
    if nrm_path:
        nimg = bpy.data.images.load(nrm_path, check_existing=True)
        nimg.colorspace_settings.name = "Non-Color"
        nt_ = nt.nodes.new("ShaderNodeTexImage")
        nt_.image = nimg
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nt_.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def accent_material(name="Accent", color=(0.85, 0.62, 0.22), metallic=1.0, roughness=0.3):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


# ----------------------------------------------------------------------------- MPFB library hair


def tint_ready(src_path, out_path, size=1024):
    """MPFB hair texture -> grayscale (luminance normalised to 0.62 over opaque texels), alpha kept."""
    img = bpy.data.images.load(src_path, check_existing=False)
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    px = px.reshape(h, w, 4)
    lum = px[..., :3] @ [0.2126, 0.7152, 0.0722]
    a = px[..., 3]
    m = lum[a > 0.5].mean() if (a > 0.5).any() else lum.mean()
    g = np.clip(lum / max(m, 1e-4) * 0.62, 0, 1)
    f = max(1, h // size)
    if f > 1:
        g = g.reshape(h // f, f, w // f, f).mean(axis=(1, 3))
        a = a.reshape(h // f, f, w // f, f).mean(axis=(1, 3))
    save_gray(np.dstack([g, a]), out_path)
    return out_path


# ----------------------------------------------------------------------------- checks


def poke_report(obj, head, cloth=None):
    """Hair vertices vs the posed body: inside the skin (roots tucked into the scalp count),
    deeper than 4 mm, and - from the base of the neck down - closer than 2 cm to the skin (would
    sink into a top). With `cloth` (a clothing object), also vertices inside that garment."""
    dg = bpy.context.evaluated_depsgraph_get()
    co = [obj.matrix_world @ v.co for v in obj.data.vertices]
    inside = deep = under_top = 0
    for p in co:
        s, _q, _n = head.signed(p)
        if s < 0:
            inside += 1
            if s < -0.004:
                deep += 1
        if p.z < head.z_neck and s < 0.02:
            under_top += 1
    in_cloth = None
    if cloth is not None:
        ev = cloth.evaluated_get(dg)
        m = ev.to_mesh()
        bm = bmesh.new()
        bm.from_mesh(m)
        bm.transform(ev.matrix_world)
        bm.normal_update()
        cb = BVHTree.FromBMesh(bm)
        bm.free()
        ev.to_mesh_clear()
        in_cloth = 0
        for p in co:
            q, n, _i, d = cb.find_nearest(p)
            if q is not None and d < 0.03 and (p - q).dot(n) < 0 and head.signed(p)[0] < 0.05:
                in_cloth += 1
    r = {"verts": len(co), "inside_skin": inside, "deeper_4mm": deep, "below_neck_lt_2cm": under_top, "inside_top": in_cloth, "tris": tris(obj)}
    log(obj.name, "POKE", json.dumps(r))
    return r


# ----------------------------------------------------------------------------- validation renders

VIEWS_HEAD = [
    ("front", (0, -1, 0.05)), ("front 3/4", (0.62, -0.78, 0.1)), ("left", (1, 0, 0.05)), ("back", (0, 1, 0.08)),
    ("right", (-1, 0, 0.05)), ("above", (0, 0.25, 1)), ("below back", (0, 0.75, -0.66)), ("back 3/4", (-0.65, 0.72, 0.12)),
]
VIEWS_FULL = [("front", (0, -1, 0.02)), ("left", (1, 0, 0.02)), ("back", (0, 1, 0.02)), ("front 3/4 right", (-0.6, -0.8, 0.05))]


def add_outfit(head, name="female_casualsuit02"):
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService

    p = os.path.join(LocationService.get_user_data(), "clothes", name, name + ".mhclo")
    o = HumanService.add_mhclo_asset(p, head.body, asset_type="Clothes", subdiv_levels=0)
    return o


def render_sheet(style_id, objs, head, outfit="female_casualsuit02", size=384, full=None, extra_views=None):
    """Multi-view validation sheet -> art/screens/hair/<id>.png. Row 1-2: head close-ups (front,
    3/4, left, back / right, above, below-back (torso clipped away), back 3/4); row 3: full length
    (front, left, back, 3/4) when the hair hangs below the neck (or full=True); last row:
    close-ups of the forehead hairline, left ear, nape and right temple.
    Call AFTER save_style: it adds the outfit and lights to the scene. Returns (path, cloth)."""
    sc = bpy.context.scene
    cloth = add_outfit(head, outfit) if outfit else None
    engine = os.environ.get("HAIR_RENDER", "workbench")
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    if engine == "eevee":
        try:
            sc.render.engine = "BLENDER_EEVEE_NEXT"
        except TypeError:
            sc.render.engine = "BLENDER_EEVEE"
        sc.eevee.taa_render_samples = 16
        world = sc.world or bpy.data.worlds.new("W")
        sc.world = world
        world.use_nodes = True
        bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
        bg.inputs["Color"].default_value = (0.32, 0.33, 0.36, 1)
        bg.inputs["Strength"].default_value = 0.9
        for nm, rot, en in (("Key", (math.radians(50), 0, math.radians(-35)), 3.0), ("Rim", (math.radians(60), 0, math.radians(160)), 2.0), ("Fill", (math.radians(75), 0, math.radians(60)), 1.0)):
            ld = bpy.data.lights.new(nm, "SUN")
            ld.energy = en
            lo = bpy.data.objects.new(nm, ld)
            lo.rotation_euler = rot
            sc.collection.objects.link(lo)
    else:
        # Workbench (fast on this machine): flat material colours, studio light, cavity + shadow.
        sc.render.engine = "BLENDER_WORKBENCH"
        sh = sc.display.shading
        sh.light = "STUDIO"
        sh.color_type = "TEXTURE"
        sh.show_specular_highlight = False
        sh.show_cavity = True
        sh.cavity_type = "BOTH"
        sh.cavity_ridge_factor = 0.6
        sh.cavity_valley_factor = 1.4
        sh.show_shadows = True
        sh.shadow_intensity = 0.4
        sh.show_backface_culling = False
        sh.background_type = "VIEWPORT"
        sh.background_color = (0.3, 0.31, 0.34)
        sc.display.render_aa = "8"
        tint = (0.2, 0.135, 0.095)  # brown preview tint (the app tints the same 0.62 gray)
        for m in bpy.data.materials:
            nm = m.name
            if nm.startswith("Hair") and m.use_nodes:
                m.diffuse_color = (*tint, 1)
                for n in m.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image and n.image.colorspace_settings.name != "Non-Color":
                        src = n.image
                        w, h = src.size
                        a = np.empty(w * h * 4, dtype=np.float32)
                        src.pixels.foreach_get(a)
                        a = a.reshape(h, w, 4)
                        a[..., :3] = np.clip(a[..., :3] / 0.62 * np.array(tint), 0, 1)
                        pv = bpy.data.images.new("pv_" + src.name, w, h, alpha=True)
                        pv.pixels.foreach_set(a.ravel())
                        n.image = pv
                        m.node_tree.nodes.active = n
                        break
            elif nm == "PreviewSkin":
                m.diffuse_color = (0.42, 0.24, 0.15, 1)
            elif m.use_nodes and not nm.startswith("Hair"):
                bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if bsdf and not bsdf.inputs["Base Color"].is_linked:
                    m.diffuse_color = tuple(bsdf.inputs["Base Color"].default_value)
        if cloth is not None:
            for m in cloth.data.materials:
                if m:
                    m.diffuse_color = (0.16, 0.25, 0.42, 1)
    cam_d = bpy.data.cameras.new("Cam")
    cam_d.type = "ORTHO"
    cam = bpy.data.objects.new("Cam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam

    # framing
    pts = []
    for o in objs:
        a = np.empty(len(o.data.vertices) * 3)
        o.data.vertices.foreach_get("co", a)
        a = a.reshape(-1, 3)
        mw = np.array(o.matrix_world)
        pts.append(a @ mw[:3, :3].T + mw[:3, 3])
    pts = np.vstack(pts)
    lo_, hi_ = pts.min(axis=0), pts.max(axis=0)
    hc = np.array(head.c)
    head_lo = np.minimum(lo_, hc - 0.13)
    head_hi = np.maximum(hi_, hc + 0.13)
    head_lo[2] = max(head_lo[2], hc[2] - 0.17)
    head_hi[2] = max(head_hi[2], hc[2] + 0.13)
    hang = lo_[2] < head.z_neck - 0.04
    rows = [VIEWS_HEAD[:4], VIEWS_HEAD[4:]]
    if full or (full is None and hang):
        rows.append(VIEWS_FULL)
    if extra_views:
        rows.append(extra_views)
    # close-ups: forehead hairline, left ear, nape, right temple (ortho 15 cm around a scalp point)
    close = []
    for name, az, el, dv in (("hairline", 0, 31, (0, -1, 0.35)), ("left ear", 88, -6, (1, 0.05, 0.1)), ("nape", 180, -46, (0, 1, -0.15)), ("right temple", -62, 12, (-0.8, -0.6, 0.15))):
        p, _n = head.surf(az, el)
        close.append((name, dv, p))
    rows.append(close)
    tmp = os.path.join(SCREENS, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    tiles = []
    for ri, row in enumerate(rows):
        tr = []
        for vi, view in enumerate(row):
            name, d = view[0], view[1]
            if len(view) > 2:
                ctr = Vector(view[2])
                dv = Vector(d).normalized()
                cam.location = ctr + dv * 3.0
                cam.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
                cam_d.ortho_scale = 0.15
                cam_d.clip_start = 1.0
                cam_d.clip_end = 6.0
                fp = os.path.join(tmp, f"{style_id}_{ri}_{vi}.png")
                sc.render.filepath = fp
                bpy.ops.render.render(write_still=True)
                tr.append(fp)
                continue
            if ri < 2:
                lo2, hi2 = head_lo, head_hi
            else:
                lo2 = np.array([min(lo_[0], -0.24), min(lo_[1], -0.16), min(lo_[2] - 0.05, head.z_neck - 0.25)])
                hi2 = np.array([max(hi_[0], 0.24), max(hi_[1], 0.16), max(hi_[2], hc[2] + 0.13)])
            ctr = Vector(((lo2 + hi2) / 2).tolist())
            ext = float(np.linalg.norm(hi2 - lo2))
            dv = Vector(d).normalized()
            cam.location = ctr + dv * 3.0
            cam.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
            cam_d.ortho_scale = max(hi2 - lo2) * 1.12 if ri >= 2 else ext * 0.78
            cam_d.clip_start = 3.0 - (0.2 if name.startswith("below") else 2.0)
            cam_d.clip_end = 6.0
            fp = os.path.join(tmp, f"{style_id}_{ri}_{vi}.png")
            sc.render.filepath = fp
            bpy.ops.render.render(write_still=True)
            tr.append(fp)
        tiles.append(tr)
    # compose
    sheet = np.zeros((size * len(tiles), size * 4, 4), dtype=np.float32)
    for ri, tr in enumerate(tiles):
        for vi, fp in enumerate(tr):
            img = bpy.data.images.load(fp)
            a = np.empty(size * size * 4, dtype=np.float32)
            img.pixels.foreach_get(a)
            bpy.data.images.remove(img)
            y0 = (len(tiles) - 1 - ri) * size
            sheet[y0:y0 + size, vi * size:(vi + 1) * size] = a.reshape(size, size, 4)
            os.remove(fp)
    out = os.path.join(SCREENS, f"{style_id}.png")
    img = bpy.data.images.new(f"sheet_{style_id}", size * 4, size * len(tiles), alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = out
    img.file_format = "PNG"
    img.save()
    log("sheet", out)
    return out, cloth


def finish(style_id, obj, head, render=True, **kw):
    """Skinned + attributes already set: save the .blend, then render the sheet and report pokes."""
    for a in ("_tip", "_strand", "_section"):
        assert a in obj.data.attributes, f"{obj.name} lacks {a}"
    if "strand" in obj.data.attributes:
        obj.data.attributes.remove(obj.data.attributes["strand"])
    save_style(style_id)
    cloth = None
    if render:
        _p, cloth = render_sheet(style_id, [obj], head, **kw)
    return poke_report(obj, head, cloth)

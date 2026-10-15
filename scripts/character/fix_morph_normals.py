"""
Correct the NORMAL deltas of the morphs that are built ON TOP of other morphs.

glTF morph normals are per key, relative to the basis: Blender writes each key's normal delta as
normals(basis + key) - normals(basis). That's right for keys used on their own, but ChestFlat_Pos
(the male chest, worn with Masc_Pos) and BackStraight_Pos (the straight back, worn with
Masc_Pos) were measured on the masculine body: applied to the female basis their shape means
something else, so their normal deltas are wrong. The game sums the keys: the positions come out
right but the shading shows craters and rings round where the breasts were.

This rewrites those keys' normal deltas as normals(base + context + key) - normals(base + context),
computed on the welded surface (UV seams joined), for every mesh in every GLB of a build:
    python3 scripts/character/fix_morph_normals.py .character-build
Run it after build_character.py and before optimize.sh.

It also drops "spikes" from garments: stray sliver triangles far longer than the garment's own
mesh (a vertex that got a bad offset in the build stretches a long thin line out of the fabric,
e.g. down the stomach or out past the arm). Nothing else about a mesh changes.
"""
import glob
import json
import os
import struct
import sys

import numpy as np

FIXES = {
    # key: the morphs it is always worn with
    "ChestFlat_Pos": ("Masc_Pos",),
    "BackStraight_Pos": ("Masc_Pos",),
    # a man's weight is measured on the male base (Masc_Pos) too
    "MascSoft_Neg": ("Masc_Pos",),
    "MascSoft_Pos": ("Masc_Pos",),
}
DT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    f = open(path, "rb").read()
    jl = struct.unpack("<I", f[12:16])[0]
    j = json.loads(f[20:20 + jl])
    bl = struct.unpack("<I", f[20 + jl:24 + jl])[0]
    b = bytearray(f[28 + jl:28 + jl + bl])
    return j, b


def write_glb(path, j, b):
    while len(b) % 4:
        b.append(0)
    j["buffers"][0]["byteLength"] = len(b)
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    total = 12 + 8 + len(js) + 8 + len(b)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(b), b"BIN\0"))
        f.write(bytes(b))


def accessor(j, b, i):
    a = j["accessors"][i]
    n = NCOMP[a["type"]]
    dt = DT[a["componentType"]]

    def raw(bvi, off, cnt, dtype):
        bv = j["bufferViews"][bvi]
        return np.frombuffer(bytes(b), dtype=dtype, count=cnt, offset=bv.get("byteOffset", 0) + off)

    if "bufferView" in a:
        arr = raw(a["bufferView"], a.get("byteOffset", 0), a["count"] * n, dt).astype(np.float64)
    else:
        arr = np.zeros(a["count"] * n)
    if "sparse" in a:
        sp = a["sparse"]
        ii = raw(sp["indices"]["bufferView"], sp["indices"].get("byteOffset", 0), sp["count"], DT[sp["indices"]["componentType"]]).astype(np.int64)
        vv = raw(sp["values"]["bufferView"], sp["values"].get("byteOffset", 0), sp["count"] * n, dt).astype(np.float64).reshape(-1, n)
        arr = arr.reshape(a["count"], n)
        arr[ii] = vv
        arr = arr.ravel()
    return arr.reshape(a["count"], n) if n > 1 else arr


def add_accessor(j, b, data):
    """Append a dense float32 VEC3 accessor; returns its index."""
    data = np.ascontiguousarray(data, dtype=np.float32)
    while len(b) % 4:
        b.append(0)
    off = len(b)
    b.extend(data.tobytes())
    j["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": data.nbytes})
    j["accessors"].append({"bufferView": len(j["bufferViews"]) - 1, "componentType": 5126, "count": len(data), "type": "VEC3", "max": data.max(0).tolist(), "min": data.min(0).tolist()})
    return len(j["accessors"]) - 1


def add_indices(j, b, F):
    """Append a uint32 index accessor; returns its index."""
    data = np.ascontiguousarray(F.ravel(), dtype=np.uint32)
    while len(b) % 4:
        b.append(0)
    off = len(b)
    b.extend(data.tobytes())
    j["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": data.nbytes, "target": 34963})
    j["accessors"].append({"bufferView": len(j["bufferViews"]) - 1, "componentType": 5125, "count": len(data), "type": "SCALAR"})
    return len(j["accessors"]) - 1


def drop_spikes(j, b, pr):
    """Remove sliver triangles with an edge > max(6 cm, 4x the mesh's median edge). Returns how many."""
    P = accessor(j, b, pr["attributes"]["POSITION"])
    F = accessor(j, b, pr["indices"]).astype(np.int64).reshape(-1, 3)
    a, bb, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    longest = np.stack([np.linalg.norm(a - bb, axis=1), np.linalg.norm(bb - c, axis=1), np.linalg.norm(c - a, axis=1)], 1).max(1)
    bad = longest > max(0.06, 4 * float(np.median(longest)))
    if bad.any():
        pr["indices"] = add_indices(j, b, F[~bad])
    return int(bad.sum())


def welded_normals(P, F, inv, nw):
    """Area-weighted vertex normals on the welded surface, scattered back to every vertex."""
    Pw = np.zeros((nw, 3))
    Pw[inv] = P
    Fw = inv[F]
    fn = np.cross(Pw[Fw[:, 1]] - Pw[Fw[:, 0]], Pw[Fw[:, 2]] - Pw[Fw[:, 0]])
    n = np.zeros((nw, 3))
    for k in range(3):
        np.add.at(n, Fw[:, k], fn)
    n /= np.maximum(np.linalg.norm(n, axis=1)[:, None], 1e-12)
    return n[inv]


def fix_file(path, spikes=False):
    j, b = read_glb(path)
    changed = 0
    for mesh in j.get("meshes", []):
        if spikes:
            for pr in mesh["primitives"]:
                if "indices" in pr:
                    n = drop_spikes(j, b, pr)
                    if n:
                        print(f"{os.path.basename(path)} {mesh.get('name')}: {n} spike triangle(s) dropped")
                        changed += 1
        names = (mesh.get("extras") or {}).get("targetNames") or []
        for pr in mesh["primitives"]:
            targets = pr.get("targets") or []
            if not targets or "indices" not in pr or "NORMAL" not in pr["attributes"]:
                continue
            P = accessor(j, b, pr["attributes"]["POSITION"])
            F = accessor(j, b, pr["indices"]).astype(np.int64).reshape(-1, 3)
            q = np.round(P * 1e5).astype(np.int64)
            _, inv = np.unique(q, axis=0, return_inverse=True)
            inv = inv.ravel()
            nw = inv.max() + 1
            pos = {names[k]: k for k in range(min(len(names), len(targets)))}
            for key, context in FIXES.items():
                if key not in pos or "NORMAL" not in targets[pos[key]]:
                    continue
                ctx = P.copy()
                for c in context:
                    if c in pos:
                        ctx = ctx + accessor(j, b, targets[pos[c]]["POSITION"])
                d = accessor(j, b, targets[pos[key]]["POSITION"])
                if not np.abs(d).max() > 0:
                    continue
                dn = welded_normals(ctx + d, F, inv, nw) - welded_normals(ctx, F, inv, nw)
                # only where the key actually moves the surface (elsewhere the delta is noise)
                moved = np.linalg.norm(d, axis=1) > 1e-7
                near = moved.copy()
                Fm = F[moved[F].any(axis=1)]
                near[Fm.ravel()] = True
                dn[~near] = 0
                targets[pos[key]]["NORMAL"] = add_accessor(j, b, dn)
                changed += 1
    if changed:
        write_glb(path, j, b)
    return changed


if __name__ == "__main__":
    root = sys.argv[1]
    total = 0
    for p in sorted(glob.glob(os.path.join(root, "**", "*.glb"), recursive=True)):
        # garments only (the body and hair are clean by construction)
        # (shoes keep theirs: a sole's long strips are real, and dropping them would open holes)
        n = fix_file(p, spikes=(os.sep + "pieces" + os.sep in p or os.sep + "outfits" + os.sep in p) and not os.path.basename(p).startswith("shoes"))
        total += n
        if n:
            print(f"{os.path.relpath(p, root)}: {n} morph normal(s) fixed")
    print(f"done: {total} morph normals fixed")

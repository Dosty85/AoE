"""
Render 3D modelů (CC0 Castle/Nature kit) z izometrické kamery do PNG spritů.
Spuštění:
  & "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" --background --python tools/render_sprites.py

Výstup: client/public/sprites/<name>.png + manifest.json (kotvy = bod dotyku se zemí).
Konfigurace: tools/models.json.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "tools", "models.json"), encoding="utf-8"))
OUT_DIR = os.path.join(ROOT, "client", "public", "sprites")
os.makedirs(OUT_DIR, exist_ok=True)

FRAME_TILES = CFG["frameTiles"]
TILE_PX = CFG["tilePx"]
RENDER_SCALE = CFG["renderScale"]
RES = FRAME_TILES * TILE_PX  # px (logické); render běží v RENDER_SCALE násobku


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def setup_world_and_camera():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.film_transparent = True
    scene.render.resolution_x = RES * RENDER_SCALE
    scene.render.resolution_y = RES * RENDER_SCALE
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    try:
        scene.eevee.taa_render_samples = 32
    except Exception:
        pass
    scene.view_settings.view_transform = "Standard"

    # jemné ambientní světlo z prostředí
    world = bpy.data.worlds.new("W") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (1, 1, 1, 1)
        bg.inputs[1].default_value = 0.35

    # kamera: ortografická 2:1 dimetrická izometrie (azimut 45°, elevace 30°)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = FRAME_TILES
    cam_data.shift_y = 0.15  # základna níž v rámu → prostor nad budovou
    cam_data.clip_end = 500
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = Euler((math.radians(60), 0.0, math.radians(45)), "XYZ")
    view_dir = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    cam.location = -view_dir * 100
    scene.camera = cam

    # slunce z levého-horního rohu
    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 3.2
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = Euler((math.radians(50), math.radians(8), math.radians(-50)), "XYZ")
    return scene, cam


def import_model(ref):
    src, name = ref.split(":", 1)
    base = os.path.join(ROOT, CFG["sources"][src])
    before = set(bpy.data.objects)
    for ext in (".glb", ".gltf", ".fbx", ".obj"):
        path = os.path.join(base, name + ext)
        if not os.path.exists(path):
            continue
        if ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        else:
            bpy.ops.wm.obj_import(filepath=path)
        return [o for o in bpy.data.objects if o not in before]
    raise FileNotFoundError(ref)


def combined_bbox(objs):
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            for i in range(3):
                mins[i] = min(mins[i], w[i])
                maxs[i] = max(maxs[i], w[i])
    return mins, maxs


def build_sprite(name, spec):
    clear_scene()
    scene, cam = setup_world_and_camera()

    compose = spec.get("compose", "stack")  # stack = díly nad sebe (budovy); overlay = na sobě (postava+doplňky)
    all_objs = []
    cum_top = 0.0
    for ref in spec["parts"]:
        objs = import_model(ref)
        if compose == "stack":
            mins, maxs = combined_bbox(objs)
            dz = cum_top - mins.z
            for o in objs:
                if o.parent is None:
                    o.location.z += dz
            bpy.context.view_layer.update()
            _, maxs2 = combined_bbox(objs)
            cum_top = maxs2.z
        all_objs.extend(objs)

    # volitelná rotace kolem Z (natočení postavy ke kameře)
    rz = spec.get("rotateZ", 0)
    if rz:
        for o in all_objs:
            if o.parent is None:
                o.rotation_euler.z += math.radians(rz)
        bpy.context.view_layer.update()

    mins, maxs = combined_bbox(all_objs)
    cx = (mins.x + maxs.x) / 2
    cy = (mins.y + maxs.y) / 2
    fit = spec.get("fit", "width")  # width = podle půdorysu (budovy); height = podle výšky (jednotky)
    extent = (maxs.z - mins.z) if fit == "height" else max(maxs.x - mins.x, maxs.y - mins.y)
    factor = spec["scaleTiles"] / (extent or 1.0)

    # vystřeď základnu na origin a naškáluj na cílový footprint v dlaždicích
    for o in all_objs:
        if o.parent is None:
            o.location = (o.location.x - cx) * factor, (o.location.y - cy) * factor, (o.location.z - mins.z) * factor
            o.scale = [s * factor for s in o.scale]

    def set_color(m, col):
        if m and m.use_nodes:
            bsdf = m.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (col[0], col[1], col[2], 1)
        elif m:
            m.diffuse_color = (col[0], col[1], col[2], 1)

    # tint: celé (rock→zlato) nebo jen pojmenované materiály (tunika vesničana)
    if "tint" in spec:
        for o in all_objs:
            for slot in o.material_slots:
                set_color(slot.material, spec["tint"])
    if "tintMaterials" in spec:
        for o in all_objs:
            for slot in o.material_slots:
                m = slot.material
                if not m:
                    continue
                for key, col in spec["tintMaterials"].items():
                    if m.name.startswith(key):
                        set_color(m, col)

    out = os.path.join(OUT_DIR, name + ".png")
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)

    # kotva = projekce světového počátku (0,0,0 = bod dotyku se zemí) do obrázku
    co = world_to_camera_view(scene, cam, Vector((0, 0, 0)))
    anchor_x = co.x
    anchor_y = 1.0 - co.y
    print(f"[render] {name} -> {out}  anchor=({anchor_x:.3f},{anchor_y:.3f})")
    return {"file": name + ".png", "anchorX": round(anchor_x, 4), "anchorY": round(anchor_y, 4)}


def main():
    setup_world_and_camera()
    manifest = {}
    for name, spec in CFG["sprites"].items():
        manifest[name] = build_sprite(name, spec)
    json.dump(manifest, open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8"), indent=2)
    print(f"[render] hotovo: {len(manifest)} spritů + manifest.json")


main()

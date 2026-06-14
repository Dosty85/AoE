"""
Render ANIMOVANÝCH jednotek z riggovaného .blend (Quaternius Knight) do snímků spritů.
Spuštění (otevírá blend přes CLI):
  blender "<unitsBlend>" -b -P tools/render_units.py

Pro každou jednotku a animaci (idle/walk) vyrenderuje snímky do client/public/sprites/
a doplní je do manifest.json jako { anims: { idle:[...], walk:[...] } }.
"""
import bpy
import json
import math
import os
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "tools", "models.json"), encoding="utf-8"))
OUT_DIR = os.path.join(ROOT, "client", "public", "sprites")
os.makedirs(OUT_DIR, exist_ok=True)

FRAME_TILES = CFG["frameTiles"]
RES = FRAME_TILES * CFG["tilePx"]
RENDER_SCALE = CFG["renderScale"]
SPRITE_SCALE = CFG.get("spriteScale", 1.0)


def setup_camera_lights():
    sc = bpy.context.scene
    # smaž existující kamery/světla z blendu, ať řídíme vzhled
    for o in list(bpy.data.objects):
        if o.type in ("CAMERA", "LIGHT"):
            bpy.data.objects.remove(o, do_unlink=True)

    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.film_transparent = True
    sc.render.resolution_x = RES * RENDER_SCALE
    sc.render.resolution_y = RES * RENDER_SCALE
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    try:
        sc.eevee.taa_render_samples = 32
    except Exception:
        pass
    sc.view_settings.view_transform = "Standard"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (1, 1, 1, 1)
        bg.inputs[1].default_value = 0.35

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = FRAME_TILES
    cam_d.shift_y = 0.15
    cam_d.clip_end = 500
    cam = bpy.data.objects.new("Cam", cam_d)
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = Euler((math.radians(60), 0.0, math.radians(45)), "XYZ")
    vd = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    cam.location = -vd * 100
    sc.camera = cam

    sd = bpy.data.lights.new("Sun", type="SUN")
    sd.energy = 3.2
    sun = bpy.data.objects.new("Sun", sd)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = Euler((math.radians(50), math.radians(8), math.radians(-50)), "XYZ")
    return cam


def eval_bbox(mesh):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for c in ev.bound_box:
        w = mesh.matrix_world @ Vector(c)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])
    return mins, maxs


def set_color(m, col):
    if m and m.use_nodes:
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (col[0], col[1], col[2], 1)
    elif m:
        m.diffuse_color = (col[0], col[1], col[2], 1)


def main():
    cam = setup_camera_lights()
    sc = bpy.context.scene
    arm = bpy.data.objects["HumanArmature"]
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")
    actions = bpy.data.actions

    # výchozí póza Idle pro výpočet transformace
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = actions["Idle"]

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    manifest = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else {}

    for uname, ucfg in CFG["units"].items():
        # root empty pro škálu/posun/rotaci (zachová rig)
        for o in list(bpy.data.objects):
            if o.name == "Root":
                bpy.data.objects.remove(o, do_unlink=True)
        if arm.parent is not None:
            arm.parent = None
        empty = bpy.data.objects.new("Root", None)
        bpy.context.collection.objects.link(empty)
        arm.parent = empty
        arm.matrix_parent_inverse = empty.matrix_world.inverted()

        sc.frame_set(int(actions["Idle"].frame_range[0]))
        # rotace kolem Z přes empty
        empty.rotation_euler.z = math.radians(ucfg.get("rotateZ", 0))
        bpy.context.view_layer.update()
        mins, maxs = eval_bbox(mesh)
        height = (maxs.z - mins.z) or 1.0
        factor = ucfg["scaleTiles"] / height
        delta = Vector(((mins.x + maxs.x) / 2, (mins.y + maxs.y) / 2, mins.z))
        empty.scale = (factor, factor, factor)
        empty.location = -factor * delta
        bpy.context.view_layer.update()

        # materiály blendu jsou bez uzlů → zapni Principled a nastav barvy z palety + override jednotky
        palette = {"Skin": [0.86, 0.72, 0.56], "Armor": [0.6, 0.62, 0.68], "Boots": [0.3, 0.2, 0.12]}
        colors = {**palette, **ucfg.get("tintMaterials", {})}
        for slot in mesh.material_slots:
            m = slot.material
            if not m:
                continue
            col = next((c for key, c in colors.items() if m.name.startswith(key)), [0.7, 0.7, 0.7])
            m.use_nodes = True
            set_color(m, col)

        anims_out = {}
        for akey, (actname, nframes) in CFG["anims"].items():
            act = actions[actname]
            arm.animation_data.action = act
            fr0, fr1 = act.frame_range
            files = []
            for i in range(nframes):
                f = fr0 if nframes == 1 else fr0 + (fr1 - fr0) * i / nframes
                sc.frame_set(int(round(f)))
                fname = f"{uname}_{akey}_{i}.png"
                sc.render.filepath = os.path.join(OUT_DIR, fname)
                bpy.ops.render.render(write_still=True)
                files.append(fname)
            anims_out[akey] = files

        co = world_to_camera_view(sc, cam, Vector((0, 0, 0)))
        manifest[uname] = {
            "file": anims_out["idle"][0],
            "anchorX": round(co.x, 4),
            "anchorY": round(1.0 - co.y, 4),
            "scale": SPRITE_SCALE,
            "fps": 10,
            "anims": anims_out,
        }
        print(f"[units] {uname}: " + ", ".join(f"{k}={len(v)}" for k, v in anims_out.items()))

    json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), indent=2)
    print(f"[units] hotovo, manifest aktualizován")


main()

"""
Render a deterministic quality audit sheet for mature_senpai GLB assets.

Usage:
  blender --background --python render_quality_audit.py -- input.glb output_dir

The script produces separate PNGs and a compact JSON report for:
- front / left / right / back full-body views
- face close-up
- every exported morph target on the first morph-capable mesh
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


def parse_args() -> tuple[Path, Path]:
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("Usage: blender --background --python render_quality_audit.py -- input.glb output_dir")
    return Path(args[0]), Path(args[1])


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablock in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.armatures,
        bpy.data.actions,
        bpy.data.images,
        bpy.data.collections,
    ):
        for item in list(datablock):
            if item.users == 0:
                datablock.remove(item)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def import_asset(path: Path) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = []
    for obj in [item for item in bpy.context.scene.objects if item.type == "MESH"]:
        is_import_proxy = (
            not obj.name.startswith("MatureSenpai_")
            and len(obj.data.materials) == 0
            and len(obj.modifiers) == 0
        )
        if is_import_proxy:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        meshes.append(obj)
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not meshes:
        raise RuntimeError(f"No meshes imported from {path}")
    for obj in meshes:
        obj.select_set(False)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return meshes, armatures


def bounds_for(objects: list[bpy.types.Object]) -> tuple[Vector, Vector, Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mins = Vector((math.inf, math.inf, math.inf))
    maxs = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        for corner in evaluated.bound_box:
            world = evaluated.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    center = (mins + maxs) * 0.5
    return mins, maxs, center


def setup_render() -> None:
    available_engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in available_engines else "BLENDER_EEVEE"
    if hasattr(bpy.context.scene, "eevee"):
        bpy.context.scene.eevee.taa_render_samples = 96
    bpy.context.scene.render.resolution_x = 960
    bpy.context.scene.render.resolution_y = 1280
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.world.color = (0.03, 0.03, 0.035)

    bpy.ops.object.light_add(type="AREA", location=(0, -3.6, 3.4))
    key = bpy.context.object
    key.name = "Audit_KeyLight"
    key.data.energy = 600
    key.data.size = 4.4

    bpy.ops.object.light_add(type="POINT", location=(-1.8, -2.2, 1.5))
    fill = bpy.context.object
    fill.name = "Audit_WarmFill"
    fill.data.energy = 85
    fill.data.color = (1.0, 0.82, 0.62)


def add_camera(name: str) -> bpy.types.Object:
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = name
    camera.data.lens = 70
    bpy.context.scene.camera = camera
    return camera


def set_all_morphs(meshes: list[bpy.types.Object], value: float = 0.0) -> None:
    for obj in meshes:
        if not obj.data.shape_keys:
            continue
        for key in obj.data.shape_keys.key_blocks:
            if key.name != "Basis":
                key.value = value


def morph_names(meshes: list[bpy.types.Object]) -> list[str]:
    for obj in meshes:
        if obj.data.shape_keys and len(obj.data.shape_keys.key_blocks) > 1:
            return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]
    return []


def set_morph(meshes: list[bpy.types.Object], name: str, value: float) -> None:
    for obj in meshes:
        if not obj.data.shape_keys:
            continue
        key = obj.data.shape_keys.key_blocks.get(name)
        if key:
            key.value = value


def render_view(output: Path, camera: bpy.types.Object, location: tuple[float, float, float], target: Vector) -> None:
    camera.location = location
    look_at(camera, target)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main() -> dict[str, Any]:
    input_glb, output_dir = parse_args()
    output_dir.mkdir(parents=True, exist_ok=True)
    clean_scene()
    meshes, armatures = import_asset(input_glb)
    setup_render()
    camera = add_camera("Audit_Camera")
    mins, maxs, center = bounds_for(meshes)
    height = max(maxs.z - mins.z, 0.001)
    radius = max(maxs.x - mins.x, maxs.y - mins.y, height) * 0.5
    target_body = Vector((center.x, center.y, mins.z + height * 0.52))
    target_face = Vector((center.x, center.y, mins.z + height * 0.84))
    distance = max(radius * 4.3, 3.2)

    renders: list[str] = []
    view_specs = [
        ("front", (center.x, center.y - distance, mins.z + height * 0.56), target_body),
        ("left", (center.x - distance, center.y, mins.z + height * 0.56), target_body),
        ("right", (center.x + distance, center.y, mins.z + height * 0.56), target_body),
        ("back", (center.x, center.y + distance, mins.z + height * 0.56), target_body),
        ("face-closeup", (center.x, center.y - distance * 0.62, mins.z + height * 0.84), target_face),
    ]
    for name, location, target in view_specs:
        set_all_morphs(meshes, 0.0)
        output = output_dir / f"{name}.png"
        render_view(output, camera, location, target)
        renders.append(str(output))

    morphs = morph_names(meshes)
    for name in morphs:
        set_all_morphs(meshes, 0.0)
        set_morph(meshes, name, 1.0)
        output = output_dir / f"morph-{name}.png"
        render_view(output, camera, (center.x, center.y - distance * 0.62, mins.z + height * 0.84), target_face)
        renders.append(str(output))

    report = {
        "input": str(input_glb),
        "outputDir": str(output_dir),
        "meshCount": len(meshes),
        "armatureCount": len(armatures),
        "morphTargets": morphs,
        "bounds": {
            "min": [round(v, 4) for v in mins],
            "max": [round(v, 4) for v in maxs],
            "height": round(height, 4),
        },
        "renders": renders,
    }
    (output_dir / "audit-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

"""
Render deformation stress frames for mature_senpai GLB assets.

Usage:
  blender --background --python render_deformation_audit.py -- input.glb output_dir

The script imports a runtime GLB, applies selected action frames, and renders
full-body QA frames that make shoulder, elbow, leg, hair, and skirt deformation
problems visible.
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
        raise SystemExit("Usage: blender --background --python render_deformation_audit.py -- input.glb output_dir")
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


def import_asset(path: Path) -> tuple[list[bpy.types.Object], bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes: list[bpy.types.Object] = []
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
    if not armatures:
        raise RuntimeError(f"No armature imported from {path}")
    for obj in meshes:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return meshes, armatures[0]


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
    return mins, maxs, (mins + maxs) * 0.5


def setup_render() -> bpy.types.Object:
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
    key.name = "DeformAudit_KeyLight"
    key.data.energy = 620
    key.data.size = 4.2

    bpy.ops.object.light_add(type="POINT", location=(-1.8, -2.0, 1.5))
    fill = bpy.context.object
    fill.name = "DeformAudit_WarmFill"
    fill.data.energy = 90
    fill.data.color = (1.0, 0.82, 0.62)

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "DeformAudit_Camera"
    camera.data.lens = 64
    bpy.context.scene.camera = camera
    return camera


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def find_action(prefix: str) -> bpy.types.Action | None:
    return next((action for action in bpy.data.actions if action.name.startswith(prefix)), None)


def apply_action_frame(armature: bpy.types.Object, action_prefix: str | None, frame: int) -> str:
    if armature.animation_data:
        for track in armature.animation_data.nla_tracks:
            track.mute = True
    if action_prefix is None:
        armature.animation_data.action = None if armature.animation_data else None
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        return "bind-pose"
    action = find_action(action_prefix)
    if action is None:
        raise RuntimeError(f"No action found with prefix {action_prefix}")
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return action.name


def render_frame(
    output: Path,
    camera: bpy.types.Object,
    meshes: list[bpy.types.Object],
    armature: bpy.types.Object,
    action_prefix: str | None,
    frame: int,
) -> dict[str, Any]:
    action_name = apply_action_frame(armature, action_prefix, frame)
    mins, maxs, center = bounds_for(meshes)
    height = max(maxs.z - mins.z, 0.001)
    radius = max(maxs.x - mins.x, maxs.y - mins.y, height) * 0.5
    target = Vector((center.x, center.y, mins.z + height * 0.54))
    distance = max(radius * 4.1, 2.6)
    camera.location = (center.x, center.y - distance, mins.z + height * 0.58)
    look_at(camera, target)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return {
        "output": str(output),
        "action": action_name,
        "frame": frame,
        "bounds": {
            "min": [round(v, 4) for v in mins],
            "max": [round(v, 4) for v in maxs],
            "height": round(height, 4),
        },
    }


def main() -> dict[str, Any]:
    input_glb, output_dir = parse_args()
    output_dir.mkdir(parents=True, exist_ok=True)
    clean_scene()
    meshes, armature = import_asset(input_glb)
    camera = setup_render()
    specs = [
        ("bind-pose", None, 1),
        ("deformation-stress-arms", "v17_deformation_stress", 18),
        ("deformation-stress-legs", "v17_deformation_stress", 38),
        ("secondary-sway-left", "v17_secondary_sway_test", 16),
        ("secondary-sway-right", "v17_secondary_sway_test", 32),
    ]
    renders = [
        render_frame(output_dir / f"{name}.png", camera, meshes, armature, action_prefix, frame)
        for name, action_prefix, frame in specs
    ]
    report = {
        "input": str(input_glb),
        "outputDir": str(output_dir),
        "meshCount": len(meshes),
        "actions": [action.name for action in bpy.data.actions],
        "renders": renders,
    }
    (output_dir / "deformation-audit-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

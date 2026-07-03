#!/usr/bin/env python3
"""Export a production Blender source character to runtime GLB and preview PNG."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


def blender_args() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a source .blend character to game GLB.")
    parser.add_argument("--character", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--preview", required=True)
    parser.add_argument("--audit", required=True)
    return parser.parse_args(blender_args())


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def armature_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]


def scene_bounds() -> tuple[Vector, Vector]:
    mins = Vector((10**9, 10**9, 10**9))
    maxs = Vector((-10**9, -10**9, -10**9))
    found = False
    for obj in mesh_objects():
        found = True
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    if not found:
        return Vector((-0.5, -0.5, 0)), Vector((0.5, 0.5, 1.7))
    return mins, maxs


def triangle_count() -> int:
    total = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in mesh_objects():
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        if mesh:
            total += sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)
            evaluated.to_mesh_clear()
    return total


def collect_audit(character_id: str) -> dict[str, Any]:
    actions = sorted(action.name for action in bpy.data.actions)
    morph_meshes = [
        obj.name
        for obj in mesh_objects()
        if obj.data.shape_keys and len(obj.data.shape_keys.key_blocks) > 1
    ]
    armatures = armature_objects()
    max_bones = max((len(obj.data.bones) for obj in armatures), default=0)
    return {
        "characterId": character_id,
        "meshes": len(mesh_objects()),
        "materials": len(bpy.data.materials),
        "armatures": len(armatures),
        "maxBones": max_bones,
        "actions": actions,
        "morphMeshes": morph_meshes,
        "estimatedTriangles": triangle_count(),
    }


def setup_render(width: int = 768, height: int = 1024) -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.film_transparent = False
    scene.world = scene.world or bpy.data.worlds.new("CharacterPreviewWorld")
    scene.world.color = (0.055, 0.058, 0.07)
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(output_path: Path) -> None:
    setup_render()
    mins, maxs = scene_bounds()
    center = (mins + maxs) * 0.5
    height = max(0.1, maxs.z - mins.z)
    radius = max(maxs.x - mins.x, maxs.y - mins.y, height)

    bpy.ops.object.light_add(type="AREA", location=(center.x - 1.8, center.y - 3.0, center.z + height * 1.35))
    key = bpy.context.object
    key.name = "SourcePreview_KeyLight"
    key.data.energy = 720
    key.data.size = 4.2

    bpy.ops.object.light_add(type="POINT", location=(center.x + 1.4, center.y - 1.2, center.z + height * 0.72))
    fill = bpy.context.object
    fill.name = "SourcePreview_FillLight"
    fill.data.energy = 110

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "SourcePreview_Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = radius * 1.24
    camera.location = (center.x + radius * 0.55, center.y - radius * 2.0, center.z + height * 0.16)
    look_at(camera, Vector((center.x, center.y, center.z + height * 0.04)))
    bpy.context.scene.camera = camera

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


def export_glb(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = {
        "filepath": str(output_path),
        "export_format": "GLB",
        "export_yup": True,
        "export_animations": True,
        "export_skins": True,
        "export_morph": True,
        "export_apply": False,
    }
    bpy.ops.export_scene.gltf(**kwargs)


def main() -> None:
    args = parse_args()
    source_path = Path(args.source)
    output_path = Path(args.out)
    preview_path = Path(args.preview)
    audit_path = Path(args.audit)

    if not source_path.exists():
        raise SystemExit(f"Missing source .blend: {source_path}")

    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    audit = collect_audit(args.character)
    if audit["meshes"] == 0:
        raise SystemExit("Source scene has no mesh objects")
    if audit["armatures"] == 0:
        print("[source-character-export] warning: source scene has no armature")

    export_glb(output_path)
    render_preview(preview_path)

    audit["source"] = str(source_path)
    audit["output"] = str(output_path)
    audit["preview"] = str(preview_path)
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(f"[source-character-export] exported {output_path}")
    print(f"[source-character-export] rendered {preview_path}")
    print(f"[source-character-export] wrote {audit_path}")


if __name__ == "__main__":
    main()

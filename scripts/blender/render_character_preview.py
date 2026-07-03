#!/usr/bin/env python3
"""Render a GLB character preview image with Blender headless."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]


def blender_args() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render character GLB preview PNGs.")
    parser.add_argument("inputs", nargs="+", help="GLB files to render.")
    parser.add_argument("--out-dir", default=None, help="Output directory. Defaults to each input directory.")
    parser.add_argument("--width", type=int, default=768)
    parser.add_argument("--height", type=int, default=1024)
    return parser.parse_args(blender_args())


def repo_path(value: str | Path) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (REPO_ROOT / path).resolve()


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions, bpy.data.collections):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def scene_bounds() -> tuple[Vector, Vector]:
    mins = Vector((10**9, 10**9, 10**9))
    maxs = Vector((-10**9, -10**9, -10**9))
    found = False
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
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


def orient_y_up_import_for_preview() -> None:
    mins, maxs = scene_bounds()
    extents = maxs - mins
    if extents.y <= extents.z * 1.25:
        return

    wrapper = bpy.data.objects.new("Preview_YUpToZUp", None)
    wrapper.empty_display_type = "PLAIN_AXES"
    wrapper.empty_display_size = 0.25
    bpy.context.scene.collection.objects.link(wrapper)

    roots = [
        obj
        for obj in bpy.context.scene.objects
        if obj.parent is None and obj.name != wrapper.name and obj.type not in {"CAMERA", "LIGHT"}
    ]
    for obj in roots:
        world = obj.matrix_world.copy()
        obj.parent = wrapper
        obj.matrix_world = world

    wrapper.rotation_euler[0] = math.radians(90)
    bpy.context.view_layer.update()


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_render(width: int, height: int) -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("PreviewWorld") if not scene.world else scene.world
    scene.world.color = (0.055, 0.06, 0.075)
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1


def render_preview(input_path: Path, output_path: Path, width: int, height: int) -> None:
    clear_scene()
    setup_render(width, height)
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    bpy.context.view_layer.update()
    orient_y_up_import_for_preview()

    mins, maxs = scene_bounds()
    center = (mins + maxs) * 0.5
    height_m = max(0.1, maxs.z - mins.z)
    radius = max(maxs.x - mins.x, maxs.y - mins.y, height_m)

    bpy.ops.object.light_add(type="AREA", location=(center.x - 1.8, center.y - 3.2, center.z + height_m * 1.4))
    key = bpy.context.object
    key.name = "Preview_KeyLight"
    key.data.energy = 650
    key.data.size = 4.0

    bpy.ops.object.light_add(type="POINT", location=(center.x + 1.6, center.y - 1.4, center.z + height_m * 0.8))
    fill = bpy.context.object
    fill.name = "Preview_FillLight"
    fill.data.energy = 95

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = radius * 1.28
    camera.location = (center.x + radius * 0.58, center.y - radius * 2.05, center.z + height_m * 0.18)
    look_at(camera, Vector((center.x, center.y, center.z + height_m * 0.04)))
    bpy.context.scene.camera = camera

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    print(f"[character-preview] rendered {output_path}")


def main() -> None:
    args = parse_args()
    out_dir = repo_path(args.out_dir) if args.out_dir else None
    for raw in args.inputs:
        input_path = repo_path(raw)
        if not input_path.exists():
            raise SystemExit(f"Missing GLB: {input_path}")
        output_path = (out_dir or input_path.parent) / f"{input_path.stem}.png"
        render_preview(input_path, output_path, args.width, args.height)


if __name__ == "__main__":
    main()

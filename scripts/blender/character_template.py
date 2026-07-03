#!/usr/bin/env python3
"""
Headless Blender character template generator.

Run with:
  blender --background --python scripts/blender/character_template.py -- \
    --config scripts/blender/character_template_specs.json

The generated GLB is intentionally a reusable anime RPG character template:
- humanoid armature with stable bone names
- modular face, hair, outfit, accessories, and held items
- NLA animation clips for idle, walk, and talk
- toon-friendly materials with simple color palettes
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable

import bpy
from mathutils import Euler, Vector


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_CONFIG = SCRIPT_DIR / "character_template_specs.json"


def blender_args() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate reusable anime RPG GLB character templates.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to character_template_specs.json.")
    parser.add_argument("--out-dir", default=None, help="Override output directory.")
    parser.add_argument("--character", default="all", help="Character id to export, or all.")
    parser.add_argument("--blend", action="store_true", help="Also save a .blend source file next to each GLB.")
    return parser.parse_args(blender_args())


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def repo_path(value: str | Path) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (REPO_ROOT / path).resolve()


def hex_to_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        raise ValueError(f"Expected #rrggbb color, got {value!r}")
    return (
        int(raw[0:2], 16) / 255.0,
        int(raw[2:4], 16) / 255.0,
        int(raw[4:6], 16) / 255.0,
        alpha,
    )


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    for action in list(bpy.data.actions):
        action.use_fake_user = False
        bpy.data.actions.remove(action)

    for block in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.armatures,
        bpy.data.collections,
    ):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def create_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def link_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    if obj.name not in collection.objects.keys():
        collection.objects.link(obj)
    for existing in list(obj.users_collection):
        if existing != collection:
            existing.objects.unlink(obj)


def create_root(name: str, collection: bpy.types.Collection) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.25
    collection.objects.link(root)
    return root


def material(
    name: str,
    color: str,
    roughness: float = 0.68,
    metallic: float = 0.0,
    alpha: float = 1.0,
    backface_culling: bool = True,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = hex_to_rgba(color, alpha)
    mat.use_backface_culling = backface_culling
    if alpha < 1:
        mat.blend_method = "BLEND"
        mat.show_transparent_back = False

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = hex_to_rgba(color, alpha)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if emission_strength > 0 and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = hex_to_rgba(color, alpha)
        if emission_strength > 0 and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def shade_smooth(obj: bpy.types.Object) -> bpy.types.Object:
    mesh = getattr(obj, "data", None)
    if mesh and hasattr(mesh, "polygons"):
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def apply_object_scale(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def add_modifier_if_possible(obj: bpy.types.Object, name: str, modifier_type: str, **values: Any) -> None:
    try:
        modifier = obj.modifiers.new(name=name, type=modifier_type)
        for key, value in values.items():
            setattr(modifier, key, value)
    except Exception:
        pass


def parent_keep_world(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def bind_object_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    mesh = getattr(obj, "data", None)
    if not mesh or not hasattr(mesh, "vertices"):
        parent_keep_world(obj, armature)
        return

    group = obj.vertex_groups.new(name=bone_name)
    indices = [vertex.index for vertex in mesh.vertices]
    if indices:
        group.add(indices, 1.0, "ADD")

    modifier = obj.modifiers.new(name="CharacterArmature", type="ARMATURE")
    modifier.object = armature

    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.matrix_world = world


def parent_to_bone(obj: bpy.types.Object, armature: Any, bone_name: str) -> None:
    if isinstance(armature, dict):
        parent_keep_world(obj, armature["controls"][bone_name])
        return

    bind_object_to_bone(obj, armature, bone_name)


def add_shape_key_transform(
    obj: bpy.types.Object,
    name: str,
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    offset: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> None:
    mesh = getattr(obj, "data", None)
    if not mesh or not hasattr(mesh, "vertices"):
        return

    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name=name)
    basis = obj.data.shape_keys.key_blocks["Basis"]
    delta = Vector(offset)
    for index, point in enumerate(key.data):
        base = basis.data[index].co
        point.co = Vector((base.x * scale[0], base.y * scale[1], base.z * scale[2])) + delta


def add_uv_sphere(
    name: str,
    mat: bpy.types.Material,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    collection: bpy.types.Collection,
    segments: int = 32,
    rings: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    apply_object_scale(obj)
    shade_smooth(obj)
    link_to_collection(obj, collection)
    return obj


def add_cube(
    name: str,
    mat: bpy.types.Material,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_object_scale(obj)
    obj.data.materials.append(mat)
    if bevel > 0:
        add_modifier_if_possible(obj, "soft bevel", "BEVEL", width=bevel, segments=3)
    link_to_collection(obj, collection)
    return obj


def add_cylinder(
    name: str,
    mat: bpy.types.Material,
    loc: tuple[float, float, float],
    radius: float,
    depth: float,
    collection: bpy.types.Collection,
    vertices: int = 24,
    rotation: tuple[float, float, float] = (0, 0, 0),
    scale: tuple[float, float, float] = (1, 1, 1),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_object_scale(obj)
    obj.data.materials.append(mat)
    shade_smooth(obj)
    link_to_collection(obj, collection)
    return obj


def add_cone(
    name: str,
    mat: bpy.types.Material,
    loc: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    collection: bpy.types.Collection,
    vertices: int = 32,
    rotation: tuple[float, float, float] = (0, 0, 0),
    scale: tuple[float, float, float] = (1, 1, 1),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_object_scale(obj)
    obj.data.materials.append(mat)
    shade_smooth(obj)
    link_to_collection(obj, collection)
    return obj


def add_plane_mesh(
    name: str,
    mat: bpy.types.Material,
    verts: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    collection.objects.link(obj)
    return obj


def add_hair_panel(
    name: str,
    mat: bpy.types.Material,
    verts: list[tuple[float, float, float]],
    collection: bpy.types.Collection,
    thickness: float,
) -> bpy.types.Object:
    obj = add_plane_mesh(name, mat, verts, [(0, 1, 2, 3)] if len(verts) == 4 else [(0, 1, 2)], collection)
    add_modifier_if_possible(obj, "panel thickness", "SOLIDIFY", thickness=thickness)
    return obj


def make_armature(character_id: str, collection: bpy.types.Collection, root: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    armature = bpy.context.object
    armature.name = f"{character_id}_HumanoidArmature"
    armature.data.name = f"{character_id}_HumanoidSkeleton"
    armature.show_in_front = False
    link_to_collection(armature, collection)

    bones = armature.data.edit_bones
    for bone in list(bones):
        bones.remove(bone)

    def add_bone(
        name: str,
        head: tuple[float, float, float],
        tail: tuple[float, float, float],
        parent_name: str | None = None,
    ) -> None:
        bone = bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.roll = 0
        if parent_name:
            bone.parent = bones[parent_name]
            bone.use_connect = False

    add_bone("Hips", (0, 0, 0.78), (0, 0, 0.98))
    add_bone("Spine", (0, 0, 0.96), (0, 0, 1.16), "Hips")
    add_bone("Chest", (0, 0, 1.14), (0, 0, 1.34), "Spine")
    add_bone("Neck", (0, 0, 1.32), (0, 0, 1.43), "Chest")
    add_bone("Head", (0, 0, 1.40), (0, 0, 1.70), "Neck")

    for side in ("Left", "Right"):
        sx = -1 if side == "Left" else 1
        add_bone(f"{side}UpperArm", (sx * 0.19, 0, 1.27), (sx * 0.34, 0, 1.02), "Chest")
        add_bone(f"{side}LowerArm", (sx * 0.34, 0, 1.02), (sx * 0.42, 0, 0.74), f"{side}UpperArm")
        add_bone(f"{side}Hand", (sx * 0.42, 0, 0.74), (sx * 0.45, -0.02, 0.62), f"{side}LowerArm")
        add_bone(f"{side}UpperLeg", (sx * 0.10, 0, 0.78), (sx * 0.10, 0, 0.43), "Hips")
        add_bone(f"{side}LowerLeg", (sx * 0.10, 0, 0.43), (sx * 0.09, 0, 0.12), f"{side}UpperLeg")
        add_bone(f"{side}Foot", (sx * 0.09, 0, 0.12), (sx * 0.09, -0.16, 0.04), f"{side}LowerLeg")

    bpy.ops.object.mode_set(mode="OBJECT")
    parent_keep_world(armature, root)
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    return armature


def build_character(spec: dict[str, Any], out_dir: Path, save_blend: bool) -> Path:
    clear_scene()
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.frame_start = 1
    scene.frame_end = 60
    scene.render.fps = 30

    character_id = spec["id"]
    collection = create_collection(f"{character_id}_character_template")
    root = create_root(f"{character_id}_Root", collection)
    armature = make_armature(character_id, collection, root)

    mats = make_materials(spec)
    metrics = make_metrics(spec)

    add_body(spec, metrics, mats, armature, collection)
    add_head(spec, metrics, mats, armature, collection)
    add_hair(spec, metrics, mats, armature, collection)
    add_outfit(spec, metrics, mats, armature, collection)
    add_accessories(spec, metrics, mats, armature, collection)
    add_template_helpers(spec, metrics, mats, armature, collection)
    make_actions(armature, spec)

    fit_root_to_height(root, collection, spec["heightMeters"])
    tag_scene(root, armature, spec)
    add_camera_and_light(spec)

    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / f"{character_id}.blender-template.glb"
    export_glb(output)

    if save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(out_dir / f"{character_id}.blender-template.blend"))

    print(f"[character-template] exported {output}")
    return output


def make_materials(spec: dict[str, Any]) -> dict[str, bpy.types.Material]:
    outfit = spec["outfit"]
    face = spec["face"]
    hair = spec["hair"]
    return {
        "skin": material("Skin", "#ffe3d4", 0.58, emission_strength=0.08),
        "skin_warm": material("SkinWarm", "#ffc3ae", 0.62, emission_strength=0.06),
        "skin_shadow": material("SkinSoftShadow", "#f0ad99", 0.68),
        "cheek": material("CheekTint", face["cheekTint"], 0.82, alpha=0.82, backface_culling=False),
        "eye_white": material("EyeWhite", "#fffaff", 0.44, backface_culling=False, emission_strength=0.1),
        "eye": material("EyeIris", face["eyeColor"], 0.32, backface_culling=False, emission_strength=0.08),
        "pupil": material("Pupil", "#14111c", 0.52, backface_culling=False),
        "brow": material("Brow", face["browColor"], 0.6, backface_culling=False),
        "hair": material("Hair", hair["color"], 0.52, backface_culling=False, emission_strength=0.04),
        "hair_highlight": material("HairHighlight", hair["highlightColor"], 0.48, backface_culling=False, emission_strength=0.06),
        "outfit_primary": material("OutfitPrimary", outfit["primaryColor"], 0.64),
        "outfit_secondary": material("OutfitSecondary", outfit["secondaryColor"], 0.7),
        "outfit_dark": material("OutfitDark", outfit["darkColor"], 0.68),
        "accent": material("Accent", outfit["accentColor"], 0.62),
        "trim": material("GoldTrim", outfit["trimColor"], 0.34, metallic=0.25),
        "shoe": material("Shoe", outfit["shoeColor"], 0.58),
        "sole": material("Sole", "#18141d", 0.64),
        "outline": material("SoftInk", "#17131f", 0.8, backface_culling=False),
        "paper": material("BookPaper", "#f7efd7", 0.76),
    }


def make_metrics(spec: dict[str, Any]) -> dict[str, float]:
    height = float(spec["heightMeters"])
    scale = height / 1.68
    body = spec["body"]
    return {
        "height": height,
        "scale": scale,
        "hip_z": 0.82 * scale,
        "chest_z": 1.18 * scale,
        "shoulder_z": 1.29 * scale,
        "neck_z": 1.38 * scale,
        "head_z": 1.52 * scale,
        "head_radius": 0.178 * scale,
        "shoulder_width": float(body["shoulderWidth"]) * scale,
        "hip_width": float(body["hipWidth"]) * scale,
        "waist_width": float(body["waistWidth"]) * scale,
        "arm_len": float(body["armLength"]) * scale,
        "leg_len": float(body["legLength"]) * scale,
    }


def add_body(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    is_player = spec["id"] == "player"
    outfit_style = spec["outfit"].get("style")
    is_astrologer = outfit_style == "astrologer-uniform"
    scale = m["scale"]
    jacket_mat = mats["outfit_dark"] if is_player or is_astrologer else mats["outfit_primary"]
    shirt_mat = mats["outfit_secondary"] if is_player else mats["outfit_primary"]
    torso_x = m["waist_width"] * (0.53 if is_player else 0.44 if is_astrologer else 0.48)
    chest_x = m["shoulder_width"] * (0.47 if is_player else 0.40 if is_astrologer else 0.43)
    shirt_x = m["waist_width"] * (0.30 if is_player else 0.16 if is_astrologer else 0.34)

    pelvis = add_uv_sphere(
        "Pelvis",
        mats["outfit_dark"] if is_player else mats["outfit_secondary"],
        (0, 0.01 * scale, m["hip_z"]),
        (m["hip_width"] * (0.40 if is_player else 0.32), (0.105 if is_player else 0.088) * scale, 0.078 * scale),
        collection,
        segments=32,
        rings=14,
    )
    parent_to_bone(pelvis, armature, "Hips")

    torso = add_uv_sphere(
        "Torso",
        jacket_mat,
        (0, -0.005 * scale, 1.12 * scale),
        (torso_x, (0.105 if is_player else 0.092) * scale, 0.255 * scale),
        collection,
        segments=40,
        rings=18,
    )
    parent_to_bone(torso, armature, "Spine")

    chest = add_uv_sphere(
        "ChestShape",
        jacket_mat,
        (0, -0.005 * scale, 1.24 * scale),
        (chest_x, (0.115 if is_player else 0.098) * scale, 0.19 * scale),
        collection,
        segments=40,
        rings=18,
    )
    parent_to_bone(chest, armature, "Chest")

    shirt = add_cube(
        "ShirtFront",
        shirt_mat,
        (0, -0.21 * scale, 1.18 * scale),
        (shirt_x, 0.014 * scale, 0.25 * scale),
        collection,
        bevel=0.006 * scale,
    )
    parent_to_bone(shirt, armature, "Chest")

    for side, sx in (("Left", -1), ("Right", 1)):
        lapel = add_cube(
            f"{side}JacketPanel",
            mats["outfit_primary"] if is_player else mats["outfit_secondary"],
            (sx * (0.105 if is_player else 0.078) * scale, -0.222 * scale, 1.17 * scale),
            ((0.052 if is_player else 0.038) * scale, 0.012 * scale, 0.255 * scale),
            collection,
            rotation=(0, 0, sx * 0.10),
            bevel=0.006 * scale,
        )
        parent_to_bone(lapel, armature, "Chest")

        trim = add_cube(
            f"{side}JacketTrim",
            mats["trim"],
            (sx * (0.18 if is_player else 0.13) * scale, -0.236 * scale, 1.17 * scale),
            (0.006 * scale, 0.008 * scale, 0.28 * scale),
            collection,
            rotation=(0, 0, sx * 0.20),
            bevel=0.002 * scale,
        )
        parent_to_bone(trim, armature, "Chest")

        front_edge = add_cube(
            f"{side}FrontGoldEdge",
            mats["trim"],
            (sx * (0.055 if is_player else 0.041) * scale, -0.238 * scale, 1.18 * scale),
            (0.005 * scale, 0.006 * scale, 0.24 * scale),
            collection,
            rotation=(0, 0, sx * 0.03),
            bevel=0.0015 * scale,
        )
        parent_to_bone(front_edge, armature, "Chest")

    if is_astrologer:
        for index, z in enumerate((1.285, 1.215, 1.145, 1.075)):
            button = add_uv_sphere(
                f"AstrologerBodiceButton_{index}",
                mats["trim"],
                (0, -0.236 * scale, z * scale),
                (0.008 * scale, 0.003 * scale, 0.008 * scale),
                collection,
                10,
                6,
            )
            parent_to_bone(button, armature, "Chest")

    neck = add_cylinder("Neck", mats["skin"], (0, -0.005 * scale, m["neck_z"]), 0.055 * scale, 0.1 * scale, collection, vertices=24)
    parent_to_bone(neck, armature, "Neck")

    add_limbs(spec, m, mats, armature, collection)


def add_limbs(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    shoulder = m["shoulder_width"]
    is_player = spec["id"] == "player"
    sleeve_mat = mats["outfit_primary"] if is_player else mats["outfit_primary"]
    glove_mat = mats["shoe"] if is_player else mats["skin"]
    leg_mat = mats["outfit_dark"] if is_player else mats["skin"]
    upper_arm_radius = 0.044 if is_player else 0.032
    lower_arm_radius = 0.037 if is_player else 0.028
    upper_leg_radius = 0.049 if is_player else 0.037
    lower_leg_radius = 0.041 if is_player else 0.031
    arm_reach = 0.63 if is_player else 0.56
    forearm_reach = 0.76 if is_player else 0.66

    for side, sx in (("Left", -1), ("Right", 1)):
        upper_arm = add_uv_sphere(
            f"{side}UpperArm",
            sleeve_mat,
            (sx * (shoulder * arm_reach), -0.006 * scale, 1.105 * scale),
            (upper_arm_radius * scale, upper_arm_radius * scale, 0.19 * scale),
            collection,
            segments=24,
            rings=12,
        )
        upper_arm.rotation_euler[1] = sx * 0.2
        parent_to_bone(upper_arm, armature, f"{side}UpperArm")

        lower_arm = add_uv_sphere(
            f"{side}LowerArm",
            sleeve_mat,
            (sx * (shoulder * forearm_reach), -0.006 * scale, 0.87 * scale),
            (lower_arm_radius * scale, lower_arm_radius * scale, 0.178 * scale),
            collection,
            segments=24,
            rings=12,
        )
        lower_arm.rotation_euler[1] = sx * 0.12
        parent_to_bone(lower_arm, armature, f"{side}LowerArm")

        cuff = add_cylinder(
            f"{side}Cuff",
            mats["trim"] if is_player else mats["accent"],
            (sx * (shoulder * (0.83 if is_player else 0.71)), -0.006 * scale, 0.74 * scale),
            (0.052 if is_player else 0.038) * scale,
            (0.035 if is_player else 0.026) * scale,
            collection,
            vertices=18,
            rotation=(math.pi / 2, 0, 0),
            scale=(0.82, 0.58, 1),
        )
        parent_to_bone(cuff, armature, f"{side}LowerArm")

        hand = add_uv_sphere(
            f"{side}Hand",
            glove_mat,
            (sx * (shoulder * (0.84 if is_player else 0.72)), -0.016 * scale, 0.675 * scale),
            ((0.038 if is_player else 0.03) * scale, 0.024 * scale, (0.045 if is_player else 0.037) * scale),
            collection,
            segments=20,
            rings=10,
        )
        parent_to_bone(hand, armature, f"{side}Hand")

        thigh = add_uv_sphere(
            f"{side}UpperLeg",
            leg_mat,
            (sx * 0.095 * scale, 0, 0.55 * scale),
            (upper_leg_radius * scale, (upper_leg_radius * 0.94) * scale, 0.25 * scale),
            collection,
            segments=24,
            rings=12,
        )
        parent_to_bone(thigh, armature, f"{side}UpperLeg")

        lower_leg = add_uv_sphere(
            f"{side}LowerLeg",
            leg_mat,
            (sx * 0.09 * scale, 0, 0.28 * scale),
            (lower_leg_radius * scale, (lower_leg_radius * 0.94) * scale, 0.225 * scale),
            collection,
            segments=24,
            rings=12,
        )
        parent_to_bone(lower_leg, armature, f"{side}LowerLeg")

        if is_player:
            trouser_trim = add_cylinder(
                f"{side}TrouserGoldHem",
                mats["trim"],
                (sx * 0.09 * scale, -0.002 * scale, 0.13 * scale),
                0.044 * scale,
                0.018 * scale,
                collection,
                vertices=18,
                rotation=(math.pi / 2, 0, 0),
                scale=(0.82, 0.62, 1),
            )
            parent_to_bone(trouser_trim, armature, f"{side}LowerLeg")
        else:
            boot_cuff = add_cylinder(
                f"{side}BootPurpleCuff",
                mats["outfit_secondary"],
                (sx * 0.09 * scale, -0.002 * scale, 0.18 * scale),
                0.036 * scale,
                0.03 * scale,
                collection,
                vertices=18,
                rotation=(math.pi / 2, 0, 0),
                scale=(0.9, 0.64, 1),
            )
            parent_to_bone(boot_cuff, armature, f"{side}LowerLeg")

        boot = add_cube(
            f"{side}Boot",
            mats["shoe"],
            (sx * 0.09 * scale, -0.048 * scale, 0.055 * scale),
            ((0.055 if is_player else 0.043) * scale, (0.118 if is_player else 0.098) * scale, 0.038 * scale),
            collection,
            bevel=0.012 * scale,
        )
        parent_to_bone(boot, armature, f"{side}Foot")

        sole = add_cube(
            f"{side}BootSole",
            mats["sole"],
            (sx * 0.09 * scale, -0.05 * scale, 0.024 * scale),
            ((0.058 if is_player else 0.046) * scale, (0.125 if is_player else 0.104) * scale, 0.011 * scale),
            collection,
            bevel=0.006 * scale,
        )
        parent_to_bone(sole, armature, f"{side}Foot")


def add_head(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    head_scale = spec["body"]["headScale"]
    head = add_uv_sphere(
        "Face",
        mats["skin"],
        (0, -0.018 * scale, m["head_z"]),
        (
            m["head_radius"] * 0.90 * float(head_scale[0]),
            m["head_radius"] * 0.70 * float(head_scale[2]),
            m["head_radius"] * 1.02 * float(head_scale[1]),
        ),
        collection,
        segments=64,
        rings=32,
    )
    parent_to_bone(head, armature, "Head")

    nose = add_uv_sphere("Nose", mats["skin_warm"], (0, -0.196 * scale, 1.51 * scale), (0.009 * scale, 0.007 * scale, 0.019 * scale), collection, 16, 8)
    parent_to_bone(nose, armature, "Head")

    mouth = add_cube("Mouth", mats["pupil"], (0.004 * scale, -0.205 * scale, 1.448 * scale), (0.026 * scale, 0.0025 * scale, 0.004 * scale), collection, rotation=(0, 0, 0.03), bevel=0.0015 * scale)
    add_shape_key_transform(mouth, "smile", scale=(1.28, 1.0, 1.12), offset=(0, -0.001 * scale, 0.006 * scale))
    add_shape_key_transform(mouth, "concerned", scale=(0.92, 1.0, 0.82), offset=(0, -0.001 * scale, -0.004 * scale))
    add_shape_key_transform(mouth, "surprised", scale=(0.64, 1.0, 2.2), offset=(0, -0.002 * scale, 0))
    parent_to_bone(mouth, armature, "Head")

    eye_scale = float(spec["face"]["eyeScale"])
    for side, sx in (("Left", -1), ("Right", 1)):
        eye_x = sx * 0.058 * scale
        eye_white = add_uv_sphere(
            f"{side}EyeWhite",
            mats["eye_white"],
            (eye_x, -0.214 * scale, 1.546 * scale),
            (0.035 * scale * eye_scale, 0.0055 * scale, 0.024 * scale * eye_scale),
            collection,
            segments=36,
            rings=12,
        )
        add_shape_key_transform(eye_white, "blink", scale=(1.0, 1.0, 0.16), offset=(0, 0, -0.002 * scale))
        parent_to_bone(eye_white, armature, "Head")

        iris = add_uv_sphere(
            f"{side}Iris",
            mats["eye"],
            (eye_x + sx * 0.003 * scale, -0.216 * scale, 1.542 * scale),
            (0.016 * scale * eye_scale, 0.0035 * scale, 0.019 * scale * eye_scale),
            collection,
            segments=32,
            rings=10,
        )
        add_shape_key_transform(iris, "blink", scale=(1.0, 1.0, 0.12), offset=(0, 0, -0.002 * scale))
        parent_to_bone(iris, armature, "Head")

        pupil = add_uv_sphere(
            f"{side}Pupil",
            mats["pupil"],
            (eye_x + sx * 0.004 * scale, -0.218 * scale, 1.54 * scale),
            (0.007 * scale, 0.0022 * scale, 0.011 * scale),
            collection,
            segments=24,
            rings=8,
        )
        add_shape_key_transform(pupil, "blink", scale=(1.0, 1.0, 0.1), offset=(0, 0, -0.002 * scale))
        parent_to_bone(pupil, armature, "Head")

        highlight = add_uv_sphere(
            f"{side}EyeHighlight",
            mats["eye_white"],
            (eye_x - sx * 0.010 * scale, -0.22 * scale, 1.558 * scale),
            (0.0052 * scale, 0.0018 * scale, 0.0068 * scale),
            collection,
            segments=18,
            rings=6,
        )
        add_shape_key_transform(highlight, "blink", scale=(1.0, 1.0, 0.1), offset=(0, 0, -0.001 * scale))
        parent_to_bone(highlight, armature, "Head")

        lash = add_cube(
            f"{side}UpperEyelash",
            mats["outline"],
            (eye_x, -0.221 * scale, 1.57 * scale),
            (0.044 * scale * eye_scale, 0.0025 * scale, 0.0032 * scale),
            collection,
            rotation=(0, 0, sx * 0.075),
            bevel=0.001 * scale,
        )
        parent_to_bone(lash, armature, "Head")

        lower_lash = add_cube(
            f"{side}LowerEyelash",
            mats["outline"],
            (eye_x + sx * 0.002 * scale, -0.221 * scale, 1.523 * scale),
            (0.026 * scale * eye_scale, 0.002 * scale, 0.0022 * scale),
            collection,
            rotation=(0, 0, -sx * 0.055),
            bevel=0.001 * scale,
        )
        parent_to_bone(lower_lash, armature, "Head")

        brow = add_cube(
            f"{side}Brow",
            mats["brow"],
            (eye_x, -0.208 * scale, 1.607 * scale),
            (0.04 * scale, 0.003 * scale, 0.0042 * scale),
            collection,
            rotation=(0, 0, sx * 0.12),
            bevel=0.0015 * scale,
        )
        parent_to_bone(brow, armature, "Head")

        cheek = add_uv_sphere(
            f"{side}CheekTint",
            mats["cheek"],
            (sx * 0.115 * scale, -0.207 * scale, 1.485 * scale),
            (0.034 * scale, 0.004 * scale, 0.014 * scale),
            collection,
            segments=16,
            rings=8,
        )
        parent_to_bone(cheek, armature, "Head")


def add_hair(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    volume = float(spec["hair"]["volume"])
    cap = add_uv_sphere(
        "HairCap",
        mats["hair"],
        (0, 0.025 * scale, 1.655 * scale),
        (0.168 * scale * volume, 0.09 * scale * volume, 0.074 * scale),
        collection,
        segments=64,
        rings=24,
    )
    parent_to_bone(cap, armature, "Head")

    back = add_uv_sphere(
        "BackHairMass",
        mats["hair"],
        (0, 0.115 * scale, 1.475 * scale),
        (0.158 * scale * volume, 0.072 * scale, 0.19 * scale),
        collection,
        segments=56,
        rings=20,
    )
    parent_to_bone(back, armature, "Head")

    if spec["hair"]["length"] == "long":
        add_long_hair(m, mats, armature, collection)
    else:
        add_short_hair(m, mats, armature, collection)


def add_short_hair(
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    bangs = [
        ("FrontHairLock_Left", mats["hair"], [(-0.17, -0.205, 1.67), (-0.055, -0.218, 1.69), (-0.105, -0.232, 1.50)]),
        ("FrontHairLock_Center", mats["hair_highlight"], [(-0.065, -0.222, 1.695), (0.056, -0.226, 1.695), (0.0, -0.238, 1.49)]),
        ("FrontHairLock_Right", mats["hair"], [(0.045, -0.222, 1.685), (0.17, -0.205, 1.65), (0.115, -0.232, 1.50)]),
        ("SideSweptBang", mats["hair_highlight"], [(-0.025, -0.236, 1.69), (0.19, -0.218, 1.625), (0.045, -0.244, 1.515)]),
        ("LongAsymmetricBang", mats["hair"], [(0.02, -0.24, 1.66), (0.16, -0.228, 1.60), (0.065, -0.246, 1.43)]),
        ("LeftTempleLock", mats["hair"], [(-0.18, -0.175, 1.60), (-0.13, -0.218, 1.55), (-0.15, -0.205, 1.40), (-0.205, -0.12, 1.42)]),
        ("RightTempleLock", mats["hair"], [(0.13, -0.218, 1.55), (0.18, -0.175, 1.60), (0.205, -0.12, 1.42), (0.15, -0.205, 1.40)]),
    ]
    for name, mat, verts in bangs:
        lock = add_hair_panel(name, mat, [(x * scale, y * scale, z * scale) for x, y, z in verts], collection, 0.008 * scale)
        parent_to_bone(lock, armature, "Head")

    side_panels = [
        ("LeftSideHairLayer", mats["hair"], [(-0.205, -0.055, 1.62), (-0.15, -0.17, 1.58), (-0.17, -0.14, 1.35), (-0.235, 0.025, 1.36)]),
        ("RightSideHairLayer", mats["hair"], [(0.15, -0.17, 1.58), (0.205, -0.055, 1.62), (0.235, 0.025, 1.36), (0.17, -0.14, 1.35)]),
        ("BackHairNape", mats["hair_highlight"], [(-0.16, 0.115, 1.56), (0.16, 0.115, 1.56), (0.13, 0.15, 1.31), (-0.13, 0.15, 1.31)]),
        ("LeftBackSpike", mats["hair"], [(-0.17, 0.11, 1.59), (-0.08, 0.135, 1.58), (-0.12, 0.16, 1.38)]),
        ("RightBackSpike", mats["hair"], [(0.08, 0.135, 1.58), (0.17, 0.11, 1.59), (0.12, 0.16, 1.38)]),
    ]
    for name, mat, verts in side_panels:
        panel = add_hair_panel(name, mat, [(x * scale, y * scale, z * scale) for x, y, z in verts], collection, 0.01 * scale)
        parent_to_bone(panel, armature, "Head")


def add_long_hair(
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    front_panels = [
        ("LongFrontBang_Left", mats["hair"], [(-0.155, -0.182, 1.675), (-0.07, -0.205, 1.705), (-0.118, -0.218, 1.615)]),
        ("LongFrontBang_Center", mats["hair_highlight"], [(-0.045, -0.204, 1.71), (0.048, -0.204, 1.71), (-0.005, -0.222, 1.622)]),
        ("LongFrontBang_Right", mats["hair"], [(0.06, -0.205, 1.705), (0.155, -0.182, 1.675), (0.105, -0.218, 1.615)]),
        ("LongSideSweptBang", mats["hair_highlight"], [(-0.02, -0.214, 1.698), (0.176, -0.2, 1.646), (0.076, -0.225, 1.61)]),
        ("LongLeftFaceLock", mats["hair"], [(-0.205, -0.065, 1.61), (-0.178, -0.145, 1.555), (-0.19, -0.12, 1.08), (-0.245, -0.01, 1.11)]),
        ("LongRightFaceLock", mats["hair"], [(0.178, -0.145, 1.555), (0.205, -0.065, 1.61), (0.245, -0.01, 1.11), (0.19, -0.12, 1.08)]),
    ]
    for name, mat, verts in front_panels:
        panel = add_hair_panel(name, mat, [(x * scale, y * scale, z * scale) for x, y, z in verts], collection, 0.0045 * scale)
        parent_to_bone(panel, armature, "Head")

    layered_bangs = [
        ("LongHairForeheadCurtain", mats["hair"], [(-0.16, -0.215, 1.674), (0.13, -0.215, 1.668), (0.06, -0.224, 1.63), (-0.13, -0.224, 1.625)]),
        ("LongHairSideSweepHighlight", mats["hair_highlight"], [(-0.03, -0.226, 1.686), (0.158, -0.214, 1.646), (0.09, -0.232, 1.615), (0.018, -0.232, 1.628)]),
        ("LongHairLeftThinLock", mats["hair_highlight"], [(-0.225, -0.075, 1.56), (-0.19, -0.145, 1.53), (-0.198, -0.12, 1.05), (-0.26, -0.02, 1.08)]),
        ("LongHairRightThinLock", mats["hair_highlight"], [(0.19, -0.145, 1.53), (0.225, -0.075, 1.56), (0.26, -0.02, 1.08), (0.198, -0.12, 1.05)]),
    ]
    for name, mat, verts in layered_bangs:
        panel = add_hair_panel(name, mat, [(x * scale, y * scale, z * scale) for x, y, z in verts], collection, 0.004 * scale)
        parent_to_bone(panel, armature, "Head")

    long_panels = [
        ("LongHairBackSheet", mats["hair"], [(-0.205, 0.11, 1.62), (0.205, 0.11, 1.62), (0.16, 0.18, 0.82), (-0.16, 0.18, 0.82)]),
        ("LongHairLeftOuter", mats["hair"], [(-0.215, -0.035, 1.60), (-0.155, 0.07, 1.58), (-0.17, 0.105, 0.86), (-0.29, -0.005, 0.93)]),
        ("LongHairRightOuter", mats["hair"], [(0.155, 0.07, 1.58), (0.215, -0.035, 1.60), (0.29, -0.005, 0.93), (0.17, 0.105, 0.86)]),
        ("LongHairLeftInner", mats["hair_highlight"], [(-0.11, 0.095, 1.55), (-0.035, 0.12, 1.55), (-0.055, 0.16, 0.86), (-0.14, 0.12, 0.9)]),
        ("LongHairRightInner", mats["hair_highlight"], [(0.035, 0.12, 1.55), (0.11, 0.095, 1.55), (0.14, 0.12, 0.9), (0.055, 0.16, 0.86)]),
        ("LongHairLeftHighlight", mats["hair_highlight"], [(-0.19, -0.085, 1.52), (-0.14, -0.02, 1.51), (-0.145, 0.02, 1.02), (-0.215, -0.055, 1.04)]),
        ("LongHairRightHighlight", mats["hair_highlight"], [(0.14, -0.02, 1.51), (0.19, -0.085, 1.52), (0.215, -0.055, 1.04), (0.145, 0.02, 1.02)]),
    ]
    for name, mat, verts in long_panels:
        panel = add_hair_panel(name, mat, [(x * scale, y * scale, z * scale) for x, y, z in verts], collection, 0.012 * scale)
        parent_to_bone(panel, armature, "Head")

    clip = add_cone("StarHairClip", mats["trim"], (0.172 * scale, -0.218 * scale, 1.635 * scale), 0.036 * scale, 0.036 * scale, 0.014 * scale, collection, vertices=5, rotation=(math.pi / 2, 0, math.pi / 5))
    parent_to_bone(clip, armature, "Head")


def add_outfit(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    if spec["id"] == "player":
        tie = add_cone("Necktie", mats["accent"], (0, -0.235 * scale, 1.22 * scale), 0.035 * scale, 0.012 * scale, 0.23 * scale, collection, vertices=4, rotation=(0, 0, math.pi / 4))
        parent_to_bone(tie, armature, "Chest")
        knot = add_uv_sphere("TieKnot", mats["trim"], (0, -0.238 * scale, 1.35 * scale), (0.035 * scale, 0.012 * scale, 0.03 * scale), collection, 16, 8)
        parent_to_bone(knot, armature, "Chest")
        for index, z in enumerate((1.27, 1.18, 1.09)):
            button = add_uv_sphere(
                f"JacketGoldButton_{index}",
                mats["trim"],
                (0.055 * scale, -0.244 * scale, z * scale),
                (0.013 * scale, 0.004 * scale, 0.013 * scale),
                collection,
                12,
                6,
            )
            parent_to_bone(button, armature, "Chest")
        belt = add_cube(
            "HeroBelt",
            mats["sole"],
            (0, -0.19 * scale, 0.88 * scale),
            (0.145 * scale, 0.01 * scale, 0.015 * scale),
            collection,
            bevel=0.003 * scale,
        )
        parent_to_bone(belt, armature, "Hips")
        buckle = add_cube(
            "HeroBeltBuckle",
            mats["trim"],
            (0, -0.202 * scale, 0.88 * scale),
            (0.026 * scale, 0.006 * scale, 0.022 * scale),
            collection,
            bevel=0.002 * scale,
        )
        parent_to_bone(buckle, armature, "Hips")
    else:
        add_skirt(m, mats, armature, collection)
        is_astrologer = spec["outfit"].get("style") == "astrologer-uniform"
        if is_astrologer:
            add_astrologer_details(m, mats, armature, collection)
        if is_astrologer:
            collar_gem = add_uv_sphere("AstrologerCollarGem", mats["trim"], (0, -0.247 * scale, 1.315 * scale), (0.024 * scale, 0.007 * scale, 0.024 * scale), collection, 16, 8)
            parent_to_bone(collar_gem, armature, "Chest")
            for side, sx in (("Left", -1), ("Right", 1)):
                neck_ribbon = add_cube(
                    f"{side}AstrologerNeckRibbon",
                    mats["outfit_dark"],
                    (sx * 0.035 * scale, -0.25 * scale, 1.255 * scale),
                    (0.012 * scale, 0.005 * scale, 0.085 * scale),
                    collection,
                    rotation=(0, 0, sx * 0.15),
                    bevel=0.0015 * scale,
                )
                parent_to_bone(neck_ribbon, armature, "Chest")
        else:
            bow_center = add_uv_sphere("RibbonCenter", mats["trim"], (0, -0.235 * scale, 1.29 * scale), (0.035 * scale, 0.012 * scale, 0.035 * scale), collection, 16, 8)
            parent_to_bone(bow_center, armature, "Chest")
            for side, sx in (("Left", -1), ("Right", 1)):
                bow = add_uv_sphere(f"{side}RibbonLoop", mats["accent"], (sx * 0.065 * scale, -0.242 * scale, 1.29 * scale), (0.065 * scale, 0.012 * scale, 0.036 * scale), collection, 16, 8)
                bow.rotation_euler[2] = sx * 0.18
                parent_to_bone(bow, armature, "Chest")
                ribbon_tail = add_cube(
                    f"{side}RibbonTail",
                    mats["accent"],
                    (sx * 0.035 * scale, -0.246 * scale, 1.205 * scale),
                    (0.018 * scale, 0.005 * scale, 0.105 * scale),
                    collection,
                    rotation=(0, 0, sx * 0.08),
                    bevel=0.002 * scale,
                )
                parent_to_bone(ribbon_tail, armature, "Chest")

    cape = add_cape(spec, m, mats, collection)
    parent_to_bone(cape, armature, "Chest")
    if spec["outfit"].get("style") == "astrologer-uniform":
        for side, sx in (("Left", -1), ("Right", 1)):
            trim = add_cube(
                f"{side}CapeletGoldTrim",
                mats["trim"],
                (sx * 0.19 * scale, 0.198 * scale, 1.10 * scale),
                (0.007 * scale, 0.006 * scale, 0.205 * scale),
                collection,
                rotation=(0, 0, sx * 0.26),
                bevel=0.0015 * scale,
            )
            parent_to_bone(trim, armature, "Chest")


def add_astrologer_details(
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    sash = add_cube(
        "StarChartSash",
        mats["outfit_secondary"],
        (-0.055 * scale, -0.246 * scale, 1.02 * scale),
        (0.032 * scale, 0.006 * scale, 0.31 * scale),
        collection,
        rotation=(0, 0, -0.52),
        bevel=0.0025 * scale,
    )
    parent_to_bone(sash, armature, "Chest")

    for index, z in enumerate((1.18, 1.06, 0.94)):
        star = add_cone(
            f"SashStar_{index}",
            mats["trim"],
            (-0.08 * scale + index * 0.03 * scale, -0.253 * scale, z * scale),
            0.018 * scale,
            0.018 * scale,
            0.006 * scale,
            collection,
            vertices=5,
            rotation=(math.pi / 2, 0, math.pi / 5 + index * 0.18),
        )
        parent_to_bone(star, armature, "Chest")

    mirror_plate = add_uv_sphere(
        "MirrorCompassChestGem",
        mats["eye"],
        (0.065 * scale, -0.253 * scale, 1.34 * scale),
        (0.028 * scale, 0.006 * scale, 0.028 * scale),
        collection,
        segments=20,
        rings=8,
    )
    parent_to_bone(mirror_plate, armature, "Chest")

    for side, sx in (("Left", -1), ("Right", 1)):
        shard = add_cube(
            f"{side}CapeletMirrorShard",
            mats["trim"],
            (sx * 0.19 * scale, -0.218 * scale, 1.245 * scale),
            (0.025 * scale, 0.005 * scale, 0.048 * scale),
            collection,
            rotation=(0, 0, sx * 0.36),
            bevel=0.002 * scale,
        )
        parent_to_bone(shard, armature, "Chest")


def add_skirt(
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    skirt = add_cone("LayeredSkirt", mats["outfit_dark"], (0, -0.005 * scale, 0.77 * scale), 0.255 * scale, 0.14 * scale, 0.25 * scale, collection, vertices=48)
    parent_to_bone(skirt, armature, "Hips")
    overskirt = add_cone("FrontApronPanel", mats["outfit_secondary"], (0.035 * scale, -0.108 * scale, 0.765 * scale), 0.17 * scale, 0.09 * scale, 0.22 * scale, collection, vertices=4, rotation=(0, 0, math.pi / 4 + 0.08), scale=(0.9, 0.44, 1))
    parent_to_bone(overskirt, armature, "Hips")
    back_panel = add_hair_panel(
        "AsymmetricBackSkirtPanel",
        mats["outfit_secondary"],
        [(-0.22 * scale, 0.085 * scale, 0.88 * scale), (0.22 * scale, 0.085 * scale, 0.88 * scale), (0.29 * scale, 0.12 * scale, 0.56 * scale), (-0.18 * scale, 0.12 * scale, 0.62 * scale)],
        collection,
        0.006 * scale,
    )
    parent_to_bone(back_panel, armature, "Hips")
    front_ruffle = add_hair_panel(
        "FrontWhiteRuffleLayer",
        mats["outfit_primary"],
        [(-0.16 * scale, -0.234 * scale, 0.75 * scale), (0.16 * scale, -0.234 * scale, 0.75 * scale), (0.19 * scale, -0.236 * scale, 0.61 * scale), (-0.19 * scale, -0.236 * scale, 0.61 * scale)],
        collection,
        0.006 * scale,
    )
    parent_to_bone(front_ruffle, armature, "Hips")
    belt = add_cylinder("WaistRibbonBelt", mats["trim"], (0, -0.005 * scale, 0.895 * scale), 0.18 * scale, 0.022 * scale, collection, vertices=48, scale=(1.28, 0.58, 0.42))
    parent_to_bone(belt, armature, "Hips")
    for index, x in enumerate((-0.18, -0.12, -0.06, 0.0, 0.06, 0.12, 0.18)):
        pleat = add_cube(
            f"SkirtFrontPleat_{index}",
            mats["trim"] if index in {1, 5} else mats["accent"] if index % 2 else mats["outfit_dark"],
            (x * scale, -0.216 * scale, 0.75 * scale),
            ((0.009 if index in {1, 5} else 0.011) * scale, 0.007 * scale, 0.17 * scale),
            collection,
            rotation=(0, 0, -x * 0.45),
            bevel=0.0015 * scale,
        )
        parent_to_bone(pleat, armature, "Hips")
    hem = add_cylinder("SkirtTrim", mats["trim"], (0, -0.005 * scale, 0.65 * scale), 0.276 * scale, 0.016 * scale, collection, vertices=40, scale=(1, 1, 0.55))
    parent_to_bone(hem, armature, "Hips")
    ruffle = add_cylinder("WhiteSkirtRuffle", mats["outfit_primary"], (0, -0.005 * scale, 0.622 * scale), 0.255 * scale, 0.028 * scale, collection, vertices=40, scale=(1, 1, 0.46))
    parent_to_bone(ruffle, armature, "Hips")


def add_cape(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    scale = m["scale"]
    width_top = 0.31 * scale if spec["id"] == "player" else 0.27 * scale
    width_bottom = 0.5 * scale if spec["id"] == "player" else 0.42 * scale
    top_z = 1.3 * scale
    bottom_z = 0.78 * scale if spec["id"] == "player" else 0.98 * scale
    y = 0.205 * scale
    verts = [
        (-width_top, y, top_z),
        (width_top, y, top_z),
        (width_bottom, y + 0.02 * scale, bottom_z),
        (-width_bottom, y + 0.02 * scale, bottom_z),
    ]
    cape_mat = mats["outfit_dark"] if spec["id"] == "player" else mats["outfit_primary"]
    cape = add_plane_mesh("MageCape" if spec["id"] == "player" else "Capelet", cape_mat, verts, [(0, 1, 2, 3)], collection)
    add_modifier_if_possible(cape, "cloth thickness", "SOLIDIFY", thickness=0.006 * scale)
    return cape


def add_accessories(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    held = spec["outfit"]["heldItem"]
    if held == "practice-wand":
        wand = add_cylinder("PracticeWand", mats["shoe"], (0.39 * scale, -0.08 * scale, 0.79 * scale), 0.012 * scale, 0.58 * scale, collection, vertices=10, rotation=(0.25, 0.18, 0.2))
        parent_to_bone(wand, armature, "RightHand")
        gem = add_uv_sphere("WandGem", mats["trim"], (0.31 * scale, -0.135 * scale, 1.06 * scale), (0.035 * scale, 0.035 * scale, 0.035 * scale), collection, 12, 8)
        parent_to_bone(gem, armature, "RightHand")
    elif held == "spellbook":
        book = add_cube("SpellbookCover", mats["outfit_dark"], (-0.38 * scale, -0.12 * scale, 0.86 * scale), (0.09 * scale, 0.025 * scale, 0.125 * scale), collection, rotation=(0.2, 0.1, -0.08), bevel=0.006 * scale)
        parent_to_bone(book, armature, "LeftHand")
        pages = add_cube("SpellbookPages", mats["paper"], (-0.38 * scale, -0.147 * scale, 0.86 * scale), (0.076 * scale, 0.011 * scale, 0.106 * scale), collection, rotation=(0.2, 0.1, -0.08), bevel=0.004 * scale)
        parent_to_bone(pages, armature, "LeftHand")
    elif held == "mirror-compass":
        compass = add_cylinder(
            "MirrorStarCompass",
            mats["trim"],
            (-0.37 * scale, -0.118 * scale, 0.87 * scale),
            0.066 * scale,
            0.012 * scale,
            collection,
            vertices=32,
            rotation=(math.pi / 2 + 0.18, 0.05, -0.18),
            scale=(1.0, 1.0, 0.32),
        )
        parent_to_bone(compass, armature, "LeftHand")
        glass = add_cylinder(
            "MirrorCompassGlass",
            mats["eye"],
            (-0.37 * scale, -0.126 * scale, 0.87 * scale),
            0.052 * scale,
            0.006 * scale,
            collection,
            vertices=32,
            rotation=(math.pi / 2 + 0.18, 0.05, -0.18),
            scale=(1.0, 1.0, 0.2),
        )
        parent_to_bone(glass, armature, "LeftHand")
        needle = add_cube(
            "MirrorCompassNeedle",
            mats["outfit_dark"],
            (-0.37 * scale, -0.134 * scale, 0.87 * scale),
            (0.006 * scale, 0.005 * scale, 0.052 * scale),
            collection,
            rotation=(0.24, 0.04, 0.58),
            bevel=0.001 * scale,
        )
        parent_to_bone(needle, armature, "LeftHand")

    brooch = add_uv_sphere("AcademyCrest", mats["trim"], (0.07 * scale, -0.246 * scale, 1.33 * scale), (0.026 * scale, 0.008 * scale, 0.026 * scale), collection, 16, 8)
    parent_to_bone(brooch, armature, "Chest")


def add_template_helpers(
    spec: dict[str, Any],
    m: dict[str, float],
    mats: dict[str, bpy.types.Material],
    armature: Any,
    collection: bpy.types.Collection,
) -> None:
    scale = m["scale"]
    ring = add_cylinder("SelectionRing", mats["trim"], (0, 0, 0.018 * scale), 0.42 * scale, 0.008 * scale, collection, vertices=64, scale=(1, 1, 0.08))
    ring.name = "SelectionRing_TemplateHelper"
    parent_keep_world(ring, armature["scene_root"] if isinstance(armature, dict) else armature)


def make_actions(armature: Any, spec: dict[str, Any]) -> None:
    if isinstance(armature, dict):
        make_node_actions(armature, spec)
        return

    actions = [
        ("idle", make_idle_keys(spec)),
        ("walk", make_walk_keys(spec)),
        ("talk", make_talk_keys(spec)),
    ]
    armature.animation_data_create()
    for name, frames in actions:
        clear_pose(armature)
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        armature.animation_data.action = action
        for frame, pose in frames:
            set_pose_frame(armature, frame, pose)
        track = armature.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, int(frames[0][0]), action)
        strip.name = name
        strip.action = action
    armature.animation_data.action = None
    clear_pose(armature)


def make_node_actions(rig: dict[str, Any], spec: dict[str, Any]) -> None:
    actions = [
        ("idle", make_idle_keys(spec)),
        ("walk", make_walk_keys(spec)),
        ("talk", make_talk_keys(spec)),
    ]

    for clip_name, frames in actions:
        animated_nodes = sorted({node_name for _, pose in frames for node_name in pose.keys()})
        for node_name in animated_nodes:
            control = rig["controls"].get(node_name)
            if not control:
                continue
            control.animation_data_create()
            action = bpy.data.actions.new(f"{node_name}_{clip_name}")
            action.use_fake_user = True
            control.animation_data.action = action
            for frame, pose in frames:
                rotation, offset = pose.get(node_name, ((0, 0, 0), (0, 0, 0)))
                control.rotation_euler = Euler(rotation, "XYZ")
                control.location = rig["rest"][node_name] + Vector(offset)
                control.keyframe_insert(data_path="rotation_euler", frame=frame)
                control.keyframe_insert(data_path="location", frame=frame)

            track = control.animation_data.nla_tracks.new()
            track.name = clip_name
            strip = track.strips.new(clip_name, int(frames[0][0]), action)
            strip.name = clip_name
            strip.action = action
            control.animation_data.action = None

    clear_pose(rig)


def make_idle_keys(spec: dict[str, Any]) -> list[tuple[int, dict[str, Any]]]:
    soft = 0.025 if spec["animation"]["idlePersonality"] == "gentle" else 0.018
    return [
        (1, {"Chest": ((0, 0, 0), (0, 0, 0)), "Head": ((0.02, 0, 0), (0, 0, 0))}),
        (30, {"Chest": ((soft, 0, 0), (0, 0, 0.012)), "Head": ((-0.015, 0.02, 0.01), (0, 0, 0))}),
        (60, {"Chest": ((0, 0, 0), (0, 0, 0)), "Head": ((0.02, 0, 0), (0, 0, 0))}),
    ]


def make_walk_keys(spec: dict[str, Any]) -> list[tuple[int, dict[str, Any]]]:
    light = spec["animation"]["walkPersonality"] == "light"
    stride = 0.42 if light else 0.34
    arm = 0.32 if light else 0.26
    bounce = 0.025 if light else 0.018
    return [
        (
            1,
            {
                "Hips": ((0, 0, 0), (0, 0, 0)),
                "LeftUpperLeg": ((stride, 0, 0), (0, 0, 0)),
                "RightUpperLeg": ((-stride, 0, 0), (0, 0, 0)),
                "LeftUpperArm": ((-arm, 0, 0.08), (0, 0, 0)),
                "RightUpperArm": ((arm, 0, -0.08), (0, 0, 0)),
            },
        ),
        (
            15,
            {
                "Hips": ((0, 0, 0), (0, 0, bounce)),
                "LeftUpperLeg": ((0, 0, 0), (0, 0, 0)),
                "RightUpperLeg": ((0, 0, 0), (0, 0, 0)),
                "LeftUpperArm": ((0, 0, 0), (0, 0, 0)),
                "RightUpperArm": ((0, 0, 0), (0, 0, 0)),
            },
        ),
        (
            30,
            {
                "Hips": ((0, 0, 0), (0, 0, 0)),
                "LeftUpperLeg": ((-stride, 0, 0), (0, 0, 0)),
                "RightUpperLeg": ((stride, 0, 0), (0, 0, 0)),
                "LeftUpperArm": ((arm, 0, 0.08), (0, 0, 0)),
                "RightUpperArm": ((-arm, 0, -0.08), (0, 0, 0)),
            },
        ),
        (
            45,
            {
                "Hips": ((0, 0, 0), (0, 0, bounce)),
                "LeftUpperLeg": ((0, 0, 0), (0, 0, 0)),
                "RightUpperLeg": ((0, 0, 0), (0, 0, 0)),
                "LeftUpperArm": ((0, 0, 0), (0, 0, 0)),
                "RightUpperArm": ((0, 0, 0), (0, 0, 0)),
            },
        ),
        (
            60,
            {
                "Hips": ((0, 0, 0), (0, 0, 0)),
                "LeftUpperLeg": ((stride, 0, 0), (0, 0, 0)),
                "RightUpperLeg": ((-stride, 0, 0), (0, 0, 0)),
                "LeftUpperArm": ((-arm, 0, 0.08), (0, 0, 0)),
                "RightUpperArm": ((arm, 0, -0.08), (0, 0, 0)),
            },
        ),
    ]


def make_talk_keys(spec: dict[str, Any]) -> list[tuple[int, dict[str, Any]]]:
    warm = spec["animation"]["talkPersonality"] == "warm"
    hand_side = "LeftUpperArm" if warm else "RightUpperArm"
    hand_lower = "LeftLowerArm" if warm else "RightLowerArm"
    return [
        (1, {"Head": ((0.0, 0.0, 0.0), (0, 0, 0)), hand_side: ((0.0, 0.0, 0.0), (0, 0, 0)), hand_lower: ((0.0, 0.0, 0.0), (0, 0, 0))}),
        (20, {"Head": ((-0.025, 0.03, 0.02), (0, 0, 0)), hand_side: ((-0.38, 0.0, 0.18), (0, 0, 0)), hand_lower: ((-0.32, 0.1, 0.0), (0, 0, 0))}),
        (40, {"Head": ((0.018, -0.02, -0.015), (0, 0, 0)), hand_side: ((-0.24, 0.0, 0.08), (0, 0, 0)), hand_lower: ((-0.16, 0.06, 0.0), (0, 0, 0))}),
        (60, {"Head": ((0.0, 0.0, 0.0), (0, 0, 0)), hand_side: ((0.0, 0.0, 0.0), (0, 0, 0)), hand_lower: ((0.0, 0.0, 0.0), (0, 0, 0))}),
    ]


def clear_pose(armature: Any) -> None:
    if isinstance(armature, dict):
        for node_name, control in armature["controls"].items():
            control.rotation_euler = (0, 0, 0)
            control.location = armature["rest"][node_name].copy()
        bpy.context.view_layer.update()
        return

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)
    bpy.ops.object.mode_set(mode="OBJECT")


def set_pose_frame(armature: bpy.types.Object, frame: int, pose: dict[str, Any]) -> None:
    scene = bpy.context.scene
    scene.frame_set(frame)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for bone_name, values in pose.items():
        bone = armature.pose.bones.get(bone_name)
        if not bone:
            continue
        rotation, location = values
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = Euler(rotation, "XYZ")
        bone.location = Vector(location)
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
        bone.keyframe_insert(data_path="location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")


def fit_root_to_height(root: bpy.types.Object, collection: bpy.types.Collection, target_height: float) -> None:
    bpy.context.view_layer.update()
    bbox_min = Vector((10**9, 10**9, 10**9))
    bbox_max = Vector((-10**9, -10**9, -10**9))
    for obj in collection.objects:
        if obj.type not in {"MESH", "ARMATURE"}:
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            bbox_min.x = min(bbox_min.x, world.x)
            bbox_min.y = min(bbox_min.y, world.y)
            bbox_min.z = min(bbox_min.z, world.z)
            bbox_max.x = max(bbox_max.x, world.x)
            bbox_max.y = max(bbox_max.y, world.y)
            bbox_max.z = max(bbox_max.z, world.z)
    height = max(0.001, bbox_max.z - bbox_min.z)
    factor = target_height / height
    root.scale = (factor, factor, factor)
    root.location.z -= bbox_min.z * factor


def tag_scene(root: bpy.types.Object, armature: Any, spec: dict[str, Any]) -> None:
    root["generatedBy"] = "scripts/blender/character_template.py"
    root["templateVersion"] = "blender-character-template-v1"
    root["characterId"] = spec["id"]
    root["displayName"] = spec["displayName"]
    root["targetHeightMeters"] = spec["heightMeters"]
    if isinstance(armature, dict):
        armature["root"]["rigType"] = "transform-node-template"
        armature["root"]["animationClips"] = "idle,walk,talk"
    else:
        armature["animationClips"] = "idle,walk,talk"


def add_camera_and_light(spec: dict[str, Any]) -> None:
    scale = float(spec["heightMeters"]) / 1.68
    bpy.ops.object.light_add(type="AREA", location=(0, -2.4 * scale, 3.0 * scale))
    light = bpy.context.object
    light.name = "Template_KeyLight"
    light.data.energy = 450
    light.data.size = 3.2

    bpy.ops.object.camera_add(location=(0, -4.2 * scale, 1.45 * scale), rotation=(math.radians(76), 0, 0))
    camera = bpy.context.object
    bpy.context.scene.camera = camera


def export_glb(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    kwargs = {
        "filepath": str(output),
        "export_format": "GLB",
        "export_skins": True,
        "export_morph": True,
        "export_animations": True,
        "export_nla_strips": True,
        "export_force_sampling": True,
    }
    bpy.ops.export_scene.gltf(**kwargs)


def main() -> None:
    args = parse_args()
    config_path = repo_path(args.config)
    config = load_config(config_path)
    out_dir = repo_path(args.out_dir or config.get("outputDir", "public/assets/models"))
    selected = args.character

    exports: list[Path] = []
    for spec in config["characters"]:
        if selected != "all" and spec["id"] != selected:
            continue
        exports.append(build_character(spec, out_dir, args.blend))

    if not exports:
        known = ", ".join(character["id"] for character in config["characters"])
        raise SystemExit(f"No character matched {selected!r}. Known characters: {known}")


if __name__ == "__main__":
    main()

"""
Build mature_senpai_commercial_v5 from the Hunyuan/BlenderMCP v2 runtime asset.

This is an automated production-structure pass:
- remove helper meshes
- split the single Hunyuan skinned mesh into named runtime submeshes
- apply deterministic weight-paint rules per body part
- add facial morph targets to the face/head piece
- add strap and pendant secondary-motion bones and detail meshes
- add dialogue-distance facial detail overlays for eyes, lashes, mouth, and blush
- preserve the existing humanoid, hair, and skirt secondary-motion armature
- export GLB, source blend, preview PNG, and a report

It deliberately preserves the source texture/UVs instead of remeshing from
scratch, because the current Hunyuan texture is the main visual likeness source.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", "/home/dennisj/apps/magic-academy-rpg-preview"))
SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_mcp_polish_v2.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v5.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v5.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v5.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v5.report.json"


PART_ORDER = [
    "Face_Head",
    "Hair_LeftLock",
    "Hair_RightLock",
    "Hair_Back",
    "Torso_Camisole",
    "Arms_Hands",
    "Skirt_LeftPanel",
    "Skirt_RightPanel",
    "Skirt_Center",
    "Legs",
    "Shoes",
]


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


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


def import_source() -> tuple[bpy.types.Object, bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No meshes imported from source GLB")
    body = max(meshes, key=lambda obj: len(obj.data.polygons))
    body.name = "MatureSenpai_SourceSingleMesh"
    body.data.name = "MatureSenpai_SourceSingleMeshData"

    for obj in meshes:
        if obj != body:
            bpy.data.objects.remove(obj, do_unlink=True)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("No armature imported from source GLB")
    armature = armatures[0]
    armature.name = "MatureSenpai_ProductionArmature"
    armature.data.name = "MatureSenpai_ProductionArmatureData"
    return body, armature


def add_secondary_detail_bones(armature: bpy.types.Object) -> list[str]:
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = armature.data.edit_bones

    def add_bone(name: str, head: tuple[float, float, float], tail: tuple[float, float, float], parent: str) -> None:
        if name in edit_bones:
            return
        bone = edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.roll = 0.0
        if parent in edit_bones:
            bone.parent = edit_bones[parent]
            bone.use_connect = False

    add_bone("Secondary_Strap_Left", (-0.105, -0.17, 1.52), (-0.060, -0.19, 1.30), "Chest")
    add_bone("Secondary_Strap_Right", (0.105, -0.17, 1.52), (0.060, -0.19, 1.30), "Chest")
    add_bone("Secondary_Pendant", (0.0, -0.205, 1.48), (0.0, -0.225, 1.34), "Neck")
    bpy.ops.object.mode_set(mode="OBJECT")
    return ["Secondary_Strap_Left", "Secondary_Strap_Right", "Secondary_Pendant"]


def classify_part(co: Vector) -> str:
    x, y, z = co.x, co.y, co.z
    ax = abs(x)

    if z < 0.43:
        return "Shoes"

    if z < 0.90 and ax > 0.065:
        return "Legs"

    if z < 1.18 and ax < 0.235:
        if x < -0.035:
            return "Skirt_LeftPanel"
        if x > 0.035:
            return "Skirt_RightPanel"
        return "Skirt_Center"

    if ax > 0.215 and 0.70 < z < 1.53:
        return "Arms_Hands"

    if z > 1.50:
        # Back/side hair occupies the rear, crown, and wider side silhouette.
        if y > -0.055 or ax > 0.165 or z > 1.77:
            if x < -0.055:
                return "Hair_LeftLock"
            if x > 0.055:
                return "Hair_RightLock"
            return "Hair_Back"
        return "Face_Head"

    if z > 1.18 and ax < 0.235:
        return "Torso_Camisole"

    if z < 1.25:
        return "Skirt_Center"

    return "Torso_Camisole"


def build_part_mesh(
    source: bpy.types.Object,
    armature: bpy.types.Object,
    part: str,
    collection: bpy.types.Collection,
) -> bpy.types.Object | None:
    source_mesh = source.data
    old_to_new: dict[int, int] = {}
    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    material_indices: list[int] = []
    uv_layers = list(source_mesh.uv_layers)
    uv_payload: list[list[list[tuple[float, float]]]] = [[] for _ in uv_layers]

    for polygon in source_mesh.polygons:
        if classify_part(polygon.center) != part:
            continue

        face: list[int] = []
        for old_index in polygon.vertices:
            if old_index not in old_to_new:
                old_to_new[old_index] = len(vertices)
                co = source_mesh.vertices[old_index].co
                vertices.append((co.x, co.y, co.z))
            face.append(old_to_new[old_index])

        faces.append(face)
        material_indices.append(polygon.material_index)
        for layer_index, uv_layer in enumerate(uv_layers):
            uv_payload[layer_index].append([
                tuple(uv_layer.data[loop_index].uv)
                for loop_index in polygon.loop_indices
            ])

    if not faces:
        return None

    mesh = bpy.data.meshes.new(f"MatureSenpai_{part}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)

    for material in source_mesh.materials:
        mesh.materials.append(material)

    for polygon_index, polygon in enumerate(mesh.polygons):
        polygon.material_index = material_indices[polygon_index]

    for layer_index, source_uv_layer in enumerate(uv_layers):
        target_uv_layer = mesh.uv_layers.new(name=source_uv_layer.name)
        for polygon_index, polygon in enumerate(mesh.polygons):
            for local_loop_index, loop_index in enumerate(polygon.loop_indices):
                target_uv_layer.data[loop_index].uv = uv_payload[layer_index][polygon_index][local_loop_index]

    obj = bpy.data.objects.new(f"MatureSenpai_{part}", mesh)
    collection.objects.link(obj)
    obj.matrix_world = source.matrix_world.copy()
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()

    for vertex_group in source.vertex_groups:
        obj.vertex_groups.new(name=vertex_group.name)

    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    transfer_source_normals(obj, source)
    armature_modifier = obj.modifiers.new("Production armature", "ARMATURE")
    armature_modifier.object = armature
    return obj


def transfer_source_normals(obj: bpy.types.Object, source: bpy.types.Object) -> None:
    """Reduce visible part seams by copying nearest source loop normals."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        modifier = obj.modifiers.new("Source loop normals", "DATA_TRANSFER")
        modifier.object = source
        modifier.use_loop_data = True
        modifier.data_types_loops = {"CUSTOM_NORMAL"}
        modifier.loop_mapping = "NEAREST_POLYNOR"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.update()
    except Exception:
        if "modifier" in locals() and modifier.name in obj.modifiers:
            obj.modifiers.remove(modifier)
    finally:
        obj.select_set(False)


def group(obj: bpy.types.Object, name: str) -> bpy.types.VertexGroup:
    vg = obj.vertex_groups.get(name)
    if vg is None:
        vg = obj.vertex_groups.new(name=name)
    return vg


def clear_weights(obj: bpy.types.Object) -> None:
    indices = list(range(len(obj.data.vertices)))
    if not indices:
        return
    for vg in obj.vertex_groups:
        try:
            vg.remove(indices)
        except RuntimeError:
            pass


def assign_weight(obj: bpy.types.Object, name: str, indices: list[int], weight: float) -> None:
    if not indices or weight <= 0:
        return
    group(obj, name).add(indices, clamp(weight, 0.0, 1.0), "REPLACE")


def paint_weights(obj: bpy.types.Object, part: str) -> None:
    clear_weights(obj)
    vertices = obj.data.vertices

    if part.startswith("Hair_"):
        for vertex in vertices:
            z = vertex.co.z
            x = vertex.co.x
            tip = clamp((1.72 - z) / 0.72, 0.08, 0.86)
            if part == "Hair_LeftLock" or x < -0.07:
                secondary = "Secondary_Hair_Left"
            elif part == "Hair_RightLock" or x > 0.07:
                secondary = "Secondary_Hair_Right"
            else:
                secondary = "Secondary_Hair_Back"
            assign_weight(obj, "Head", [vertex.index], 1.0 - tip)
            assign_weight(obj, secondary, [vertex.index], tip)
        return

    if part == "Face_Head":
        for vertex in vertices:
            neck = clamp((1.52 - vertex.co.z) / 0.18, 0.0, 0.25)
            assign_weight(obj, "Head", [vertex.index], 1.0 - neck)
            assign_weight(obj, "Neck", [vertex.index], neck)
        return

    if part == "Torso_Camisole":
        for vertex in vertices:
            z = vertex.co.z
            if z > 1.38:
                assign_weight(obj, "Chest", [vertex.index], 0.88)
                assign_weight(obj, "Spine", [vertex.index], 0.12)
            elif z > 1.13:
                t = clamp((z - 1.13) / 0.25, 0.0, 1.0)
                assign_weight(obj, "Chest", [vertex.index], t)
                assign_weight(obj, "Spine", [vertex.index], 1.0 - t)
            else:
                assign_weight(obj, "Spine", [vertex.index], 0.68)
                assign_weight(obj, "Hips", [vertex.index], 0.32)
        return

    if part == "Arms_Hands":
        for vertex in vertices:
            side = "Left" if vertex.co.x < 0 else "Right"
            z = vertex.co.z
            if z < 0.96:
                assign_weight(obj, f"{side}Hand", [vertex.index], 0.9)
                assign_weight(obj, f"{side}LowerArm", [vertex.index], 0.1)
            elif z < 1.24:
                assign_weight(obj, f"{side}LowerArm", [vertex.index], 0.86)
                assign_weight(obj, f"{side}UpperArm", [vertex.index], 0.14)
            else:
                assign_weight(obj, f"{side}UpperArm", [vertex.index], 0.92)
                assign_weight(obj, "Chest", [vertex.index], 0.08)
        return

    if part.startswith("Skirt_"):
        for vertex in vertices:
            z = vertex.co.z
            tip = clamp((1.12 - z) / 0.52, 0.05, 0.78)
            secondary = "Secondary_Skirt_Left" if vertex.co.x < 0 else "Secondary_Skirt_Right"
            assign_weight(obj, "Hips", [vertex.index], 1.0 - tip)
            assign_weight(obj, secondary, [vertex.index], tip)
        return

    if part == "Legs":
        for vertex in vertices:
            side = "Left" if vertex.co.x < 0 else "Right"
            z = vertex.co.z
            if z < 0.64:
                assign_weight(obj, f"{side}LowerLeg", [vertex.index], 0.9)
                assign_weight(obj, f"{side}UpperLeg", [vertex.index], 0.1)
            elif z < 0.83:
                t = clamp((z - 0.64) / 0.19, 0.0, 1.0)
                assign_weight(obj, f"{side}LowerLeg", [vertex.index], 1.0 - t)
                assign_weight(obj, f"{side}UpperLeg", [vertex.index], t)
            else:
                assign_weight(obj, f"{side}UpperLeg", [vertex.index], 0.92)
                assign_weight(obj, "Hips", [vertex.index], 0.08)
        return

    if part == "Shoes":
        for vertex in vertices:
            side = "Left" if vertex.co.x < 0 else "Right"
            assign_weight(obj, f"{side}Foot", [vertex.index], 1.0)


def add_face_morphs(face: bpy.types.Object) -> list[str]:
    bpy.context.view_layer.objects.active = face
    face.select_set(True)
    if face.data.shape_keys is None:
        face.shape_key_add(name="Basis")

    morph_names = ["Blink", "ConfidentSmile", "WarmSmile", "Teasing", "Surprised", "Thoughtful"]
    keys = {name: face.shape_key_add(name=name) for name in morph_names}

    for index, vertex in enumerate(face.data.vertices):
        co = vertex.co
        ax = abs(co.x)
        if 1.58 < co.z < 1.73 and co.y < -0.09 and 0.035 < ax < 0.165:
            keys["Blink"].data[index].co.z -= 0.018
            keys["Blink"].data[index].co.y += 0.006
        if 1.42 < co.z < 1.58 and co.y < -0.105 and ax < 0.15:
            lift = 0.014 if ax > 0.055 else 0.004
            keys["ConfidentSmile"].data[index].co.z += lift * 0.75
            keys["ConfidentSmile"].data[index].co.x += (1 if co.x >= 0 else -1) * 0.003
            keys["ConfidentSmile"].data[index].co.y -= 0.003
            keys["WarmSmile"].data[index].co.z += lift
            keys["WarmSmile"].data[index].co.y -= 0.004
            keys["Teasing"].data[index].co.z += lift * (1.2 if co.x > 0 else 0.45)
            keys["Teasing"].data[index].co.y -= 0.004
        if 1.41 < co.z < 1.62 and co.y < -0.10 and ax < 0.145:
            keys["Surprised"].data[index].co.z += 0.008 if co.z > 1.55 else -0.012
            keys["Surprised"].data[index].co.y -= 0.006
        if 1.48 < co.z < 1.72 and co.y < -0.09 and ax < 0.18:
            keys["Thoughtful"].data[index].co.z -= 0.004
            keys["Thoughtful"].data[index].co.y += 0.005
            keys["Thoughtful"].data[index].co.x += (-1 if co.x >= 0 else 1) * 0.002

    face.data.shape_keys.use_relative = True
    return morph_names


def make_parts(source: bpy.types.Object, armature: bpy.types.Object) -> tuple[list[bpy.types.Object], bpy.types.Collection]:
    collection = bpy.data.collections.new("MatureSenpai_CommercialV5_Parts")
    bpy.context.scene.collection.children.link(collection)
    parts: list[bpy.types.Object] = []
    for part in PART_ORDER:
        obj = build_part_mesh(source, armature, part, collection)
        if obj is None:
            continue
        paint_weights(obj, part)
        if part == "Face_Head":
            add_face_morphs(obj)
        obj["commercial_v5_part"] = part
        parts.append(obj)
    bpy.data.objects.remove(source, do_unlink=True)
    return parts, collection


def tune_materials(parts: list[bpy.types.Object]) -> None:
    for obj in parts:
        for material in obj.data.materials:
            if material and material.use_nodes:
                bsdf = material.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    if "Roughness" in bsdf.inputs:
                        bsdf.inputs["Roughness"].default_value = 0.46
                    if "Metallic" in bsdf.inputs:
                        bsdf.inputs["Metallic"].default_value = 0.0
                    if "Alpha" in bsdf.inputs:
                        bsdf.inputs["Alpha"].default_value = 1.0
                material.use_backface_culling = False


def make_material(name: str, color: tuple[float, float, float, float], roughness: float = 0.42) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.0
    material.use_backface_culling = False
    return material


def create_skinned_mesh(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[list[int]],
    materials: list[bpy.types.Material],
    material_indices: list[int],
    armature: bpy.types.Object,
    weights: dict[str, float],
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    for material in materials:
        mesh.materials.append(material)
    for index, polygon in enumerate(mesh.polygons):
        polygon.material_index = material_indices[index] if index < len(material_indices) else 0
        polygon.use_smooth = True

    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()
    armature_modifier = obj.modifiers.new("Production armature", "ARMATURE")
    armature_modifier.object = armature

    indices = [vertex.index for vertex in obj.data.vertices]
    for bone_name, weight in weights.items():
        group(obj, bone_name).add(indices, clamp(weight, 0.0, 1.0), "ADD")
    return obj


def add_detail_meshes(armature: bpy.types.Object, collection: bpy.types.Collection) -> list[bpy.types.Object]:
    ivory = make_material("CommercialV4_IvoryStraps", (0.96, 0.90, 0.78, 1.0), 0.48)
    gold = make_material("CommercialV4_GoldTrim", (0.98, 0.68, 0.24, 1.0), 0.36)
    purple = make_material("CommercialV4_PendantGem", (0.48, 0.32, 0.85, 1.0), 0.28)
    details: list[bpy.types.Object] = []

    strap_specs = [
        (
            "MatureSenpai_Strap_Left",
            [(-0.128, -0.224, 1.535), (-0.116, -0.225, 1.535), (-0.076, -0.218, 1.365), (-0.088, -0.218, 1.365)],
            "Secondary_Strap_Left",
        ),
        (
            "MatureSenpai_Strap_Right",
            [(0.116, -0.225, 1.535), (0.128, -0.224, 1.535), (0.088, -0.218, 1.365), (0.076, -0.218, 1.365)],
            "Secondary_Strap_Right",
        ),
    ]
    for name, verts, secondary_bone in strap_specs:
        details.append(create_skinned_mesh(
            name,
            verts,
            [[0, 1, 2, 3]],
            [ivory],
            [0],
            armature,
            {"Chest": 0.58, secondary_bone: 0.42},
            collection,
        ))

    pendant_vertices = [
        (-0.095, -0.224, 1.485),
        (0.095, -0.224, 1.485),
        (0.088, -0.226, 1.462),
        (-0.088, -0.226, 1.462),
        (0.0, -0.236, 1.455),
        (-0.028, -0.238, 1.405),
        (0.0, -0.244, 1.365),
        (0.028, -0.238, 1.405),
    ]
    pendant_faces = [
        [0, 1, 2, 3],
        [4, 5, 6],
        [4, 6, 7],
        [4, 7, 5],
    ]
    details.append(create_skinned_mesh(
        "MatureSenpai_Pendant_Choker",
        pendant_vertices,
        pendant_faces,
        [gold, purple],
        [0, 1, 1, 1],
        armature,
        {"Neck": 0.48, "Chest": 0.16, "Secondary_Pendant": 0.36},
        collection,
    ))
    return details


def quad(cx: float, y: float, cz: float, width: float, height: float) -> list[tuple[float, float, float]]:
    half_w = width * 0.5
    half_h = height * 0.5
    return [
        (cx - half_w, y, cz + half_h),
        (cx + half_w, y, cz + half_h),
        (cx + half_w, y, cz - half_h),
        (cx - half_w, y, cz - half_h),
    ]


def add_face_detail_overlays(armature: bpy.types.Object, collection: bpy.types.Collection) -> list[bpy.types.Object]:
    lash = make_material("CommercialV5_SoftLash", (0.135, 0.055, 0.090, 1.0), 0.5)
    catchlight = make_material("CommercialV5_EyeCatchlight", (0.98, 0.96, 1.0, 1.0), 0.25)
    mouth = make_material("CommercialV5_MouthLine", (0.42, 0.105, 0.145, 1.0), 0.55)
    blush = make_material("CommercialV5_CheekTint", (0.94, 0.44, 0.50, 0.22), 0.8)
    blush.blend_method = "BLEND"
    blush.use_nodes = True
    blush_bsdf = blush.node_tree.nodes.get("Principled BSDF")
    if blush_bsdf and "Alpha" in blush_bsdf.inputs:
        blush_bsdf.inputs["Alpha"].default_value = 0.22

    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    material_indices: list[int] = []

    def add_quad(verts: list[tuple[float, float, float]], material_index: int) -> None:
        base = len(vertices)
        vertices.extend(verts)
        faces.append([base, base + 1, base + 2, base + 3])
        material_indices.append(material_index)

    # These are deliberately small face-front overlays. They improve dialogue
    # readability without trying to repaint the generated texture atlas.
    face_y = -0.226
    add_quad(quad(-0.070, face_y, 1.676, 0.011, 0.011), 1)
    add_quad(quad(0.070, face_y, 1.676, 0.011, 0.011), 1)
    add_quad(quad(-0.074, face_y - 0.001, 1.696, 0.058, 0.005), 0)
    add_quad(quad(0.074, face_y - 0.001, 1.696, 0.058, 0.005), 0)
    add_quad(quad(-0.087, face_y + 0.001, 1.626, 0.028, 0.004), 3)
    add_quad(quad(-0.087, face_y + 0.001, 1.613, 0.024, 0.004), 3)
    add_quad(quad(0.087, face_y + 0.001, 1.626, 0.028, 0.004), 3)
    add_quad(quad(0.087, face_y + 0.001, 1.613, 0.024, 0.004), 3)
    add_quad(quad(0.000, face_y - 0.002, 1.586, 0.044, 0.004), 2)

    overlay = create_skinned_mesh(
        "MatureSenpai_Face_DialogueDetails",
        vertices,
        faces,
        [lash, catchlight, mouth, blush],
        material_indices,
        armature,
        {"Head": 1.0},
        collection,
    )
    overlay["commercial_v5_part"] = "Face_DialogueDetails"
    return [overlay]


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(parts: list[bpy.types.Object]) -> None:
    bpy.ops.object.light_add(type="AREA", location=(0, -3.2, 3.2))
    key = bpy.context.object
    key.name = "Preview_KeyLight"
    key.data.energy = 520
    key.data.size = 4.0

    bpy.ops.object.light_add(type="POINT", location=(-1.8, -1.6, 1.4))
    rim = bpy.context.object
    rim.name = "Preview_WarmFill"
    rim.data.energy = 90
    rim.data.color = (1.0, 0.82, 0.62)

    bpy.ops.object.camera_add(location=(0, -4.0, 1.28))
    camera = bpy.context.object
    look_at(camera, Vector((0, 0, 1.18)))
    bpy.context.scene.camera = camera

    available_engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in available_engines else "BLENDER_EEVEE"
    if hasattr(bpy.context.scene, "eevee"):
        bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.render.resolution_x = 768
    bpy.context.scene.render.resolution_y = 1024
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.world.color = (0.03, 0.03, 0.035)
    bpy.context.scene.render.filepath = str(OUTPUT_PNG)
    bpy.ops.render.render(write_still=True)


def export_outputs(parts: list[bpy.types.Object], armature: bpy.types.Object) -> None:
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))

    for obj in bpy.context.scene.objects:
        obj.select_set(obj == armature or obj in parts)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_morph=True,
        export_animations=True,
        export_apply=False,
    )


def write_report(parts: list[bpy.types.Object], armature: bpy.types.Object) -> None:
    morph_parts = [
        obj.name
        for obj in parts
        if obj.data.shape_keys and len(obj.data.shape_keys.key_blocks) > 1
    ]
    report = {
        "assetId": "mature-senpai-commercial-v5",
        "characterId": "mature_senpai",
        "status": "active-commercial-candidate-preview",
        "source": "public/assets/models/mature_senpai_mcp_polish_v2.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v5.blend",
        "output": "public/assets/models/mature_senpai_commercial_v5.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v5.png",
        "generatedBy": "BlenderMCP execute_code + assets/characters/mature_senpai/tools/build_final_v5.py",
        "parts": [
            {
                "name": obj.name,
                "faces": len(obj.data.polygons),
                "vertices": len(obj.data.vertices),
                "hasMorphTargets": bool(obj.data.shape_keys and len(obj.data.shape_keys.key_blocks) > 1),
            }
            for obj in parts
        ],
        "armatureBones": [bone.name for bone in armature.data.bones],
        "morphTargetMeshes": morph_parts,
        "secondaryBones": [
            bone.name
            for bone in armature.data.bones
            if "Secondary" in bone.name
        ],
        "runtimeDecision": {
            "defaultAsset": True,
            "fallbackAssetId": "mature-senpai-commercial-v4",
            "reason": "This v5 asset extends v4 with dialogue-distance face overlays for eye catchlights, lashes, mouth line, and cheek tint while preserving the split skinned runtime mesh, six facial morph targets, refreshed rule-painted weights, and secondary hair/skirt/strap/pendant bone hooks.",
        },
        "completedPasses": [
            "helper mesh removal",
            "single-mesh split into named skinned submeshes",
            "source loop-normal transfer to reduce split-part shading seams",
            "deterministic weight-paint pass for face, hair, torso, arms, skirt, legs, and shoes",
            "facial morph targets: Blink, ConfidentSmile, WarmSmile, Teasing, Surprised, Thoughtful",
            "secondary hair, skirt, strap, and pendant bone weight refresh",
            "visible camisole strap and pendant/choker detail meshes",
            "dialogue-distance face overlay meshes for catchlights, lashes, mouth line, and cheek tint",
            "runtime GLB export with skins, morph targets, and animations",
        ],
        "limitations": [
            "Automated topology split preserves Hunyuan triangles and UVs; it is not a hand-drawn quad retopology.",
            "Weight painting is rule-based in Blender Python, not artist hand-painted brush work.",
            "Facial morphs are broader than v3 but still generated shape keys, not artist-sculpted expression blendshapes.",
            "The face overlay is a runtime-readable polish layer, not a full texture repaint or sculpted eyelid/mouth topology pass.",
            "A final JRPG-quality asset still needs artist retopology, texture cleanup, and manual facial expression sculpting.",
        ],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> dict:
    clean_scene()
    source, armature = import_source()
    add_secondary_detail_bones(armature)
    parts, collection = make_parts(source, armature)
    details = add_detail_meshes(armature, collection)
    face_details = add_face_detail_overlays(armature, collection)
    all_parts = parts + details + face_details
    tune_materials(all_parts)
    render_preview(all_parts)
    export_outputs(all_parts, armature)
    write_report(all_parts, armature)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "parts": len(all_parts),
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

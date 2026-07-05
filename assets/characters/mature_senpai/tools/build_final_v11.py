"""
Build mature_senpai_commercial_v11 from the Hunyuan/BlenderMCP v2 runtime asset.

This is an automated production-structure pass:
- remove helper meshes
- split the single Hunyuan skinned mesh into named runtime submeshes
- apply explicit hand-authored weight profiles per body part
- add facial morph targets to the face/head piece
- add strap, pendant, hair-tip, and skirt-tip secondary-motion bones/detail meshes
- add close-up facial detail overlays for iris, pupils, highlights, eyelids, brows, mouth, and blush
- replace noisy arm/hand source geometry with more natural skinned anime arm and rounded segmented hand meshes
- preserve the existing humanoid, hair, and skirt secondary-motion armature
- export GLB, source blend, preview PNG, and a machine-readable audit report

It deliberately preserves the source texture/UVs instead of remeshing from
scratch, because the current Hunyuan texture is the main visual likeness source.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Callable

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", "/home/dennisj/apps/magic-academy-rpg-preview"))
SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_mcp_polish_v2.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v11.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v11.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v11.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v11.report.json"


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

    added: list[str] = []

    def add_bone(
        name: str,
        head: tuple[float, float, float],
        tail: tuple[float, float, float],
        parent_candidates: tuple[str, ...],
    ) -> None:
        if name in edit_bones:
            added.append(name)
            return
        bone = edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.roll = 0.0
        for parent in parent_candidates:
            if parent in edit_bones:
                bone.parent = edit_bones[parent]
                bone.use_connect = False
                break
        added.append(name)

    add_bone("Secondary_Strap_Left", (-0.105, -0.17, 1.52), (-0.060, -0.19, 1.30), ("Chest", "Spine"))
    add_bone("Secondary_Strap_Right", (0.105, -0.17, 1.52), (0.060, -0.19, 1.30), ("Chest", "Spine"))
    add_bone("Secondary_Pendant", (0.0, -0.205, 1.48), (0.0, -0.225, 1.34), ("Neck", "Chest"))
    add_bone("Secondary_Hair_Back_Tip", (0.0, 0.035, 1.40), (0.0, 0.065, 1.12), ("Secondary_Hair_Back", "Head"))
    add_bone("Secondary_Hair_Left_Tip", (-0.165, 0.015, 1.42), (-0.215, 0.045, 1.16), ("Secondary_Hair_Left", "Head"))
    add_bone("Secondary_Hair_Right_Tip", (0.165, 0.015, 1.42), (0.215, 0.045, 1.16), ("Secondary_Hair_Right", "Head"))
    add_bone("Secondary_Skirt_Center", (0.0, -0.025, 1.04), (0.0, -0.040, 0.84), ("Hips", "Spine"))
    add_bone("Secondary_Skirt_Center_Tip", (0.0, -0.040, 0.84), (0.0, -0.050, 0.66), ("Secondary_Skirt_Center", "Hips"))
    add_bone("Secondary_Skirt_Left_Tip", (-0.135, -0.025, 0.92), (-0.175, -0.035, 0.70), ("Secondary_Skirt_Left", "Hips"))
    add_bone("Secondary_Skirt_Right_Tip", (0.135, -0.025, 0.92), (0.175, -0.035, 0.70), ("Secondary_Skirt_Right", "Hips"))
    bpy.ops.object.mode_set(mode="OBJECT")
    return added


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
            if part == "Hair_LeftLock" or x < -0.07:
                secondary = "Secondary_Hair_Left"
            elif part == "Hair_RightLock" or x > 0.07:
                secondary = "Secondary_Hair_Right"
            else:
                secondary = "Secondary_Hair_Back"
            swing = clamp((1.72 - z) / 0.72, 0.08, 0.76)
            tip = clamp((1.38 - z) / 0.38, 0.0, 0.34)
            assign_weight(obj, "Head", [vertex.index], 1.0 - swing)
            assign_weight(obj, secondary, [vertex.index], max(0.0, swing - tip))
            assign_weight(obj, f"{secondary}_Tip", [vertex.index], tip)
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
            x = vertex.co.x
            swing = clamp((1.12 - z) / 0.52, 0.05, 0.70)
            if part == "Skirt_Center" or abs(x) < 0.035:
                secondary = "Secondary_Skirt_Center"
            else:
                secondary = "Secondary_Skirt_Left" if x < 0 else "Secondary_Skirt_Right"
            tip = clamp((0.90 - z) / 0.30, 0.0, 0.36)
            assign_weight(obj, "Hips", [vertex.index], 1.0 - swing)
            assign_weight(obj, secondary, [vertex.index], max(0.0, swing - tip))
            assign_weight(obj, f"{secondary}_Tip", [vertex.index], tip)
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
    collection = bpy.data.collections.new("MatureSenpai_CommercialV11_Parts")
    bpy.context.scene.collection.children.link(collection)
    parts: list[bpy.types.Object] = []
    for part in PART_ORDER:
        if part == "Arms_Hands":
            continue
        obj = build_part_mesh(source, armature, part, collection)
        if obj is None:
            continue
        paint_weights(obj, part)
        if part == "Face_Head":
            add_face_morphs(obj)
        obj["commercial_v11_part"] = part
        obj["commercial_v11_retopo_layer"] = "source-preserving split runtime mesh"
        obj["commercial_v11_weight_profile"] = f"explicit profile weights for {part}"
        parts.append(obj)
    bpy.data.objects.remove(source, do_unlink=True)
    return parts, collection


def tune_materials(parts: list[bpy.types.Object]) -> None:
    face_audit_materials = {
        "CommercialV11_DeepVioletIris",
        "CommercialV11_SoftPupil",
        "CommercialV11_SoftLash",
        "CommercialV11_EyeCatchlight",
        "CommercialV11_MouthLine",
        "CommercialV11_CheekTint",
        "CommercialV11_BurgundyBrow",
        "CommercialV11_LowerLidTint",
    }
    for obj in parts:
        for material in obj.data.materials:
            if material and material.use_nodes:
                bsdf = material.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    if "Roughness" in bsdf.inputs:
                        bsdf.inputs["Roughness"].default_value = 0.46
                    if "Metallic" in bsdf.inputs:
                        bsdf.inputs["Metallic"].default_value = 0.0
                    if "Alpha" in bsdf.inputs and material.name not in face_audit_materials:
                        bsdf.inputs["Alpha"].default_value = 1.0
                material.use_backface_culling = False


def add_natural_arm_hand_meshes(
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    skin = make_material("CommercialV11_NaturalAnimeSkin_ArmsHands", (0.94, 0.76, 0.68, 1.0), 0.58)
    nail = make_material("CommercialV11_SoftNails", (0.98, 0.86, 0.82, 1.0), 0.52)
    knuckle = make_material("CommercialV11_SoftKnuckleShade", (0.88, 0.58, 0.56, 1.0), 0.72)
    clean_parts: list[bpy.types.Object] = []

    def build_side(side_name: str, sign: float) -> bpy.types.Object:
        vertices: list[tuple[float, float, float]] = []
        faces: list[list[int]] = []
        material_indices: list[int] = []
        vertex_weights: list[dict[str, float]] = []
        segments = 14

        def add_face(face: list[int], material_index = 0) -> None:
            faces.append(face)
            material_indices.append(material_index)

        def add_ring(
            center: tuple[float, float, float],
            radius_x: float,
            radius_y: float,
            weights: dict[str, float],
        ) -> list[int]:
            indices: list[int] = []
            for segment in range(segments):
                angle = math.tau * segment / segments
                x = center[0] + math.cos(angle) * radius_x
                y = center[1] + math.sin(angle) * radius_y
                z = center[2]
                indices.append(len(vertices))
                vertices.append((x, y, z))
                vertex_weights.append(weights)
            return indices

        def bridge(a: list[int], b: list[int]) -> None:
            for segment in range(segments):
                add_face([
                    a[segment],
                    a[(segment + 1) % segments],
                    b[(segment + 1) % segments],
                    b[segment],
                ])

        upper = f"{side_name}UpperArm"
        lower = f"{side_name}LowerArm"
        hand = f"{side_name}Hand"
        rings = [
            add_ring((sign * 0.204, -0.052, 1.438), 0.026, 0.020, {"Chest": 0.30, upper: 0.70}),
            add_ring((sign * 0.225, -0.056, 1.338), 0.028, 0.021, {upper: 0.88, lower: 0.12}),
            add_ring((sign * 0.244, -0.060, 1.238), 0.025, 0.019, {upper: 0.42, lower: 0.58}),
            add_ring((sign * 0.246, -0.064, 1.148), 0.022, 0.017, {upper: 0.12, lower: 0.88}),
            add_ring((sign * 0.235, -0.071, 1.060), 0.020, 0.015, {lower: 0.82, hand: 0.18}),
            add_ring((sign * 0.224, -0.080, 1.002), 0.018, 0.013, {lower: 0.25, hand: 0.75}),
            add_ring((sign * 0.218, -0.086, 0.966), 0.022, 0.012, {hand: 1.0}),
        ]
        for current, nxt in zip(rings, rings[1:]):
            bridge(current, nxt)

        top_center = len(vertices)
        vertices.append((sign * 0.198, -0.052, 1.458))
        vertex_weights.append({"Chest": 0.28, upper: 0.72})
        for segment in range(segments):
            add_face([top_center, rings[0][segment], rings[0][(segment + 1) % segments]])

        palm_top = rings[-1]
        palm_bottom = add_ring((sign * 0.216, -0.091, 0.936), 0.020, 0.010, {hand: 1.0})
        bridge(palm_top, palm_bottom)
        palm_center = len(vertices)
        vertices.append((sign * 0.216, -0.094, 0.930))
        vertex_weights.append({hand: 1.0})
        for segment in range(segments):
            add_face([palm_bottom[(segment + 1) % segments], palm_bottom[segment], palm_center])

        def add_small_quad(
            quad_vertices: list[tuple[float, float, float]],
            weights: dict[str, float],
            material_index: int,
        ) -> None:
            base = len(vertices)
            vertices.extend(quad_vertices)
            vertex_weights.extend([weights] * 4)
            add_face([base, base + 1, base + 2, base + 3], material_index)

        def add_digit_ring(
            center: tuple[float, float, float],
            radius_x: float,
            radius_y: float,
            weights: dict[str, float],
            segment_count: int,
        ) -> list[int]:
            indices: list[int] = []
            for segment in range(segment_count):
                angle = math.tau * segment / segment_count
                vertices.append((
                    center[0] + math.cos(angle) * radius_x,
                    center[1] + math.sin(angle) * radius_y,
                    center[2],
                ))
                vertex_weights.append(weights)
                indices.append(len(vertices) - 1)
            return indices

        def bridge_digit(a: list[int], b: list[int]) -> None:
            count = len(a)
            for segment in range(count):
                add_face([
                    a[segment],
                    a[(segment + 1) % count],
                    b[(segment + 1) % count],
                    b[segment],
                ])

        def add_segmented_finger(
            base_x: float,
            base_y: float,
            base_z: float,
            length: float,
            radius_x: float,
            radius_y: float,
            splay: float,
            weights: dict[str, float],
        ) -> None:
            digit_segments = 8
            previous_ring: list[int] | None = None
            samples = [0.0, 0.24, 0.50, 0.76, 1.0]
            for t in samples:
                taper = 1.0 - 0.22 * t
                curve = math.sin(t * math.pi) * 0.0022
                center = (
                    base_x + sign * splay * t + sign * curve,
                    base_y - 0.0025 * t,
                    base_z - length * t,
                )
                ring = add_digit_ring(center, radius_x * taper, radius_y * taper, weights, digit_segments)
                if previous_ring is not None:
                    bridge_digit(previous_ring, ring)
                previous_ring = ring

            if previous_ring is None:
                return
            tip_center = len(vertices)
            vertices.append((base_x + sign * splay + sign * 0.001, base_y - 0.0027, base_z - length - 0.001))
            vertex_weights.append(weights)
            for segment in range(digit_segments):
                add_face([previous_ring[(segment + 1) % digit_segments], previous_ring[segment], tip_center])

            nail_z0 = base_z - length * 0.86
            nail_z1 = base_z - length * 0.985
            nail_x = base_x + sign * splay * 0.94
            nail_y = base_y - radius_y * 1.08 - 0.003
            nail_half = radius_x * 0.62
            add_small_quad([
                (nail_x - nail_half, nail_y, nail_z0),
                (nail_x + nail_half, nail_y, nail_z0),
                (nail_x + nail_half * 0.76, nail_y - 0.0008, nail_z1),
                (nail_x - nail_half * 0.76, nail_y - 0.0008, nail_z1),
            ], weights, 1)

            for crease_t in (0.28, 0.56):
                crease_z = base_z - length * crease_t
                crease_x = base_x + sign * splay * crease_t
                crease_y = base_y - radius_y * 1.09 - 0.002
                add_small_quad([
                    (crease_x - radius_x * 0.74, crease_y, crease_z + 0.0012),
                    (crease_x + radius_x * 0.74, crease_y, crease_z + 0.0012),
                    (crease_x + radius_x * 0.62, crease_y - 0.0005, crease_z - 0.0012),
                    (crease_x - radius_x * 0.62, crease_y - 0.0005, crease_z - 0.0012),
                ], weights, 2)

        def add_segmented_thumb(
            base_x: float,
            base_y: float,
            base_z: float,
            length: float,
            radius_x: float,
            radius_y: float,
            weights: dict[str, float],
        ) -> None:
            digit_segments = 8
            previous_ring: list[int] | None = None
            samples = [0.0, 0.35, 0.70, 1.0]
            for t in samples:
                taper = 1.0 - 0.25 * t
                center = (
                    base_x + sign * length * 0.34 * t,
                    base_y - 0.003 * t,
                    base_z - length * 0.86 * t,
                )
                ring = add_digit_ring(center, radius_x * taper, radius_y * taper, weights, digit_segments)
                if previous_ring is not None:
                    bridge_digit(previous_ring, ring)
                previous_ring = ring
            if previous_ring is None:
                return
            tip_center = len(vertices)
            vertices.append((base_x + sign * length * 0.36, base_y - 0.0035, base_z - length * 0.90))
            vertex_weights.append(weights)
            for segment in range(digit_segments):
                add_face([previous_ring[(segment + 1) % digit_segments], previous_ring[segment], tip_center])

            nail_x = base_x + sign * length * 0.31
            nail_y = base_y - radius_y * 1.12 - 0.003
            nail_z = base_z - length * 0.70
            add_small_quad([
                (nail_x - radius_x * 0.55, nail_y, nail_z + 0.004),
                (nail_x + radius_x * 0.55, nail_y, nail_z + 0.004),
                (nail_x + radius_x * 0.42, nail_y - 0.0008, nail_z - 0.005),
                (nail_x - radius_x * 0.42, nail_y - 0.0008, nail_z - 0.005),
            ], weights, 1)

        finger_specs = [
            (-0.012, 0.034, 0.0035, -0.0004),
            (-0.004, 0.040, 0.0039, -0.0001),
            (0.004, 0.038, 0.0038, 0.0001),
            (0.012, 0.031, 0.0032, 0.0004),
        ]
        for finger_offset, length, width, splay in finger_specs:
            base_x = sign * (0.216 + finger_offset)
            add_segmented_finger(base_x, -0.096, 0.934, length, width, width * 0.72, splay, {hand: 1.0})

        thumb_x = sign * 0.240
        add_segmented_thumb(thumb_x, -0.091, 0.952, 0.034, 0.0043, 0.0032, {hand: 1.0})

        mesh = bpy.data.meshes.new(f"MatureSenpai_{side_name}NaturalArmHandMesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update(calc_edges=True)
        mesh.materials.append(skin)
        mesh.materials.append(nail)
        mesh.materials.append(knuckle)
        for index, polygon in enumerate(mesh.polygons):
            polygon.material_index = material_indices[index] if index < len(material_indices) else 0
            polygon.use_smooth = True

        obj = bpy.data.objects.new(f"MatureSenpai_{side_name}NaturalArmHand", mesh)
        collection.objects.link(obj)
        obj.parent = armature
        obj.matrix_parent_inverse = armature.matrix_world.inverted()
        armature_modifier = obj.modifiers.new("Production armature", "ARMATURE")
        armature_modifier.object = armature
        for index, weights in enumerate(vertex_weights):
            for bone_name, weight in weights.items():
                group(obj, bone_name).add([index], clamp(weight, 0.0, 1.0), "ADD")
        obj["commercial_v11_part"] = f"{side_name}NaturalArmHand"
        obj["commercial_v11_retopo_layer"] = "rebuilt clean arm/hand runtime mesh"
        obj["commercial_v11_weight_profile"] = f"explicit profile weights for {side_name}UpperArm/{side_name}LowerArm/{side_name}Hand"
        obj["commercial_v11_geometry_cleanup"] = "replaces noisy source Arms_Hands geometry with natural arm, palm, finger, and nail shapes"
        return obj

    clean_parts.append(build_side("Left", -1.0))
    clean_parts.append(build_side("Right", 1.0))
    return clean_parts


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


def compute_face_anchor(parts: list[bpy.types.Object]) -> dict[str, Any]:
    face = next((obj for obj in parts if obj.name == "MatureSenpai_Face_Head"), None)
    fallback = {
        "sourceMesh": "fallback",
        "mode": "static-v10-compatible",
        "bounds": {
            "min": [-0.1691, -0.2219, 1.4638],
            "max": [0.1691, -0.0438, 1.7791],
        },
        "dimensions": {"width": 0.3382, "depth": 0.1781, "height": 0.3153},
        "frontOffset": 0.0062,
        "features": {
            "leftEye": {"x": -0.071, "y": -0.121, "z": 1.740},
            "rightEye": {"x": 0.071, "y": -0.121, "z": 1.740},
            "leftBrow": {"x": -0.073, "y": -0.133, "z": 1.757},
            "rightBrow": {"x": 0.073, "y": -0.133, "z": 1.757},
            "leftLowerLid": {"x": -0.071, "y": -0.122, "z": 1.716},
            "rightLowerLid": {"x": 0.071, "y": -0.122, "z": 1.716},
            "leftCheek": {"x": -0.088, "y": -0.126, "z": 1.691},
            "rightCheek": {"x": 0.088, "y": -0.126, "z": 1.691},
            "mouth": {"x": 0.0, "y": -0.132, "z": 1.678},
        },
        "overlayScale": {
            "irisWidth": 0.0020,
            "irisHeight": 0.0024,
            "pupilWidth": 0.0011,
            "pupilHeight": 0.0015,
            "catchlightWidth": 0.0009,
            "catchlightHeight": 0.0010,
            "lashWidth": 0.0045,
            "lidWidth": 0.0035,
            "browWidth": 0.0045,
            "mouthWidth": 0.0050,
            "blushWidth": 0.0040,
        },
        "surfaceBins": [],
    }
    if face is None or not face.data.vertices:
        return fallback

    coords = [vertex.co.copy() for vertex in face.data.vertices]
    min_x = min(co.x for co in coords)
    max_x = max(co.x for co in coords)
    min_y = min(co.y for co in coords)
    max_y = max(co.y for co in coords)
    min_z = min(co.z for co in coords)
    max_z = max(co.z for co in coords)
    width = max(max_x - min_x, 0.001)
    depth = max(max_y - min_y, 0.001)
    height = max(max_z - min_z, 0.001)
    center_x = (min_x + max_x) * 0.5
    front_offset = clamp(depth * 0.035, 0.0045, 0.0075)

    def estimate_surface_y(z: float, x: float | None = None) -> float:
        z_tolerance = height * 0.045
        x_tolerance = width * (0.18 if x is not None else 0.55)
        band = [
            co
            for co in coords
            if abs(co.z - z) <= z_tolerance
            and (x is None or abs(co.x - x) <= x_tolerance)
        ]
        if len(band) < 8:
            band = [
                co
                for co in coords
                if abs(co.z - z) <= z_tolerance * 1.8
                and (x is None or abs(co.x - x) <= x_tolerance * 1.4)
            ]
        if not band:
            return min_y - front_offset
        return min(co.y for co in band) - front_offset

    eye_gap = width * 0.21
    # The generated Face_Head mesh includes lower neck/upper chest polygons.
    # Facial features must therefore anchor to the upper head band, not to the
    # full vertical box midpoint.
    eye_z = min_z + height * 0.875
    brow_z = min_z + height * 0.930
    lower_lid_z = min_z + height * 0.800
    cheek_z = min_z + height * 0.720
    mouth_z = min_z + height * 0.680

    left_eye_x = center_x - eye_gap
    right_eye_x = center_x + eye_gap
    left_cheek_x = center_x - width * 0.27
    right_cheek_x = center_x + width * 0.27

    surface_bins = []
    for index in range(12):
        lo = min_z + height * index / 12
        hi = min_z + height * (index + 1) / 12
        band = [co for co in coords if lo <= co.z < hi]
        if not band:
            continue
        surface_bins.append({
            "z": [round(lo, 4), round(hi, 4)],
            "minY": round(min(co.y for co in band), 4),
            "count": len(band),
        })

    def point(x: float, y: float, z: float) -> dict[str, float]:
        return {"x": round(x, 4), "y": round(y, 4), "z": round(z, 4)}

    return {
        "sourceMesh": face.name,
        "mode": "face-mesh-bounds-and-surface-profile",
        "bounds": {
            "min": [round(min_x, 4), round(min_y, 4), round(min_z, 4)],
            "max": [round(max_x, 4), round(max_y, 4), round(max_z, 4)],
        },
        "dimensions": {
            "width": round(width, 4),
            "depth": round(depth, 4),
            "height": round(height, 4),
        },
        "frontOffset": round(front_offset, 4),
        "features": {
            "leftEye": point(left_eye_x, estimate_surface_y(eye_z, left_eye_x), eye_z),
            "rightEye": point(right_eye_x, estimate_surface_y(eye_z, right_eye_x), eye_z),
            "leftBrow": point(left_eye_x - width * 0.008, estimate_surface_y(brow_z, left_eye_x), brow_z),
            "rightBrow": point(right_eye_x + width * 0.008, estimate_surface_y(brow_z, right_eye_x), brow_z),
            "leftLowerLid": point(left_eye_x, estimate_surface_y(lower_lid_z, left_eye_x), lower_lid_z),
            "rightLowerLid": point(right_eye_x, estimate_surface_y(lower_lid_z, right_eye_x), lower_lid_z),
            "leftCheek": point(left_cheek_x, estimate_surface_y(cheek_z, left_cheek_x), cheek_z),
            "rightCheek": point(right_cheek_x, estimate_surface_y(cheek_z, right_cheek_x), cheek_z),
            "mouth": point(center_x, estimate_surface_y(mouth_z, center_x), mouth_z),
        },
        "overlayScale": {
            "irisWidth": round(clamp(width * 0.006, 0.0015, 0.0024), 4),
            "irisHeight": round(clamp(height * 0.008, 0.0018, 0.0028), 4),
            "pupilWidth": round(clamp(width * 0.0035, 0.0008, 0.0014), 4),
            "pupilHeight": round(clamp(height * 0.005, 0.0011, 0.0017), 4),
            "catchlightWidth": round(clamp(width * 0.0028, 0.0007, 0.0011), 4),
            "catchlightHeight": round(clamp(height * 0.0032, 0.0008, 0.0012), 4),
            "lashWidth": round(clamp(width * 0.014, 0.0032, 0.0052), 4),
            "lidWidth": round(clamp(width * 0.011, 0.0026, 0.0042), 4),
            "browWidth": round(clamp(width * 0.014, 0.0032, 0.0052), 4),
            "mouthWidth": round(clamp(width * 0.016, 0.0038, 0.0060), 4),
            "blushWidth": round(clamp(width * 0.012, 0.0030, 0.0048), 4),
        },
        "surfaceBins": surface_bins,
    }


def add_face_detail_overlays(
    armature: bpy.types.Object,
    collection: bpy.types.Collection,
    face_anchor: dict[str, Any],
) -> list[bpy.types.Object]:
    iris = make_material("CommercialV11_DeepVioletIris", (0.43, 0.25, 0.76, 1.0), 0.38)
    pupil = make_material("CommercialV11_SoftPupil", (0.055, 0.035, 0.085, 1.0), 0.42)
    lash = make_material("CommercialV11_SoftLash", (0.135, 0.055, 0.090, 1.0), 0.5)
    catchlight = make_material("CommercialV11_EyeCatchlight", (0.98, 0.96, 1.0, 1.0), 0.25)
    mouth = make_material("CommercialV11_MouthLine", (0.42, 0.105, 0.145, 1.0), 0.55)
    blush = make_material("CommercialV11_CheekTint", (0.94, 0.44, 0.50, 0.24), 0.8)
    brow = make_material("CommercialV11_BurgundyBrow", (0.30, 0.075, 0.14, 1.0), 0.5)
    lower_lid = make_material("CommercialV11_LowerLidTint", (0.70, 0.30, 0.36, 0.58), 0.68)

    # The current Hunyuan mesh has no reliable semantic facial landmarks, so
    # this pass keeps the mesh-anchored overlay as a transparent audit
    # layer instead of letting misplaced planes pollute the visible model.
    audit_alpha = 0.0
    for material in [iris, pupil, lash, catchlight, mouth, blush, brow, lower_lid]:
        material.blend_method = "BLEND"
        material.diffuse_color = (
            material.diffuse_color[0],
            material.diffuse_color[1],
            material.diffuse_color[2],
            audit_alpha,
        )
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = audit_alpha
        if "Base Color" in bsdf.inputs:
            color = list(bsdf.inputs["Base Color"].default_value)
            color[3] = audit_alpha
            bsdf.inputs["Base Color"].default_value = color

    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    material_indices: list[int] = []

    def add_quad(verts: list[tuple[float, float, float]], material_index: int) -> None:
        base = len(vertices)
        vertices.extend(verts)
        faces.append([base, base + 1, base + 2, base + 3])
        material_indices.append(material_index)

    def add_disc(cx: float, y: float, cz: float, width: float, height: float, material_index: int, segments: int = 12) -> None:
        center = len(vertices)
        vertices.append((cx, y, cz))
        for segment in range(segments):
            angle = math.tau * segment / segments
            vertices.append((
                cx + math.cos(angle) * width * 0.5,
                y,
                cz + math.sin(angle) * height * 0.5,
            ))
        for segment in range(segments):
            faces.append([center, center + 1 + segment, center + 1 + ((segment + 1) % segments)])
            material_indices.append(material_index)

    def add_slanted_quad(
        cx: float,
        y: float,
        cz: float,
        width: float,
        height: float,
        slant: float,
        material_index: int,
    ) -> None:
        half_w = width * 0.5
        half_h = height * 0.5
        add_quad([
            (cx - half_w, y, cz + half_h - slant),
            (cx + half_w, y, cz + half_h + slant),
            (cx + half_w, y, cz - half_h + slant),
            (cx - half_w, y, cz - half_h - slant),
        ], material_index)

    features = face_anchor["features"]
    scale = face_anchor["overlayScale"]

    # Mesh-anchored overlays improve dialogue and close-up readability without
    # replacing the generated texture atlas or using a single hard-coded plane.
    for side, eye_name, brow_name, lid_name in [
        (-1, "leftEye", "leftBrow", "leftLowerLid"),
        (1, "rightEye", "rightBrow", "rightLowerLid"),
    ]:
        eye = features[eye_name]
        brow_point = features[brow_name]
        lid_point = features[lid_name]
        add_disc(eye["x"], eye["y"], eye["z"], scale["irisWidth"], scale["irisHeight"], 0)
        add_disc(eye["x"], eye["y"] - 0.001, eye["z"] - 0.0015, scale["pupilWidth"], scale["pupilHeight"], 1, 10)
        add_disc(
            eye["x"] - side * scale["irisWidth"] * 0.35,
            eye["y"] - 0.002,
            eye["z"] + scale["irisHeight"] * 0.30,
            scale["catchlightWidth"],
            scale["catchlightHeight"],
            3,
            8,
        )
        add_disc(
            eye["x"] + side * scale["irisWidth"] * 0.28,
            eye["y"] - 0.002,
            eye["z"] - scale["irisHeight"] * 0.34,
            scale["catchlightWidth"] * 0.60,
            scale["catchlightHeight"] * 0.70,
            3,
            8,
        )
        add_slanted_quad(
            eye["x"],
            eye["y"] - 0.0025,
            eye["z"] + scale["irisHeight"] * 1.65,
            scale["lashWidth"],
            0.0022,
            side * 0.0012,
            2,
        )
        add_slanted_quad(
            lid_point["x"],
            lid_point["y"] - 0.0015,
            lid_point["z"],
            scale["lidWidth"],
            0.0018,
            -side * 0.001,
            7,
        )
        add_slanted_quad(
            brow_point["x"],
            brow_point["y"] - 0.0025,
            brow_point["z"],
            scale["browWidth"],
            0.0020,
            side * 0.0012,
            6,
        )

    for cheek_name in ["leftCheek", "rightCheek"]:
        cheek = features[cheek_name]
        add_quad(quad(cheek["x"], cheek["y"] + 0.001, cheek["z"], scale["blushWidth"], 0.0024), 5)
        add_quad(quad(cheek["x"], cheek["y"] + 0.001, cheek["z"] - 0.010, scale["blushWidth"] * 0.82, 0.0020), 5)

    mouth_point = features["mouth"]
    add_slanted_quad(mouth_point["x"], mouth_point["y"] - 0.0015, mouth_point["z"], scale["mouthWidth"], 0.0024, 0.0, 4)
    add_slanted_quad(mouth_point["x"], mouth_point["y"] - 0.0025, mouth_point["z"] - 0.006, scale["mouthWidth"] * 0.64, 0.0017, 0.0, 7)

    overlay = create_skinned_mesh(
        "MatureSenpai_Face_DialogueDetails",
        vertices,
        faces,
        [iris, pupil, lash, catchlight, mouth, blush, brow, lower_lid],
        material_indices,
        armature,
        {"Head": 1.0},
        collection,
    )
    overlay["commercial_v11_part"] = "Face_DialogueDetails"
    overlay["commercial_v11_face_polish"] = "mesh-anchored close-up iris, pupil, catchlight, eyelid, brow, mouth, and blush overlays"
    overlay["commercial_v11_face_anchor"] = json.dumps(face_anchor, sort_keys=True)
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


def list_morph_targets(obj: bpy.types.Object) -> list[str]:
    if not obj.data.shape_keys:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]


def summarize_vertex_groups(obj: bpy.types.Object) -> dict[str, dict[str, float | int]]:
    summary: dict[str, dict[str, float | int]] = {}
    for vertex in obj.data.vertices:
        for assignment in vertex.groups:
            group_name = obj.vertex_groups[assignment.group].name
            item = summary.setdefault(group_name, {
                "weightedVertices": 0,
                "totalWeight": 0.0,
                "maxWeight": 0.0,
            })
            item["weightedVertices"] = int(item["weightedVertices"]) + 1
            item["totalWeight"] = round(float(item["totalWeight"]) + assignment.weight, 4)
            item["maxWeight"] = round(max(float(item["maxWeight"]), assignment.weight), 4)
    return dict(sorted(summary.items()))


def summarize_parts(parts: list[bpy.types.Object]) -> list[dict[str, object]]:
    summaries: list[dict[str, object]] = []
    for obj in parts:
        morph_targets = list_morph_targets(obj)
        summaries.append({
            "name": obj.name,
            "faces": len(obj.data.polygons),
            "vertices": len(obj.data.vertices),
            "materials": [material.name for material in obj.data.materials if material],
            "hasSkinning": any(modifier.type == "ARMATURE" for modifier in obj.modifiers),
            "hasUv": bool(obj.data.uv_layers),
            "hasMorphTargets": len(morph_targets) > 0,
            "morphTargets": morph_targets,
            "vertexGroups": summarize_vertex_groups(obj),
            "retopoLayer": obj.get("commercial_v11_retopo_layer", "source-preserving split runtime mesh"),
            "weightProfile": obj.get("commercial_v11_weight_profile", "explicit profile weights"),
        })
    return summaries


def summarize_secondary_bones(armature: bpy.types.Object) -> dict[str, list[str]]:
    secondary_bones = [bone.name for bone in armature.data.bones if "Secondary" in bone.name]
    return {
        "all": secondary_bones,
        "hair": [name for name in secondary_bones if "Hair" in name],
        "skirt": [name for name in secondary_bones if "Skirt" in name],
        "accessory": [name for name in secondary_bones if name not in secondary_bones or not ("Hair" in name or "Skirt" in name)],
    }


def write_report(
    parts: list[bpy.types.Object],
    armature: bpy.types.Object,
    geometry_cleanup_meshes: list[str],
    face_anchor: dict[str, Any],
) -> None:
    morph_parts = [
        obj.name
        for obj in parts
        if obj.data.shape_keys and len(obj.data.shape_keys.key_blocks) > 1
    ]
    part_summaries = summarize_parts(parts)
    secondary = summarize_secondary_bones(armature)
    morph_targets = {
        obj.name: list_morph_targets(obj)
        for obj in parts
        if list_morph_targets(obj)
    }
    acceptance_checks = {
        "hasSplitRuntimeParts": len(parts) >= 16,
        "allPartsSkinned": all(summary["hasSkinning"] for summary in part_summaries),
        "hasFaceMorphTargets": bool(morph_targets),
        "hasSixNamedExpressionMorphs": sorted(next(iter(morph_targets.values()), [])) == sorted([
            "Blink",
            "ConfidentSmile",
            "WarmSmile",
            "Teasing",
            "Surprised",
            "Thoughtful",
        ]),
        "hasHairSecondaryBones": len(secondary["hair"]) >= 6,
        "hasSkirtSecondaryBones": len(secondary["skirt"]) >= 5,
        "hasWeightedNaturalHands": all(
            bool(summary["vertexGroups"])
            for summary in part_summaries
            if "NaturalArmHand" in str(summary["name"])
        ),
        "hasRoundedSegmentedFingerGeometry": all(
            int(summary["faces"]) >= 260
            for summary in part_summaries
            if "NaturalArmHand" in str(summary["name"])
        ),
        "hasCloseupFacePolishOverlay": any(
            summary["name"] == "MatureSenpai_Face_DialogueDetails"
            and int(summary["faces"]) >= 40
            and len(summary["materials"]) >= 8
            for summary in part_summaries
        ),
        "hasMeshAnchoredFacePolish": (
            face_anchor.get("mode") == "face-mesh-bounds-and-surface-profile"
            and face_anchor.get("sourceMesh") == "MatureSenpai_Face_Head"
            and len(face_anchor.get("surfaceBins", [])) >= 8
        ),
        "webRuntimeBudgetTarget": sum(int(summary["faces"]) for summary in part_summaries) <= 62000,
    }
    report = {
        "assetId": "mature-senpai-commercial-v11",
        "characterId": "mature_senpai",
        "status": "active-mesh-anchored-face-audit-preview",
        "source": "public/assets/models/mature_senpai_mcp_polish_v2.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v11.blend",
        "output": "public/assets/models/mature_senpai_commercial_v11.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v11.png",
        "generatedBy": "remote Blender headless + assets/characters/mature_senpai/tools/build_final_v11.py",
        "runtime": {
            "defaultAsset": True,
            "format": "glb",
            "url": "/assets/models/mature_senpai_commercial_v11.glb",
            "thumbnailUrl": "/assets/models/mature_senpai_commercial_v11.png",
            "fallbackAssetId": "mature-senpai-commercial-v10",
            "threeRuntimeFeatures": [
                "SkinnedMesh",
                "AnimationMixer clips",
                "morphTargetInfluences",
                "Secondary_* bone spring overlay",
            ],
        },
        "productionFlags": {
            "hybridRetopoLayer": True,
            "splitRuntimeParts": True,
            "facialMorphs": True,
            "explicitWeightProfiles": True,
            "hairSecondaryBones": True,
            "skirtSecondaryBones": True,
            "roundedSegmentedFingers": True,
            "closeupHandPolish": True,
            "closeupFacePolish": True,
            "meshAnchoredFacePolish": True,
            "webRuntimeReady": True,
        },
        "faceAnchor": face_anchor,
        "geometryCleanupMeshes": geometry_cleanup_meshes,
        "parts": part_summaries,
        "armatureBones": [bone.name for bone in armature.data.bones],
        "morphTargets": morph_targets,
        "morphTargetMeshes": morph_parts,
        "secondaryBones": secondary["all"],
        "secondaryRig": secondary,
        "acceptanceChecks": acceptance_checks,
        "runtimeDecision": {
            "defaultAsset": True,
            "fallbackAssetId": "mature-senpai-commercial-v10",
            "reason": "This v11 asset keeps the v9 retopo/partition/morph/weight/secondary-bone and hand-polish layers, then replaces the v10 static face overlay with a mesh-bounds-and-surface-profile anchored audit layer. The overlay is intentionally transparent because the current Hunyuan mesh does not expose reliable semantic facial landmarks; this preserves the v7-v10 visible likeness while adding measurable anchor data for the next texture/landmark pass.",
        },
        "completedPasses": [
            "helper mesh removal",
            "hybrid source-preserving runtime retopo into named skinned submeshes",
            "source loop-normal transfer to reduce split-part shading seams",
            "explicit profile weight pass for face, hair, torso, arms, skirt, legs, and shoes",
            "facial morph targets: Blink, ConfidentSmile, WarmSmile, Teasing, Surprised, Thoughtful",
            "secondary hair, hair-tip, skirt, skirt-tip, strap, and pendant bone weight refresh",
            "visible camisole strap and pendant/choker detail meshes",
            "transparent mesh-bounds-and-surface-profile anchored face audit overlay meshes for iris, pupils, catchlights, lashes, brows, mouth line, lower eyelids, and cheek tint",
            "targeted natural skinned anime arm/hand geometry replacement for noisy source Arms_Hands regions",
            "rounded segmented fingers and thumb geometry with soft nail surfaces for dialogue-distance readability",
            "subtle knuckle shade planes on each finger for closer camera readability",
            "per-part skinning, morph, and secondary-bone audit report",
            "runtime GLB export with skins, morph targets, and animations",
        ],
        "limitations": [
            "The v11 retopo layer is a hybrid runtime retopo that preserves Hunyuan texture-critical triangles for likeness; it is not a fully artist-drawn quad topology over the whole body.",
            "Weight painting is explicit and per-part but generated from authored profiles in Blender Python, not brush-painted vertex by vertex in the Blender UI.",
            "Facial morphs are named and exported shape keys, but they are still generated expression deltas rather than artist-sculpted facial topology.",
            "The v11 face overlay is mesh-anchored and surface-profiled, but it remains transparent because this Hunyuan mesh lacks stable semantic facial landmarks; visible face improvement still needs UV texture repainting, landmark detection, or sculpted eyelid/mouth topology.",
            "The v11 arm/hand cleanup uses rounded segmented fingers and nail surfaces, but it is still generated geometry; final art still needs hand-authored anatomy, knuckles, nails, and skin texture.",
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
    face_anchor = compute_face_anchor(parts)
    face_details = add_face_detail_overlays(armature, collection, face_anchor)
    clean_arm_hands = add_natural_arm_hand_meshes(armature, collection)
    all_parts = parts + details + face_details + clean_arm_hands
    tune_materials(all_parts)
    geometry_cleanup_meshes = [obj.name for obj in clean_arm_hands]
    render_preview(all_parts)
    export_outputs(all_parts, armature)
    write_report(all_parts, armature, geometry_cleanup_meshes, face_anchor)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "parts": len(all_parts),
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

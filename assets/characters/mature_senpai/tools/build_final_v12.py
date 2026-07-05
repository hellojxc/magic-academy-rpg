"""
Build mature_senpai_commercial_v12 from the mcp-polish-v2 visual source.

This pass deliberately preserves the Hunyuan/BlenderMCP visible mesh instead of
physically splitting the whole body into brittle submeshes. The previous v11
split added useful engineering hooks, but the split/replacement geometry hurt
the likeness. v12 keeps the source body/UV/texture intact, then adds:
- semantic part vertex groups for retopo handoff
- six runtime facial morph targets on the preserved source mesh
- secondary hair/skirt/strap/pendant bones with explicit supplemental weights
- visible camisole strap/choker/pendant detail meshes as real runtime parts
- GLB, blend, preview PNG, and an audit report
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", "/home/dennisj/apps/magic-academy-rpg-preview"))
SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_mcp_polish_v2.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v12.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v12.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v12.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v12.report.json"

MORPH_NAMES = ["Blink", "ConfidentSmile", "WarmSmile", "Teasing", "Surprised", "Thoughtful"]
SEMANTIC_PARTS = [
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


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 1.0 if value >= edge1 else 0.0
    t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


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
    body.name = "MatureSenpai_V12_SourcePreservedBody"
    body.data.name = "MatureSenpai_V12_SourcePreservedBodyMesh"
    for obj in meshes:
        if obj != body:
            bpy.data.objects.remove(obj, do_unlink=True)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("No armature imported from source GLB")
    armature = armatures[0]
    armature.name = "MatureSenpai_V12_ProductionArmature"
    armature.data.name = "MatureSenpai_V12_ProductionArmatureData"

    body["commercial_v12_part"] = "SourcePreservedBody"
    body["commercial_v12_retopo_layer"] = "visual-source-preserved semantic retopo handoff mesh"
    body["commercial_v12_weight_profile"] = "source skin plus explicit supplemental secondary-motion weights"
    return body, armature


def get_bounds(obj: bpy.types.Object) -> dict[str, float]:
    coords = [vertex.co for vertex in obj.data.vertices]
    min_x = min(co.x for co in coords)
    max_x = max(co.x for co in coords)
    min_y = min(co.y for co in coords)
    max_y = max(co.y for co in coords)
    min_z = min(co.z for co in coords)
    max_z = max(co.z for co in coords)
    return {
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
        "min_z": min_z,
        "max_z": max_z,
        "width": max(max_x - min_x, 0.001),
        "depth": max(max_y - min_y, 0.001),
        "height": max(max_z - min_z, 0.001),
        "center_x": (min_x + max_x) * 0.5,
        "center_y": (min_y + max_y) * 0.5,
    }


def classify_part(co: Vector) -> str:
    x, y, z = co.x, co.y, co.z
    ax = abs(x)
    if z < 0.43:
        return "Shoes"
    if z < 0.90 and ax > 0.065:
        return "Legs"
    if z < 1.18 and ax < 0.245:
        if x < -0.04:
            return "Skirt_LeftPanel"
        if x > 0.04:
            return "Skirt_RightPanel"
        return "Skirt_Center"
    if ax > 0.215 and 0.70 < z < 1.53:
        return "Arms_Hands"
    if z > 1.50:
        if y > -0.055 or ax > 0.165 or z > 1.77:
            if x < -0.055:
                return "Hair_LeftLock"
            if x > 0.055:
                return "Hair_RightLock"
            return "Hair_Back"
        return "Face_Head"
    if z > 1.18 and ax < 0.245:
        return "Torso_Camisole"
    if z < 1.25:
        return "Skirt_Center"
    return "Torso_Camisole"


def group(obj: bpy.types.Object, name: str) -> bpy.types.VertexGroup:
    vertex_group = obj.vertex_groups.get(name)
    if vertex_group is None:
        vertex_group = obj.vertex_groups.new(name=name)
    return vertex_group


def add_weight(obj: bpy.types.Object, name: str, index: int, weight: float, mode: str = "ADD") -> None:
    if weight <= 0:
        return
    group(obj, name).add([index], clamp(weight, 0.0, 1.0), mode)


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


def add_semantic_part_groups(body: bpy.types.Object) -> dict[str, int]:
    counts = {part: 0 for part in SEMANTIC_PARTS}
    for part in SEMANTIC_PARTS:
        group(body, f"Semantic_{part}")
    for vertex in body.data.vertices:
        part = classify_part(vertex.co)
        add_weight(body, f"Semantic_{part}", vertex.index, 1.0, "REPLACE")
        counts[part] += 1
    body["commercial_v12_semantic_parts"] = json.dumps(counts, sort_keys=True)
    return counts


def add_supplemental_secondary_weights(body: bpy.types.Object) -> dict[str, int]:
    counts: dict[str, int] = {}

    def bump(name: str) -> None:
        counts[name] = counts.get(name, 0) + 1

    for vertex in body.data.vertices:
        co = vertex.co
        x, y, z = co.x, co.y, co.z
        ax = abs(x)
        if z > 1.36 and (y > -0.055 or ax > 0.13 or z > 1.74):
            if x < -0.06:
                secondary = "Secondary_Hair_Left"
            elif x > 0.06:
                secondary = "Secondary_Hair_Right"
            else:
                secondary = "Secondary_Hair_Back"
            swing = clamp((1.78 - z) / 0.48, 0.04, 0.30)
            tip = clamp((1.42 - z) / 0.30, 0.0, 0.16)
            add_weight(body, secondary, vertex.index, max(0.0, swing - tip))
            add_weight(body, f"{secondary}_Tip", vertex.index, tip)
            bump(secondary)
            if tip > 0:
                bump(f"{secondary}_Tip")
            continue

        if 0.66 < z < 1.14 and ax < 0.25:
            if ax < 0.04:
                secondary = "Secondary_Skirt_Center"
            else:
                secondary = "Secondary_Skirt_Left" if x < 0 else "Secondary_Skirt_Right"
            swing = clamp((1.12 - z) / 0.52, 0.04, 0.28)
            tip = clamp((0.88 - z) / 0.26, 0.0, 0.16)
            add_weight(body, secondary, vertex.index, max(0.0, swing - tip))
            add_weight(body, f"{secondary}_Tip", vertex.index, tip)
            bump(secondary)
            if tip > 0:
                bump(f"{secondary}_Tip")

    body["commercial_v12_secondary_weight_counts"] = json.dumps(counts, sort_keys=True)
    return counts


def add_face_morphs(body: bpy.types.Object) -> dict[str, int]:
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    if body.data.shape_keys is None:
        body.shape_key_add(name="Basis")

    existing = {key.name for key in body.data.shape_keys.key_blocks}
    keys = {
        name: body.data.shape_keys.key_blocks[name] if name in existing else body.shape_key_add(name=name)
        for name in MORPH_NAMES
    }
    counts = {name: 0 for name in MORPH_NAMES}

    for index, vertex in enumerate(body.data.vertices):
        co = vertex.co
        ax = abs(co.x)
        is_front_face = co.y < -0.075 and ax < 0.185 and 1.50 < co.z < 1.79
        if not is_front_face:
            continue

        if 1.69 < co.z < 1.755 and 0.034 < ax < 0.155:
            close = smoothstep(0.034, 0.070, ax) * (1.0 - smoothstep(0.145, 0.18, ax))
            keys["Blink"].data[index].co.z -= 0.016 * close
            keys["Blink"].data[index].co.y += 0.004 * close
            counts["Blink"] += 1

        if 1.585 < co.z < 1.690 and ax < 0.165:
            corner = smoothstep(0.045, 0.150, ax)
            center = 1.0 - smoothstep(0.015, 0.080, ax)
            side = 1.0 if co.x >= 0 else -1.0
            keys["ConfidentSmile"].data[index].co.z += 0.010 * corner + 0.002 * center
            keys["ConfidentSmile"].data[index].co.x += side * 0.0025 * corner
            keys["ConfidentSmile"].data[index].co.y -= 0.003 * corner
            keys["WarmSmile"].data[index].co.z += 0.013 * corner + 0.003 * center
            keys["WarmSmile"].data[index].co.y -= 0.004 * corner
            keys["Teasing"].data[index].co.z += (0.014 if co.x > 0 else 0.006) * corner
            keys["Teasing"].data[index].co.y -= 0.004 * corner
            counts["ConfidentSmile"] += 1
            counts["WarmSmile"] += 1
            counts["Teasing"] += 1

        if 1.575 < co.z < 1.690 and ax < 0.120:
            upper = 1.0 if co.z > 1.64 else -1.0
            keys["Surprised"].data[index].co.z += upper * 0.010
            keys["Surprised"].data[index].co.y -= 0.005
            counts["Surprised"] += 1

        if 1.61 < co.z < 1.755 and ax < 0.175:
            side = -1.0 if co.x >= 0 else 1.0
            keys["Thoughtful"].data[index].co.z -= 0.0035
            keys["Thoughtful"].data[index].co.y += 0.0035
            keys["Thoughtful"].data[index].co.x += side * 0.0015
            counts["Thoughtful"] += 1

    body.data.shape_keys.use_relative = True
    body["commercial_v12_morph_vertex_counts"] = json.dumps(counts, sort_keys=True)
    body.select_set(False)
    return counts


def tune_materials(body: bpy.types.Object) -> None:
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    for material in body.data.materials:
        if not material:
            continue
        material.use_backface_culling = False
        if not material.use_nodes:
            continue
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.50
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.0
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = 1.0


def make_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Roughness" in bsdf.inputs:
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
    modifier = obj.modifiers.new("Production armature", "ARMATURE")
    modifier.object = armature
    indices = [vertex.index for vertex in obj.data.vertices]
    for bone_name, weight in weights.items():
        group(obj, bone_name).add(indices, clamp(weight, 0.0, 1.0), "ADD")
    obj["commercial_v12_part"] = name.replace("MatureSenpai_V12_", "")
    obj["commercial_v12_retopo_layer"] = "authored lightweight visible accessory runtime part"
    return obj


def add_visible_detail_parts(armature: bpy.types.Object) -> tuple[bpy.types.Collection, list[bpy.types.Object]]:
    collection = bpy.data.collections.new("MatureSenpai_CommercialV12_DetailParts")
    bpy.context.scene.collection.children.link(collection)
    ivory = make_material("CommercialV12_IvoryFabricDetail", (0.96, 0.91, 0.82, 1.0), 0.52)
    gold = make_material("CommercialV12_SoftGoldTrim", (0.95, 0.66, 0.25, 1.0), 0.38)
    gem = make_material("CommercialV12_PurplePendantGem", (0.50, 0.33, 0.86, 1.0), 0.32)
    details: list[bpy.types.Object] = []

    strap_specs = [
        (
            "MatureSenpai_V12_CamisoleStrap_Left",
            [(-0.128, -0.224, 1.535), (-0.116, -0.225, 1.535), (-0.076, -0.218, 1.365), (-0.088, -0.218, 1.365)],
            "Secondary_Strap_Left",
        ),
        (
            "MatureSenpai_V12_CamisoleStrap_Right",
            [(0.116, -0.225, 1.535), (0.128, -0.224, 1.535), (0.088, -0.218, 1.365), (0.076, -0.218, 1.365)],
            "Secondary_Strap_Right",
        ),
    ]
    for name, vertices, secondary in strap_specs:
        details.append(create_skinned_mesh(
            name,
            vertices,
            [[0, 1, 2, 3]],
            [ivory],
            [0],
            armature,
            {"Chest": 0.60, secondary: 0.40},
            collection,
        ))

    choker_vertices = [
        (-0.098, -0.224, 1.486),
        (0.098, -0.224, 1.486),
        (0.092, -0.226, 1.462),
        (-0.092, -0.226, 1.462),
        (-0.018, -0.235, 1.456),
        (0.018, -0.235, 1.456),
        (0.000, -0.242, 1.414),
    ]
    choker_faces = [
        [0, 1, 2, 3],
        [4, 5, 6],
    ]
    details.append(create_skinned_mesh(
        "MatureSenpai_V12_ChokerPendant",
        choker_vertices,
        choker_faces,
        [gold, gem],
        [0, 1],
        armature,
        {"Neck": 0.48, "Chest": 0.16, "Secondary_Pendant": 0.36},
        collection,
    ))
    return collection, details


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(body: bpy.types.Object, details: list[bpy.types.Object]) -> None:
    bpy.ops.object.light_add(type="AREA", location=(0, -3.2, 3.4))
    key = bpy.context.object
    key.name = "Preview_KeyLight"
    key.data.energy = 560
    key.data.size = 4.2

    bpy.ops.object.light_add(type="POINT", location=(-1.8, -1.8, 1.45))
    fill = bpy.context.object
    fill.name = "Preview_WarmFill"
    fill.data.energy = 90
    fill.data.color = (1.0, 0.82, 0.62)

    bpy.ops.object.camera_add(location=(0, -4.05, 1.28))
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


def list_morph_targets(obj: bpy.types.Object) -> list[str]:
    if not obj.data.shape_keys:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]


def summarize_vertex_group_counts(obj: bpy.types.Object, prefixes: tuple[str, ...]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for vertex in obj.data.vertices:
        for assignment in vertex.groups:
            name = obj.vertex_groups[assignment.group].name
            if prefixes and not name.startswith(prefixes):
                continue
            counts[name] = counts.get(name, 0) + 1
    return dict(sorted(counts.items()))


def summarize_secondary_bones(armature: bpy.types.Object) -> dict[str, list[str]]:
    secondary_bones = [bone.name for bone in armature.data.bones if "Secondary" in bone.name]
    return {
        "all": secondary_bones,
        "hair": [name for name in secondary_bones if "Hair" in name],
        "skirt": [name for name in secondary_bones if "Skirt" in name],
        "accessory": [name for name in secondary_bones if "Strap" in name or "Pendant" in name or "Choker" in name],
    }


def export_outputs(body: bpy.types.Object, details: list[bpy.types.Object], armature: bpy.types.Object) -> None:
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))

    for obj in bpy.context.scene.objects:
        obj.select_set(obj == armature or obj == body or obj in details)
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


def write_report(
    body: bpy.types.Object,
    details: list[bpy.types.Object],
    armature: bpy.types.Object,
    semantic_counts: dict[str, int],
    secondary_weight_counts: dict[str, int],
    morph_counts: dict[str, int],
) -> None:
    morph_targets = list_morph_targets(body)
    secondary = summarize_secondary_bones(armature)
    total_faces = len(body.data.polygons) + sum(len(obj.data.polygons) for obj in details)
    semantic_group_counts = summarize_vertex_group_counts(body, ("Semantic_",))
    secondary_group_counts = summarize_vertex_group_counts(body, ("Secondary_",))
    acceptance_checks = {
        "preservesHunyuanVisibleSource": body.name == "MatureSenpai_V12_SourcePreservedBody" and len(body.data.polygons) >= 50000,
        "hasSemanticPartGroups": len([name for name in semantic_group_counts if name.startswith("Semantic_")]) >= len(SEMANTIC_PARTS),
        "hasSixNamedExpressionMorphs": sorted(morph_targets) == sorted(MORPH_NAMES),
        "hasMorphAffectedVertices": all(count > 0 for count in morph_counts.values()),
        "hasHairSecondaryBones": len(secondary["hair"]) >= 6,
        "hasSkirtSecondaryBones": len(secondary["skirt"]) >= 5,
        "hasSecondaryWeights": len(secondary_group_counts) >= 8,
        "hasVisibleDetailParts": len(details) >= 3,
        "webRuntimeBudgetTarget": total_faces <= 65000,
    }
    report = {
        "assetId": "mature-senpai-commercial-v12",
        "characterId": "mature_senpai",
        "status": "source-preserving-retopo-and-motion-preview",
        "source": "public/assets/models/mature_senpai_mcp_polish_v2.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v12.blend",
        "output": "public/assets/models/mature_senpai_commercial_v12.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v12.png",
        "generatedBy": "remote Blender headless + assets/characters/mature_senpai/tools/build_final_v12.py",
        "runtime": {
            "defaultAsset": True,
            "format": "glb",
            "url": "/assets/models/mature_senpai_commercial_v12.glb",
            "thumbnailUrl": "/assets/models/mature_senpai_commercial_v12.png",
            "fallbackAssetId": "mature-senpai-mcp-polish-v2",
            "threeRuntimeFeatures": [
                "SkinnedMesh",
                "AnimationMixer clips",
                "morphTargetInfluences",
                "Secondary_* bone spring overlay",
            ],
        },
        "productionFlags": {
            "sourcePreservedVisibleMesh": True,
            "semanticPartGroups": True,
            "splitRuntimeAccessoryParts": True,
            "facialMorphs": True,
            "explicitSupplementalWeights": True,
            "hairSecondaryBones": True,
            "skirtSecondaryBones": True,
            "accessorySecondaryBones": True,
            "webRuntimeReady": True,
        },
        "bodyMesh": {
            "name": body.name,
            "vertices": len(body.data.vertices),
            "faces": len(body.data.polygons),
            "materials": [material.name for material in body.data.materials if material],
            "morphTargets": morph_targets,
        },
        "detailParts": [
            {
                "name": obj.name,
                "vertices": len(obj.data.vertices),
                "faces": len(obj.data.polygons),
                "materials": [material.name for material in obj.data.materials if material],
            }
            for obj in details
        ],
        "semanticParts": semantic_counts,
        "semanticVertexGroups": semantic_group_counts,
        "secondaryWeightCounts": secondary_weight_counts,
        "secondaryVertexGroups": secondary_group_counts,
        "armatureBones": [bone.name for bone in armature.data.bones],
        "secondaryRig": secondary,
        "morphTargets": {body.name: morph_targets},
        "morphVertexCounts": morph_counts,
        "acceptanceChecks": acceptance_checks,
        "runtimeDecision": {
            "defaultAsset": True,
            "fallbackAssetId": "mature-senpai-mcp-polish-v2",
            "reason": "v12 keeps the mcp-polish-v2 visible likeness as the runtime body, then layers morph targets, secondary-motion bones, semantic retopo groups, and lightweight visible accessory parts on top. This avoids the v11 problem where physical splitting and procedural replacement reduced the character's natural JRPG/anime silhouette.",
        },
        "completedPasses": [
            "preserved the mcp-polish-v2 body, UVs, texture atlas, and silhouette",
            "added semantic vertex groups for face, hair locks, torso, arms, skirt panels, legs, and shoes",
            "added Blink, ConfidentSmile, WarmSmile, Teasing, Surprised, and Thoughtful morph targets directly on the preserved body mesh",
            "added supplemental Secondary_* weights for long hair and skirt regions without removing the source skin",
            "added strap, pendant, hair-tip, and skirt-tip secondary bones recognized by CharacterModel3D",
            "added visible skinned camisole straps, choker, and pendant as separate runtime detail parts",
            "exported GLB with skins, morphs, and animations",
        ],
        "limitations": [
            "This is a source-preserving hybrid retopo layer, not a full artist-authored quad retopology.",
            "Physical runtime splitting is limited to lightweight accessories; body/hair/outfit remain one visible source mesh to preserve likeness.",
            "Weights are generated by authored profiles, not manually brush-painted in Blender.",
            "Facial morphs are subtle generated deltas, not sculpted expression blendshapes over a dedicated face topology.",
            "Final commercial JRPG quality still needs manual quad retopo, UV cleanup, texture repaint, and artist expression sculpting.",
        ],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> dict[str, Any]:
    clean_scene()
    body, armature = import_source()
    add_secondary_detail_bones(armature)
    semantic_counts = add_semantic_part_groups(body)
    secondary_weight_counts = add_supplemental_secondary_weights(body)
    morph_counts = add_face_morphs(body)
    tune_materials(body)
    _collection, details = add_visible_detail_parts(armature)
    render_preview(body, details)
    export_outputs(body, details, armature)
    write_report(body, details, armature, semantic_counts, secondary_weight_counts, morph_counts)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "bodyFaces": len(body.data.polygons),
        "detailParts": len(details),
        "morphs": list_morph_targets(body),
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

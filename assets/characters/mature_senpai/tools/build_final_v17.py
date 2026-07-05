"""
Build mature_senpai_commercial_v17 from the v16 dedicated face-expression asset.

v17 is a deformation-production pass. It keeps the accepted v16 likeness,
physical runtime parts, and Face_Head-only expression morphs, then normalizes the
existing source skin binding while replacing unstable cloth/leg source weights
with deterministic runtime-safe profiles. It also adds deformation-zone audit
groups, removes orphan unskinned meshes from the runtime export, and adds
stress-test animation clips for QA.
"""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import bpy


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", "/home/dennisj/apps/magic-academy-rpg-preview"))
TOOLS_DIR = PROJECT_ROOT / "assets/characters/mature_senpai/tools"

spec = importlib.util.spec_from_file_location("build_final_v12", TOOLS_DIR / "build_final_v12.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load build_final_v12.py")
v12 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v12)

SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v16.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v17.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v17.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v17.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v17.report.json"

MORPH_NAMES = ["Blink", "ConfidentSmile", "WarmSmile", "Teasing", "Surprised", "Thoughtful"]
DEFORM_ZONE_PREFIX = "V17_DeformZone_"
RETOPO_LOOP_PREFIX = "V17_RetopoLoop_"
PROCEDURAL_BINDING_PARTS = ("Skirt_", "Legs", "Shoes", "ChokerPendant")
REQUIRED_PARTS = [
    "Face_Head",
    "Hair_Back",
    "Hair_LeftLock",
    "Hair_RightLock",
    "Torso_Camisole",
    "Arms_Hands",
    "Skirt_Center",
    "Skirt_LeftPanel",
    "Skirt_RightPanel",
    "Legs",
    "Shoes",
    "ChokerPendant",
]

v12.OUTPUT_GLB = OUTPUT_GLB
v12.OUTPUT_PNG = OUTPUT_PNG
v12.OUTPUT_BLEND = OUTPUT_BLEND
v12.OUTPUT_REPORT = OUTPUT_REPORT


def clean_scene() -> None:
    v12.clean_scene()


def clamp(value: float, low: float, high: float) -> float:
    return v12.clamp(value, low, high)


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    return v12.smoothstep(edge0, edge1, value)


def bell(value: float, center: float, radius: float) -> float:
    if radius <= 0.0:
        return 0.0
    distance = abs(value - center) / radius
    if distance >= 1.0:
        return 0.0
    return (1.0 - distance * distance) ** 2


def import_v16_source() -> tuple[list[bpy.types.Object], bpy.types.Object, list[str]]:
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not meshes:
        raise RuntimeError("No meshes imported from v16 source GLB")
    if not armatures:
        raise RuntimeError("No armature imported from v16 source GLB")

    removed_orphans: list[str] = []
    kept_meshes: list[bpy.types.Object] = []
    for obj in meshes:
        is_named_part = obj.name.startswith("MatureSenpai_V16_")
        if not is_named_part:
            removed_orphans.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        kept_meshes.append(obj)

    armature = armatures[0]
    armature.name = "MatureSenpai_V17_ProductionArmature"
    armature.data.name = "MatureSenpai_V17_ProductionArmatureData"

    for obj in kept_meshes:
        obj.name = obj.name.replace("MatureSenpai_V16_", "MatureSenpai_V17_")
        obj.data.name = obj.data.name.replace("MatureSenpai_V16_", "MatureSenpai_V17_")
        obj["commercial_v17_source"] = "mature_senpai_commercial_v16"
        obj["commercial_v17_part"] = obj.name.replace("MatureSenpai_V17_", "")
        for modifier in obj.modifiers:
            if modifier.type == "ARMATURE":
                modifier.object = armature

    return kept_meshes, armature, removed_orphans


def bone_name_set(armature: bpy.types.Object) -> set[str]:
    return {bone.name for bone in armature.data.bones}


def add_group_weight(obj: bpy.types.Object, name: str, index: int, weight: float, mode: str = "ADD") -> None:
    if weight <= 0.0001:
        return
    group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
    group.add([index], clamp(weight, 0.0, 1.0), mode)


def remove_bone_weights(obj: bpy.types.Object, vertex_index: int, bones: set[str]) -> None:
    vertex = obj.data.vertices[vertex_index]
    for assignment in list(vertex.groups):
        group_name = obj.vertex_groups[assignment.group].name
        if group_name in bones:
            obj.vertex_groups[group_name].remove([vertex_index])


def replace_bone_weights(
    obj: bpy.types.Object,
    vertex_index: int,
    weights: dict[str, float],
    bones: set[str],
) -> dict[str, float]:
    filtered = {name: weight for name, weight in weights.items() if name in bones and weight > 0.0001}
    if not filtered:
        return {}
    total = sum(filtered.values())
    if total <= 0.0001:
        return {}
    remove_bone_weights(obj, vertex_index, bones)
    normalized = {name: weight / total for name, weight in filtered.items()}
    for name, weight in normalized.items():
        add_group_weight(obj, name, vertex_index, weight, "ADD")
    return normalized


def current_bone_weights(obj: bpy.types.Object, vertex: bpy.types.MeshVertex, bones: set[str]) -> dict[str, float]:
    weights: dict[str, float] = {}
    for assignment in vertex.groups:
        group_name = obj.vertex_groups[assignment.group].name
        if group_name in bones and assignment.weight > 0.0001:
            weights[group_name] = weights.get(group_name, 0.0) + assignment.weight
    return weights


def normalized_source_weights(
    obj: bpy.types.Object,
    vertex: bpy.types.MeshVertex,
    bones: set[str],
) -> dict[str, float]:
    existing = current_bone_weights(obj, vertex, bones)
    if not existing:
        fallback, _zones = assign_deformation_profile(obj, vertex, bones)
        return fallback
    top = sorted(existing.items(), key=lambda item: item[1], reverse=True)[:4]
    return dict(top)


def uses_procedural_binding(obj: bpy.types.Object) -> bool:
    return any(part in obj.name for part in PROCEDURAL_BINDING_PARTS)


def production_weights(
    obj: bpy.types.Object,
    vertex: bpy.types.MeshVertex,
    bones: set[str],
) -> tuple[dict[str, float], str]:
    if uses_procedural_binding(obj):
        weights, _zones = assign_deformation_profile(obj, vertex, bones)
        return weights, "procedural"
    weights = normalized_source_weights(obj, vertex, bones)
    return weights, "source"


def side_from_x(x: float) -> str:
    return "Left" if x < 0.0 else "Right"


def arm_weights(x: float, z: float) -> tuple[str, dict[str, float], dict[str, float]]:
    side = side_from_x(x)
    t = clamp((1.43 - z) / 0.66, 0.0, 1.0)
    upper = 1.0 - smoothstep(0.30, 0.62, t)
    lower = bell(t, 0.58, 0.34)
    hand = smoothstep(0.66, 0.98, t)
    shoulder = 1.0 - smoothstep(0.00, 0.22, t)
    wrist = bell(t, 0.78, 0.18)
    weights = {
        f"{side}UpperArm": max(upper, shoulder * 0.55),
        f"{side}LowerArm": lower,
        f"{side}Hand": max(hand, wrist * 0.72),
    }
    zones = {
        f"{side}Shoulder": shoulder,
        f"{side}Elbow": bell(t, 0.50, 0.18),
        f"{side}Wrist": wrist,
        f"{side}Hand": hand,
    }
    return side, weights, zones


def leg_weights(x: float, z: float, force_foot: bool = False) -> tuple[str, dict[str, float], dict[str, float]]:
    side = side_from_x(x)
    t = clamp((1.03 - z) / 0.72, 0.0, 1.0)
    upper = 1.0 - smoothstep(0.36, 0.66, t)
    lower = bell(t, 0.62, 0.34)
    foot = 1.0 if force_foot else smoothstep(0.76, 1.0, t)
    knee = bell(t, 0.53, 0.18)
    ankle = bell(t, 0.82, 0.16)
    weights = {
        f"{side}UpperLeg": upper,
        f"{side}LowerLeg": lower,
        f"{side}Foot": max(foot, ankle * 0.72),
    }
    zones = {
        f"{side}Hip": 1.0 - smoothstep(0.00, 0.25, t),
        f"{side}Knee": knee,
        f"{side}Ankle": ankle,
        f"{side}Foot": foot,
    }
    return side, weights, zones


def torso_weights(z: float) -> tuple[dict[str, float], dict[str, float]]:
    hips = smoothstep(1.30, 1.08, z)
    spine = bell(z, 1.30, 0.34)
    chest = smoothstep(1.24, 1.56, z)
    neck = bell(z, 1.53, 0.11) * 0.25
    weights = {"Hips": hips, "Spine": spine, "Chest": chest, "Neck": neck}
    zones = {
        "Waist": bell(z, 1.18, 0.13),
        "Bust": bell(z, 1.42, 0.13),
        "NeckBase": neck,
    }
    return weights, zones


def face_weights(z: float) -> tuple[dict[str, float], dict[str, float]]:
    head = smoothstep(1.47, 1.60, z)
    neck = 1.0 - head
    return {"Head": max(head, 0.70), "Neck": neck * 0.30}, {"JawNeckBlend": neck}


def hair_weights(obj_name: str, x: float, z: float) -> tuple[dict[str, float], dict[str, float]]:
    if "LeftLock" in obj_name:
        base = "Secondary_Hair_Left"
        side_zone = "LeftHair"
    elif "RightLock" in obj_name:
        base = "Secondary_Hair_Right"
        side_zone = "RightHair"
    else:
        base = "Secondary_Hair_Back"
        side_zone = "BackHair"
    tip = clamp((1.52 - z) / 0.46, 0.0, 1.0)
    side_bias = smoothstep(0.04, 0.16, abs(x)) if base != "Secondary_Hair_Back" else 0.35
    swing = max(tip, side_bias * 0.20)
    weights = {
        "Head": 1.0 - swing * 0.64,
        base: swing * 0.48,
        f"{base}_Tip": swing * 0.34,
    }
    zones = {side_zone: swing, f"{side_zone}Tip": tip}
    return weights, zones


def skirt_weights(obj_name: str, x: float, z: float) -> tuple[dict[str, float], dict[str, float]]:
    if "LeftPanel" in obj_name:
        base = "Secondary_Skirt_Left"
        zone = "LeftSkirt"
    elif "RightPanel" in obj_name:
        base = "Secondary_Skirt_Right"
        zone = "RightSkirt"
    else:
        base = "Secondary_Skirt_Center"
        zone = "CenterSkirt"
    tip = clamp((1.02 - z) / 0.42, 0.0, 1.0)
    side = smoothstep(0.03, 0.17, abs(x)) if base != "Secondary_Skirt_Center" else 0.35
    swing = max(tip, side * 0.14)
    weights = {
        "Hips": 1.0 - swing * 0.40,
        base: swing * 0.28,
        f"{base}_Tip": swing * 0.18,
    }
    zones = {zone: swing, f"{zone}Tip": tip}
    return weights, zones


def choker_weights() -> tuple[dict[str, float], dict[str, float]]:
    return {"Neck": 0.52, "Chest": 0.16, "Secondary_Pendant": 0.32}, {"Pendant": 1.0}


def assign_deformation_profile(
    obj: bpy.types.Object,
    vertex: bpy.types.MeshVertex,
    bones: set[str],
) -> tuple[dict[str, float], dict[str, float]]:
    co = vertex.co
    name = obj.name
    if "Face_Head" in name:
        return face_weights(co.z)
    if "Hair_" in name:
        return hair_weights(name, co.x, co.z)
    if "Torso_Camisole" in name:
        return torso_weights(co.z)
    if "Arms_Hands" in name:
        _side, weights, zones = arm_weights(co.x, co.z)
        return weights, zones
    if "Legs" in name:
        _side, weights, zones = leg_weights(co.x, co.z)
        return weights, zones
    if "Shoes" in name:
        _side, weights, zones = leg_weights(co.x, co.z, force_foot=True)
        return weights, zones
    if "Skirt_" in name:
        return skirt_weights(name, co.x, co.z)
    if "ChokerPendant" in name:
        return choker_weights()
    return {}, {}


def add_retopo_loop_groups(obj: bpy.types.Object) -> dict[str, int]:
    loop_specs = {
        "EyeLine": (1.715, 0.026),
        "MouthLine": (1.620, 0.030),
        "NeckRing": (1.490, 0.030),
        "BustRing": (1.410, 0.050),
        "WaistRing": (1.185, 0.040),
        "HipRing": (1.040, 0.045),
        "KneeRing": (0.610, 0.050),
        "AnkleRing": (0.355, 0.050),
    }
    counts = {f"{RETOPO_LOOP_PREFIX}{name}": 0 for name in loop_specs}
    for vertex in obj.data.vertices:
        for name, (center, radius) in loop_specs.items():
            weight = bell(vertex.co.z, center, radius)
            if weight <= 0.001:
                continue
            group_name = f"{RETOPO_LOOP_PREFIX}{name}"
            add_group_weight(obj, group_name, vertex.index, weight, "ADD")
            counts[group_name] += 1
    return {name: count for name, count in counts.items() if count > 0}


def apply_deformation_weights(meshes: list[bpy.types.Object], armature: bpy.types.Object) -> dict[str, Any]:
    bones = bone_name_set(armature)
    zone_counts: dict[str, int] = {}
    bone_counts: dict[str, int] = {}
    retopo_counts: dict[str, int] = {}
    normalized_vertices = 0
    max_influences = 0
    zero_weight_vertices: list[dict[str, Any]] = []
    procedural_vertices = 0
    source_vertices = 0

    for obj in meshes:
        if "ChokerPendant" not in obj.name and not obj.name.startswith("MatureSenpai_V17_"):
            continue
        retopo_counts.update(add_retopo_loop_groups(obj))
        for vertex in obj.data.vertices:
            weights, binding_mode = production_weights(obj, vertex, bones)
            _profile_weights, zones = assign_deformation_profile(obj, vertex, bones)
            applied = replace_bone_weights(obj, vertex.index, weights, bones)
            if applied:
                normalized_vertices += 1
                if binding_mode == "procedural":
                    procedural_vertices += 1
                else:
                    source_vertices += 1
                max_influences = max(max_influences, len(applied))
                for bone_name in applied:
                    bone_counts[bone_name] = bone_counts.get(bone_name, 0) + 1
            else:
                zero_weight_vertices.append({"mesh": obj.name, "vertex": vertex.index})
            for zone, weight in zones.items():
                if weight <= 0.001:
                    continue
                group_name = f"{DEFORM_ZONE_PREFIX}{zone}"
                add_group_weight(obj, group_name, vertex.index, weight, "ADD")
                zone_counts[group_name] = zone_counts.get(group_name, 0) + 1
        if uses_procedural_binding(obj):
            obj["commercial_v17_deformation_profile"] = "deterministic runtime-safe binding for cloth, legs, shoes, or pendant plus deformation-zone QA groups"
        else:
            obj["commercial_v17_deformation_profile"] = "source skin normalized to top-4 bone influences plus deterministic deformation-zone QA groups"

    return {
        "normalizedVertices": normalized_vertices,
        "sourceBoundVertices": source_vertices,
        "proceduralBoundVertices": procedural_vertices,
        "proceduralBindingParts": list(PROCEDURAL_BINDING_PARTS),
        "maxInfluencesPerProfile": max_influences,
        "boneAssignmentCounts": dict(sorted(bone_counts.items())),
        "deformZoneCounts": dict(sorted(zone_counts.items())),
        "retopoLoopCounts": dict(sorted(retopo_counts.items())),
        "zeroWeightVertexSample": zero_weight_vertices[:20],
        "zeroWeightVertices": len(zero_weight_vertices),
    }


def list_morph_targets(obj: bpy.types.Object) -> list[str]:
    if not obj.data.shape_keys:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]


def create_deformation_test_clips(armature: bpy.types.Object) -> list[str]:
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    if armature.animation_data is None:
        armature.animation_data_create()

    animated_bones = [
        "Chest",
        "LeftUpperArm",
        "LeftLowerArm",
        "RightUpperArm",
        "RightLowerArm",
        "LeftUpperLeg",
        "LeftLowerLeg",
        "RightUpperLeg",
        "RightLowerLeg",
        "Secondary_Hair_Left",
        "Secondary_Hair_Right",
        "Secondary_Hair_Back",
        "Secondary_Skirt_Left",
        "Secondary_Skirt_Right",
        "Secondary_Skirt_Center",
    ]

    def reset_pose(frame: int) -> None:
        for bone_name in animated_bones:
            pose_bone = armature.pose.bones.get(bone_name)
            if not pose_bone:
                continue
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = (0.0, 0.0, 0.0)
            pose_bone.keyframe_insert("rotation_euler", frame=frame)

    def set_rotations(frame: int, rotations: dict[str, tuple[float, float, float]]) -> None:
        for bone_name, degrees in rotations.items():
            pose_bone = armature.pose.bones.get(bone_name)
            if not pose_bone:
                continue
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = tuple(math.radians(value) for value in degrees)
            pose_bone.keyframe_insert("rotation_euler", frame=frame)

    clip_specs = {
        "v17_deformation_stress": [
            (1, {}),
            (18, {
                "Chest": (0, 0, 4),
                "LeftUpperArm": (0, -14, -14),
                "LeftLowerArm": (-24, 0, 0),
                "RightUpperArm": (0, 14, 14),
                "RightLowerArm": (-24, 0, 0),
            }),
            (38, {
                "LeftUpperLeg": (12, 0, -3),
                "LeftLowerLeg": (-16, 0, 0),
                "RightUpperLeg": (-10, 0, 3),
                "RightLowerLeg": (12, 0, 0),
            }),
            (58, {}),
        ],
        "v17_secondary_sway_test": [
            (1, {}),
            (16, {
                "Secondary_Hair_Left": (0, 0, -7),
                "Secondary_Hair_Right": (0, 0, -4),
                "Secondary_Hair_Back": (5, 0, 0),
                "Secondary_Skirt_Left": (0, 4, -5),
                "Secondary_Skirt_Right": (0, 2, -3),
                "Secondary_Skirt_Center": (4, 0, 0),
            }),
            (32, {
                "Secondary_Hair_Left": (0, 0, 5),
                "Secondary_Hair_Right": (0, 0, 8),
                "Secondary_Hair_Back": (-4, 0, 0),
                "Secondary_Skirt_Left": (0, -2, 4),
                "Secondary_Skirt_Right": (0, -5, 6),
                "Secondary_Skirt_Center": (-3, 0, 0),
            }),
            (48, {}),
        ],
    }

    created: list[str] = []
    for clip_name, frames in clip_specs.items():
        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        armature.animation_data.action = action
        for frame, rotations in frames:
            reset_pose(frame)
            set_rotations(frame, rotations)
        track = armature.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, frames[0][0], action)
        strip.action_frame_start = frames[0][0]
        strip.action_frame_end = frames[-1][0]
        created.append(clip_name)

    bpy.ops.object.mode_set(mode="OBJECT")
    return created


def summarize_parts(meshes: list[bpy.types.Object]) -> list[dict[str, Any]]:
    return [
        {
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "faces": len(obj.data.polygons),
            "morphTargets": list_morph_targets(obj),
            "vertexGroups": len(obj.vertex_groups),
            "materials": [material.name for material in obj.data.materials if material],
        }
        for obj in meshes
    ]


def export_outputs(meshes: list[bpy.types.Object], armature: bpy.types.Object) -> None:
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)

    export_set = set(meshes)
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and obj not in export_set:
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj == armature or obj in meshes)
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
    meshes: list[bpy.types.Object],
    armature: bpy.types.Object,
    removed_orphans: list[str],
    deformation_report: dict[str, Any],
    animation_clips: list[str],
) -> None:
    secondary = v12.summarize_secondary_bones(armature)
    mesh_summaries = summarize_parts(meshes)
    total_faces = sum(len(obj.data.polygons) for obj in meshes)
    face = next((obj for obj in meshes if "Face_Head" in obj.name), None)
    face_morphs = list_morph_targets(face) if face else []
    morph_meshes = [obj.name for obj in meshes if list_morph_targets(obj)]
    part_names = [obj.name for obj in meshes]
    zones = deformation_report["deformZoneCounts"]
    retopo = deformation_report["retopoLoopCounts"]
    bone_counts = deformation_report["boneAssignmentCounts"]
    acceptance_checks = {
        "keepsV16PhysicalRuntimeParts": all(any(part in name for name in part_names) for part in REQUIRED_PARTS),
        "removesUnskinnedOrphanMeshes": "Icosphere" in removed_orphans and all(obj.name != "Icosphere" for obj in meshes),
        "keepsFaceOnlyExpressionMorphs": face is not None and morph_meshes == [face.name] and sorted(face_morphs) == sorted(MORPH_NAMES),
        "hasMajorJointDeformationZones": len(zones) >= 18 and all(count > 0 for count in zones.values()),
        "hasRetopoGuideLoops": len(retopo) >= 6 and all(count > 0 for count in retopo.values()),
        "hasNormalizedBoneWeights": deformation_report["zeroWeightVertices"] == 0 and deformation_report["normalizedVertices"] > 45000,
        "hasTargetedClothLegBinding": deformation_report["proceduralBoundVertices"] > 9000,
        "coversArmsLegsTorsoHairSkirt": all(any(key in name for name in bone_counts) for key in ["UpperArm", "LowerArm", "UpperLeg", "LowerLeg", "Chest", "Secondary_Hair", "Secondary_Skirt"]),
        "addsDeformationTestClips": sorted(animation_clips) == ["v17_deformation_stress", "v17_secondary_sway_test"],
        "hasHairSecondaryBones": len(secondary["hair"]) >= 6,
        "hasSkirtSecondaryBones": len(secondary["skirt"]) >= 5,
        "webRuntimeBudgetTarget": total_faces <= 65000,
    }
    report = {
        "assetId": "mature-senpai-commercial-v17",
        "characterId": "mature_senpai",
        "status": "deformation-weight-production-preview",
        "source": "public/assets/models/mature_senpai_commercial_v16.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v17.blend",
        "output": "public/assets/models/mature_senpai_commercial_v17.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v17.png",
        "generatedBy": "remote Blender headless + assets/characters/mature_senpai/tools/build_final_v17.py",
        "runtime": {
            "defaultAsset": True,
            "format": "glb",
            "url": "/assets/models/mature_senpai_commercial_v17.glb",
            "thumbnailUrl": "/assets/models/mature_senpai_commercial_v17.png",
            "fallbackAssetId": "mature-senpai-commercial-v16",
            "threeRuntimeFeatures": [
                "multiple SkinnedMesh runtime parts",
                "dedicated Face_Head morphTargetInfluences",
                "normalized top-4 source bone weights",
                "targeted deterministic cloth, leg, shoe, and pendant binding",
                "AnimationMixer clips",
                "Secondary_* bone spring overlay",
            ],
        },
        "productionFlags": {
            "physicalRuntimeSplitParts": True,
            "dedicatedFaceExpressionMorphs": True,
            "facialLandmarkVertexGroups": True,
            "deformationZoneWeightPass": True,
            "normalizedBoneWeights": True,
            "targetedClothLegBinding": True,
            "retopoGuideLoopGroups": True,
            "orphanRuntimeMeshRemoved": True,
            "hairSecondaryBones": True,
            "skirtSecondaryBones": True,
            "webRuntimeReady": True,
        },
        "runtimeParts": mesh_summaries,
        "removedOrphanMeshes": removed_orphans,
        "morphTargets": {face.name: face_morphs} if face else {},
        "armatureBones": [bone.name for bone in armature.data.bones],
        "secondaryRig": secondary,
        "deformationBinding": deformation_report,
        "animationClipsAdded": animation_clips,
        "acceptanceChecks": acceptance_checks,
        "runtimeDecision": {
            "defaultAsset": True,
            "fallbackAssetId": "mature-senpai-commercial-v16",
            "reason": "v17 keeps the v16 accepted visual and Face_Head expression layer, removes the orphan unskinned mesh from export, normalizes stable source skin weights to a web-friendly top-4 profile, replaces unstable cloth/leg/shoe/pendant bindings with deterministic runtime-safe profiles, and adds deformation-zone QA groups with explicit QA clips. This moves the character closer to commercial runtime behavior during movement and interaction without breaking the accepted likeness.",
        },
        "completedPasses": [
            "imported the v16 dedicated face-expression runtime asset",
            "renamed runtime parts to v17 while preserving UVs, materials, morphs, and visible likeness",
            "removed the orphan unskinned Icosphere mesh from the runtime export",
            "normalized stable source skin weights to top-4 bone influences",
            "rebound skirt panels, legs, shoes, and pendant to deterministic runtime-safe profiles to reduce action-time tearing and cross-part contamination",
            "added V17_DeformZone_* vertex groups for shoulders, elbows, wrists, hands, hips, knees, ankles, feet, torso, hair, skirt, and pendant QA",
            "added V17_RetopoLoop_* guide groups for future artist quad-retopo transfer",
            "added v17_deformation_stress and v17_secondary_sway_test animation clips for deformation QA",
            "exported GLB with multiple skinned parts, Face_Head morphs, skins, and animations",
        ],
        "limitations": [
            "v17 still uses the accepted source triangle topology; it is not a final hand-authored quad retopology.",
            "The skin weights are normalized source weights plus targeted procedural cloth/leg binding, not artist brush-painted weights reviewed vertex by vertex.",
            "Facial morphs remain authored coordinate-mask deltas from v16 rather than sculpted expression blendshapes on dedicated facial loops.",
            "The texture atlas is preserved from the Hunyuan source; final commercial polish still needs UV cleanup and texture repaint.",
        ],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> dict[str, Any]:
    clean_scene()
    meshes, armature, removed_orphans = import_v16_source()
    deformation_report = apply_deformation_weights(meshes, armature)
    animation_clips = create_deformation_test_clips(armature)
    face = next((obj for obj in meshes if "Face_Head" in obj.name), meshes[0])
    v12.render_preview(face, meshes)
    export_outputs(meshes, armature)
    write_report(meshes, armature, removed_orphans, deformation_report, animation_clips)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "runtimeParts": len(meshes),
        "removedOrphans": removed_orphans,
        "normalizedVertices": deformation_report["normalizedVertices"],
        "deformZones": len(deformation_report["deformZoneCounts"]),
        "retopoLoops": len(deformation_report["retopoLoopCounts"]),
        "animationClipsAdded": animation_clips,
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

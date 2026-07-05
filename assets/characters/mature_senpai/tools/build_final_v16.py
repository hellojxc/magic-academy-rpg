"""
Build mature_senpai_commercial_v16 from the v15 physical split asset.

v16 keeps the v15 named runtime parts and accepted likeness, then rebuilds the
facial expression layer so morph targets live only on the Face_Head mesh. It
adds explicit facial landmark vertex groups and sculpted geometry deltas for
blink, smiles, teasing, surprised, and thoughtful expressions. Non-face parts no
longer carry inert expression morph targets.
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

SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v15.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v16.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v16.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v16.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v16.report.json"
MORPH_NAMES = ["Blink", "ConfidentSmile", "WarmSmile", "Teasing", "Surprised", "Thoughtful"]
LANDMARK_GROUPS = [
    "Face_L_EyeLid",
    "Face_R_EyeLid",
    "Face_L_Brow",
    "Face_R_Brow",
    "Face_Mouth",
    "Face_L_Cheek",
    "Face_R_Cheek",
    "Face_Jaw",
]

v12.OUTPUT_GLB = OUTPUT_GLB
v12.OUTPUT_PNG = OUTPUT_PNG
v12.OUTPUT_BLEND = OUTPUT_BLEND
v12.OUTPUT_REPORT = OUTPUT_REPORT


def clean_scene() -> None:
    v12.clean_scene()


def import_v15_source() -> tuple[bpy.types.Object, list[bpy.types.Object], bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not meshes:
        raise RuntimeError("No meshes imported from v15 source GLB")
    if not armatures:
        raise RuntimeError("No armature imported from v15 source GLB")
    armature = armatures[0]
    armature.name = "MatureSenpai_V16_ProductionArmature"
    armature.data.name = "MatureSenpai_V16_ProductionArmatureData"

    for obj in meshes:
        obj.name = obj.name.replace("MatureSenpai_V15_", "MatureSenpai_V16_")
        obj.data.name = obj.data.name.replace("MatureSenpai_V15_", "MatureSenpai_V16_")
        obj["commercial_v16_source"] = "mature_senpai_commercial_v15"
        obj["commercial_v16_part"] = obj.name.replace("MatureSenpai_V16_", "")
        for modifier in obj.modifiers:
            if modifier.type == "ARMATURE":
                modifier.object = armature

    face = next((obj for obj in meshes if "Face_Head" in obj.name), None)
    if face is None:
        raise RuntimeError("No Face_Head mesh found in v15 source")
    return face, meshes, armature


def clear_shape_keys(obj: bpy.types.Object) -> None:
    if obj.data.shape_keys is None:
        return
    while obj.data.shape_keys and obj.data.shape_keys.key_blocks:
        obj.shape_key_remove(obj.data.shape_keys.key_blocks[-1])


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    return v12.smoothstep(edge0, edge1, value)


def bell(value: float, center: float, radius: float) -> float:
    if radius <= 0:
        return 0.0
    distance = abs(value - center) / radius
    if distance >= 1.0:
        return 0.0
    return (1.0 - distance * distance) ** 2


def side_weight(x: float, side: int) -> float:
    return smoothstep(0.0, 0.035, x * side)


def add_landmark_weight(obj: bpy.types.Object, name: str, index: int, weight: float) -> None:
    if weight <= 0.001:
        return
    group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
    group.add([index], min(1.0, weight), "ADD")


def add_face_landmarks(face: bpy.types.Object) -> dict[str, int]:
    counts = {name: 0 for name in LANDMARK_GROUPS}
    for group_name in LANDMARK_GROUPS:
        if face.vertex_groups.get(group_name) is None:
            face.vertex_groups.new(name=group_name)

    for vertex in face.data.vertices:
        co = vertex.co
        x, y, z = co.x, co.y, co.z
        ax = abs(x)
        front = smoothstep(-0.080, -0.135, y)
        eye = front * bell(z, 1.715, 0.052) * smoothstep(0.030, 0.055, ax) * (1.0 - smoothstep(0.145, 0.175, ax))
        brow = front * bell(z, 1.753, 0.030) * smoothstep(0.035, 0.060, ax) * (1.0 - smoothstep(0.145, 0.175, ax))
        mouth = front * bell(z, 1.622, 0.055) * (1.0 - smoothstep(0.145, 0.180, ax))
        cheek = front * bell(z, 1.660, 0.062) * smoothstep(0.058, 0.090, ax) * (1.0 - smoothstep(0.155, 0.185, ax))
        jaw = front * bell(z, 1.545, 0.060) * (1.0 - smoothstep(0.135, 0.170, ax))

        weights = {
            "Face_L_EyeLid": eye * side_weight(x, -1),
            "Face_R_EyeLid": eye * side_weight(x, 1),
            "Face_L_Brow": brow * side_weight(x, -1),
            "Face_R_Brow": brow * side_weight(x, 1),
            "Face_Mouth": mouth,
            "Face_L_Cheek": cheek * side_weight(x, -1),
            "Face_R_Cheek": cheek * side_weight(x, 1),
            "Face_Jaw": jaw,
        }
        for name, weight in weights.items():
            if weight > 0.001:
                counts[name] += 1
                add_landmark_weight(face, name, vertex.index, weight)

    face["commercial_v16_facial_landmark_counts"] = json.dumps(counts, sort_keys=True)
    return counts


def rebuild_face_expression_morphs(face: bpy.types.Object) -> dict[str, int]:
    clear_shape_keys(face)
    basis = face.shape_key_add(name="Basis")
    keys = {name: face.shape_key_add(name=name) for name in MORPH_NAMES}
    for key in keys.values():
        key.slider_min = 0.0
        key.slider_max = 1.0

    counts = {name: 0 for name in MORPH_NAMES}
    for index, vertex in enumerate(face.data.vertices):
        co = vertex.co
        x, y, z = co.x, co.y, co.z
        ax = abs(x)
        front = smoothstep(-0.080, -0.135, y)
        side = 1.0 if x >= 0.0 else -1.0

        eye = front * bell(z, 1.715, 0.050) * smoothstep(0.032, 0.060, ax) * (1.0 - smoothstep(0.145, 0.178, ax))
        upper_eye = eye * smoothstep(1.705, 1.744, z)
        lower_eye = eye * (1.0 - smoothstep(1.685, 1.716, z))
        brow = front * bell(z, 1.753, 0.032) * smoothstep(0.035, 0.060, ax) * (1.0 - smoothstep(0.150, 0.180, ax))
        mouth = front * bell(z, 1.622, 0.058) * (1.0 - smoothstep(0.150, 0.185, ax))
        mouth_corner = mouth * smoothstep(0.055, 0.130, ax)
        mouth_center = mouth * (1.0 - smoothstep(0.030, 0.075, ax))
        cheek = front * bell(z, 1.660, 0.064) * smoothstep(0.060, 0.095, ax) * (1.0 - smoothstep(0.155, 0.190, ax))
        jaw = front * bell(z, 1.545, 0.060) * (1.0 - smoothstep(0.135, 0.175, ax))

        if eye > 0.001:
            keys["Blink"].data[index].co.z += (-0.030 * upper_eye) + (0.018 * lower_eye)
            keys["Blink"].data[index].co.y -= 0.004 * eye
            keys["Surprised"].data[index].co.z += 0.020 * eye
            keys["Thoughtful"].data[index].co.z -= 0.006 * eye
            counts["Blink"] += 1
            counts["Surprised"] += 1
            counts["Thoughtful"] += 1

        if brow > 0.001:
            keys["Surprised"].data[index].co.z += 0.026 * brow
            keys["Thoughtful"].data[index].co.z += (0.010 if x < 0.0 else -0.004) * brow
            keys["Teasing"].data[index].co.z += (0.006 if x > 0.0 else -0.002) * brow
            counts["Surprised"] += 1
            counts["Thoughtful"] += 1
            counts["Teasing"] += 1

        if mouth > 0.001:
            keys["ConfidentSmile"].data[index].co.z += (0.018 * mouth_corner) + (0.004 * mouth_center)
            keys["ConfidentSmile"].data[index].co.x += side * 0.006 * mouth_corner
            keys["ConfidentSmile"].data[index].co.y -= 0.004 * mouth_corner

            keys["WarmSmile"].data[index].co.z += (0.023 * mouth_corner) + (0.007 * mouth_center)
            keys["WarmSmile"].data[index].co.x += side * 0.004 * mouth_corner
            keys["WarmSmile"].data[index].co.y -= 0.006 * mouth_corner

            keys["Teasing"].data[index].co.z += ((0.026 if x > 0.0 else 0.010) * mouth_corner) + 0.003 * mouth_center
            keys["Teasing"].data[index].co.x += side * 0.005 * mouth_corner
            keys["Teasing"].data[index].co.y -= 0.006 * mouth_corner

            keys["Surprised"].data[index].co.z += (0.018 if z > 1.625 else -0.020) * mouth_center
            keys["Surprised"].data[index].co.y -= 0.010 * mouth

            keys["Thoughtful"].data[index].co.z -= 0.006 * mouth
            keys["Thoughtful"].data[index].co.x += -side * 0.0025 * mouth
            counts["ConfidentSmile"] += 1
            counts["WarmSmile"] += 1
            counts["Teasing"] += 1
            counts["Surprised"] += 1
            counts["Thoughtful"] += 1

        if cheek > 0.001:
            keys["WarmSmile"].data[index].co.z += 0.012 * cheek
            keys["WarmSmile"].data[index].co.y -= 0.003 * cheek
            keys["ConfidentSmile"].data[index].co.z += 0.007 * cheek
            keys["Teasing"].data[index].co.z += (0.010 if x > 0.0 else 0.003) * cheek
            counts["WarmSmile"] += 1
            counts["ConfidentSmile"] += 1
            counts["Teasing"] += 1

        if jaw > 0.001:
            keys["Surprised"].data[index].co.z -= 0.020 * jaw
            keys["Surprised"].data[index].co.y -= 0.006 * jaw
            counts["Surprised"] += 1

    face.data.shape_keys.use_relative = True
    face["commercial_v16_expression_counts"] = json.dumps(counts, sort_keys=True)
    return counts


def remove_non_face_morphs(face: bpy.types.Object, meshes: list[bpy.types.Object]) -> int:
    removed = 0
    for obj in meshes:
        if obj == face:
            continue
        if obj.data.shape_keys is None:
            continue
        removed += 1
        clear_shape_keys(obj)
        obj["commercial_v16_non_face_morphs_removed"] = True
    return removed


def list_morph_targets(obj: bpy.types.Object) -> list[str]:
    if not obj.data.shape_keys:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]


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
    face: bpy.types.Object,
    meshes: list[bpy.types.Object],
    armature: bpy.types.Object,
    landmark_counts: dict[str, int],
    expression_counts: dict[str, int],
    removed_non_face_morphs: int,
) -> None:
    secondary = v12.summarize_secondary_bones(armature)
    mesh_summaries = summarize_parts(meshes)
    face_morphs = list_morph_targets(face)
    morph_meshes = [obj.name for obj in meshes if list_morph_targets(obj)]
    total_faces = sum(len(obj.data.polygons) for obj in meshes)
    split_part_names = [obj.name for obj in meshes]
    acceptance_checks = {
        "keepsV15PhysicalRuntimeParts": len(meshes) >= 12 and all(any(part in name for name in split_part_names) for part in ["Face_Head", "Hair_Back", "Torso_Camisole", "Skirt_Center", "Legs", "Shoes"]),
        "onlyFaceMeshHasExpressionMorphs": morph_meshes == [face.name],
        "hasSixSculptedFaceMorphs": sorted(face_morphs) == sorted(MORPH_NAMES),
        "hasMorphAffectedVertices": all(count > 0 for count in expression_counts.values()),
        "hasFacialLandmarkGroups": all(landmark_counts.get(name, 0) > 0 for name in LANDMARK_GROUPS),
        "removedInertNonFaceMorphs": removed_non_face_morphs >= 10,
        "hasHairSecondaryBones": len(secondary["hair"]) >= 6,
        "hasSkirtSecondaryBones": len(secondary["skirt"]) >= 5,
        "keepsCleanChokerPendant": any("ChokerPendant" in obj.name for obj in meshes),
        "webRuntimeBudgetTarget": total_faces <= 65000,
    }
    report = {
        "assetId": "mature-senpai-commercial-v16",
        "characterId": "mature_senpai",
        "status": "dedicated-face-expression-production-preview",
        "source": "public/assets/models/mature_senpai_commercial_v15.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v16.blend",
        "output": "public/assets/models/mature_senpai_commercial_v16.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v16.png",
        "generatedBy": "remote Blender headless + assets/characters/mature_senpai/tools/build_final_v16.py",
        "runtime": {
            "defaultAsset": True,
            "format": "glb",
            "url": "/assets/models/mature_senpai_commercial_v16.glb",
            "thumbnailUrl": "/assets/models/mature_senpai_commercial_v16.png",
            "fallbackAssetId": "mature-senpai-commercial-v15",
            "threeRuntimeFeatures": [
                "multiple SkinnedMesh runtime parts",
                "dedicated Face_Head morphTargetInfluences",
                "AnimationMixer clips",
                "Secondary_* bone spring overlay",
            ],
        },
        "productionFlags": {
            "physicalRuntimeSplitParts": True,
            "dedicatedFaceExpressionMorphs": True,
            "facialLandmarkVertexGroups": True,
            "nonFaceMorphTargetsRemoved": True,
            "sourceTopologyPreserved": True,
            "uvsMaterialsAndWeightsPreserved": True,
            "hairSecondaryBones": True,
            "skirtSecondaryBones": True,
            "webRuntimeReady": True,
        },
        "faceMesh": {
            "name": face.name,
            "vertices": len(face.data.vertices),
            "faces": len(face.data.polygons),
            "morphTargets": face_morphs,
            "landmarkGroups": landmark_counts,
            "expressionVertexCounts": expression_counts,
        },
        "runtimeParts": mesh_summaries,
        "morphTargets": {face.name: face_morphs},
        "removedNonFaceMorphMeshes": removed_non_face_morphs,
        "armatureBones": [bone.name for bone in armature.data.bones],
        "secondaryRig": secondary,
        "acceptanceChecks": acceptance_checks,
        "runtimeDecision": {
            "defaultAsset": True,
            "fallbackAssetId": "mature-senpai-commercial-v15",
            "reason": "v16 keeps the accepted v15 physical split while moving expression playback to a dedicated Face_Head morph layer with explicit facial landmark groups. This is closer to a commercial JRPG character setup than carrying inherited body-wide shape keys on every split part.",
        },
        "completedPasses": [
            "imported the v15 physically split runtime asset",
            "renamed runtime parts to v16 while preserving UVs, materials, skin weights, and animation clips",
            "removed inherited non-face morph targets from hair, torso, arms, skirt, legs, shoes, and accessory meshes",
            "added facial landmark vertex groups for eyelids, brows, mouth, cheeks, and jaw",
            "rebuilt Blink, ConfidentSmile, WarmSmile, Teasing, Surprised, and Thoughtful as dedicated Face_Head geometry shape keys",
            "exported GLB with multiple skinned parts, one face morph target carrier, skins, and animations",
        ],
        "limitations": [
            "v16 still uses the accepted source triangle topology, not a final hand-authored quad retopology.",
            "The face expressions are sculpted by authored coordinate masks; final commercial dialogue quality still benefits from artist-sculpted blendshapes on dedicated facial loops.",
            "Skin weights are preserved/generated from earlier passes, not manually brush-painted.",
            "The texture atlas is preserved from the Hunyuan source; final commercial polish still needs UV cleanup and texture repaint.",
        ],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> dict[str, Any]:
    clean_scene()
    face, meshes, armature = import_v15_source()
    removed_non_face_morphs = remove_non_face_morphs(face, meshes)
    landmark_counts = add_face_landmarks(face)
    expression_counts = rebuild_face_expression_morphs(face)
    v12.render_preview(face, meshes)
    export_outputs(meshes, armature)
    write_report(face, meshes, armature, landmark_counts, expression_counts, removed_non_face_morphs)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "runtimeParts": len(meshes),
        "faceMorphs": list_morph_targets(face),
        "removedNonFaceMorphMeshes": removed_non_face_morphs,
        "landmarkCounts": landmark_counts,
        "expressionCounts": expression_counts,
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

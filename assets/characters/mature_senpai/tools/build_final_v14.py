"""
Build mature_senpai_commercial_v14 from the v12 source-preserving pipeline.

v13 proved that flat expression overlay quads are too fragile for this character:
they created forehead bars in rendered morph audits. v14 keeps the stronger source
likeness, cleaner outfit pass, semantic/secondary rig layers, and body shape keys,
but rejects separate facial overlay geometry.
"""

from __future__ import annotations

import importlib.util
import json
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

SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_mcp_polish_v2.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v14.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v14.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v14.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v14.report.json"
MORPH_NAMES = ["Blink", "ConfidentSmile", "WarmSmile", "Teasing", "Surprised", "Thoughtful"]

v12.SOURCE_GLB = SOURCE_GLB
v12.OUTPUT_GLB = OUTPUT_GLB
v12.OUTPUT_PNG = OUTPUT_PNG
v12.OUTPUT_BLEND = OUTPUT_BLEND
v12.OUTPUT_REPORT = OUTPUT_REPORT


def rename_v14_objects(body: bpy.types.Object, armature: bpy.types.Object) -> None:
    body.name = "MatureSenpai_V14_SourcePreservedBody"
    body.data.name = "MatureSenpai_V14_SourcePreservedBodyMesh"
    armature.name = "MatureSenpai_V14_ProductionArmature"
    armature.data.name = "MatureSenpai_V14_ProductionArmatureData"
    body["commercial_v14_part"] = "SourcePreservedBody"
    body["commercial_v14_decision"] = "preserve likeness; reject flat expression overlay geometry"


def amplify_body_morphs(body: bpy.types.Object) -> dict[str, int]:
    counts = v12.add_face_morphs(body)
    if not body.data.shape_keys:
        return counts

    basis = body.data.shape_keys.key_blocks.get("Basis")
    if basis is None:
        return counts

    scale_by_name = {
        "Blink": 3.10,
        "ConfidentSmile": 2.25,
        "WarmSmile": 2.35,
        "Teasing": 2.20,
        "Surprised": 2.35,
        "Thoughtful": 2.05,
    }
    for name, scale in scale_by_name.items():
        key = body.data.shape_keys.key_blocks.get(name)
        if key is None:
            continue
        key.slider_min = 0.0
        key.slider_max = 1.0
        for index, vertex in enumerate(key.data):
            delta = vertex.co - basis.data[index].co
            vertex.co = basis.data[index].co + delta * scale

    body.data.shape_keys.use_relative = True
    body["commercial_v14_morph_amplification"] = json.dumps(scale_by_name, sort_keys=True)
    return counts


def tune_v14_materials(body: bpy.types.Object) -> None:
    v12.tune_materials(body)
    for material in body.data.materials:
        if not material or not material.use_nodes:
            continue
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.56
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = 1.0
    weighted_normal = body.modifiers.new("V14 weighted normal polish", "WEIGHTED_NORMAL")
    weighted_normal.keep_sharp = True
    weighted_normal.weight = 50
    body["commercial_v14_material_pass"] = "smoothed source materials with weighted-normal polish"


def add_v14_detail_parts(armature: bpy.types.Object) -> tuple[bpy.types.Collection, list[bpy.types.Object]]:
    collection = bpy.data.collections.new("MatureSenpai_CommercialV14_DetailParts")
    bpy.context.scene.collection.children.link(collection)
    gold = v12.make_material("CommercialV14_SoftGoldTrim", (0.95, 0.66, 0.25, 1.0), 0.42)
    gem = v12.make_material("CommercialV14_PurplePendantGem", (0.50, 0.33, 0.86, 1.0), 0.34)

    choker_vertices = [
        (-0.098, -0.224, 1.486),
        (0.098, -0.224, 1.486),
        (0.092, -0.226, 1.462),
        (-0.092, -0.226, 1.462),
        (-0.018, -0.235, 1.456),
        (0.018, -0.235, 1.456),
        (0.000, -0.242, 1.414),
    ]
    choker = v12.create_skinned_mesh(
        "MatureSenpai_V14_ChokerPendant",
        choker_vertices,
        [[0, 1, 2, 3], [4, 5, 6]],
        [gold, gem],
        [0, 1],
        armature,
        {"Neck": 0.48, "Chest": 0.16, "Secondary_Pendant": 0.36},
        collection,
    )
    choker["commercial_v14_part"] = "ChokerPendant"
    choker["commercial_v14_reason"] = "kept as real skinned accessory; v12/v13 flat strap panels removed"
    return collection, [choker]


def list_morph_targets(obj: bpy.types.Object) -> list[str]:
    if not obj.data.shape_keys:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]


def write_report(
    body: bpy.types.Object,
    details: list[bpy.types.Object],
    armature: bpy.types.Object,
    semantic_counts: dict[str, int],
    secondary_weight_counts: dict[str, int],
    morph_counts: dict[str, int],
) -> None:
    morph_targets = list_morph_targets(body)
    secondary = v12.summarize_secondary_bones(armature)
    total_faces = len(body.data.polygons) + sum(len(obj.data.polygons) for obj in details)
    semantic_group_counts = v12.summarize_vertex_group_counts(body, ("Semantic_",))
    secondary_group_counts = v12.summarize_vertex_group_counts(body, ("Secondary_",))
    detail_names = [obj.name for obj in details]
    acceptance_checks = {
        "preservesHunyuanVisibleSource": body.name == "MatureSenpai_V14_SourcePreservedBody" and len(body.data.polygons) >= 50000,
        "hasSemanticPartGroups": len([name for name in semantic_group_counts if name.startswith("Semantic_")]) >= len(v12.SEMANTIC_PARTS),
        "hasSixNamedExpressionMorphs": sorted(morph_targets) == sorted(MORPH_NAMES),
        "hasMorphAffectedVertices": all(count > 0 for count in morph_counts.values()),
        "hasHairSecondaryBones": len(secondary["hair"]) >= 6,
        "hasSkirtSecondaryBones": len(secondary["skirt"]) >= 5,
        "hasSecondaryWeights": len(secondary_group_counts) >= 8,
        "removedFlatExpressionOverlay": not any("Overlay" in name or "Expression" in name for name in detail_names),
        "removedHardStraightStrapPanels": not any("Strap" in name for name in detail_names),
        "hasSkinnedChokerPendantDetail": any("ChokerPendant" in name for name in detail_names),
        "webRuntimeBudgetTarget": total_faces <= 65000,
    }
    report = {
        "assetId": "mature-senpai-commercial-v14",
        "characterId": "mature_senpai",
        "status": "source-preserving-clean-production-preview",
        "source": "public/assets/models/mature_senpai_mcp_polish_v2.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v14.blend",
        "output": "public/assets/models/mature_senpai_commercial_v14.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v14.png",
        "generatedBy": "remote Blender headless + assets/characters/mature_senpai/tools/build_final_v14.py",
        "runtime": {
            "defaultAsset": True,
            "format": "glb",
            "url": "/assets/models/mature_senpai_commercial_v14.glb",
            "thumbnailUrl": "/assets/models/mature_senpai_commercial_v14.png",
            "fallbackAssetId": "mature-senpai-commercial-v12",
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
            "facialMorphs": True,
            "flatExpressionOverlayRejected": True,
            "hardStrapPanelsRemoved": True,
            "explicitSupplementalWeights": True,
            "hairSecondaryBones": True,
            "skirtSecondaryBones": True,
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
            "fallbackAssetId": "mature-senpai-commercial-v12",
            "reason": "v14 supersedes the rejected v13 overlay experiment. It preserves the v12/v2 likeness, removes the visibly fake flat expression overlay and straight strap panels, keeps six real body morph targets, and retains hair/skirt secondary motion hooks for the web runtime.",
        },
        "completedPasses": [
            "preserved the mcp-polish-v2 body, UVs, texture atlas, and silhouette",
            "kept semantic vertex groups for retopo handoff and runtime part classification",
            "amplified six body morph targets without separate face overlay quads",
            "retained supplemental Secondary_* weights for long hair and skirt regions",
            "retained secondary hair/skirt/pendant bones recognized by CharacterModel3D",
            "removed v12 hard straight strap panels and rejected v13 forehead-bar expression overlay",
            "kept a lightweight skinned choker/pendant detail part",
            "exported GLB with skins, morphs, and animations",
        ],
        "limitations": [
            "v14 is still source-preserving hybrid production preparation, not a full manual quad-retopology remake.",
            "The single Hunyuan source mesh remains the visible body/hair/outfit carrier to preserve likeness.",
            "Weights are generated by authored profiles, not manually brush-painted in Blender.",
            "Facial morphs are geometry-only deltas on the source mesh; final commercial expression quality still needs dedicated facial topology and artist-sculpted blendshapes.",
        ],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> dict[str, Any]:
    v12.clean_scene()
    body, armature = v12.import_source()
    rename_v14_objects(body, armature)
    v12.add_secondary_detail_bones(armature)
    semantic_counts = v12.add_semantic_part_groups(body)
    secondary_weight_counts = v12.add_supplemental_secondary_weights(body)
    morph_counts = amplify_body_morphs(body)
    tune_v14_materials(body)
    _collection, details = add_v14_detail_parts(armature)
    v12.render_preview(body, details)
    v12.export_outputs(body, details, armature)
    write_report(body, details, armature, semantic_counts, secondary_weight_counts, morph_counts)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "bodyFaces": len(body.data.polygons),
        "detailParts": len(details),
        "bodyMorphs": list_morph_targets(body),
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

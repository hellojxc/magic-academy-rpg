"""
Build mature_senpai_commercial_v15 from the v14 runtime asset.

v15 keeps the v14 visual source but replaces the single visible body carrier with
physical skinned runtime parts. Each split mesh preserves the source vertices,
UVs, materials, vertex groups, and shape keys so the asset becomes editable as
separate face, hair, torso, arm, skirt, leg, and shoe pieces without losing the
Hunyuan/BlenderMCP likeness.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(globals().get("PROJECT_ROOT", "/home/dennisj/apps/magic-academy-rpg-preview"))
TOOLS_DIR = PROJECT_ROOT / "assets/characters/mature_senpai/tools"

spec = importlib.util.spec_from_file_location("build_final_v12", TOOLS_DIR / "build_final_v12.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load build_final_v12.py")
v12 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v12)

SOURCE_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v14.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v15.glb"
OUTPUT_PNG = PROJECT_ROOT / "public/assets/models/mature_senpai_commercial_v15.png"
OUTPUT_BLEND = PROJECT_ROOT / "assets/characters/mature_senpai/source/mature_senpai_commercial_v15.blend"
OUTPUT_REPORT = PROJECT_ROOT / "assets/characters/mature_senpai/mature_senpai_commercial_v15.report.json"
MORPH_NAMES = ["Blink", "ConfidentSmile", "WarmSmile", "Teasing", "Surprised", "Thoughtful"]

v12.OUTPUT_GLB = OUTPUT_GLB
v12.OUTPUT_PNG = OUTPUT_PNG
v12.OUTPUT_BLEND = OUTPUT_BLEND
v12.OUTPUT_REPORT = OUTPUT_REPORT


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


def clean_scene() -> None:
    v12.clean_scene()


def import_v14_source() -> tuple[bpy.types.Object, bpy.types.Object, list[bpy.types.Object]]:
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No meshes imported from v14 source GLB")
    body = max(meshes, key=lambda obj: len(obj.data.polygons))
    detail_parts = [obj for obj in meshes if obj != body]

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("No armature imported from v14 source GLB")
    armature = armatures[0]
    armature.name = "MatureSenpai_V15_ProductionArmature"
    armature.data.name = "MatureSenpai_V15_ProductionArmatureData"
    return body, armature, detail_parts


def classify_face_part(body: bpy.types.Object, polygon: bpy.types.MeshPolygon) -> str:
    centroid = Vector((0.0, 0.0, 0.0))
    for vertex_index in polygon.vertices:
        centroid += body.data.vertices[vertex_index].co
    centroid /= max(1, len(polygon.vertices))
    return v12.classify_part(centroid)


def copy_mesh_part(
    source: bpy.types.Object,
    armature: bpy.types.Object,
    part_name: str,
    polygons: list[bpy.types.MeshPolygon],
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    original_to_new: dict[int, int] = {}
    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    material_indices: list[int] = []
    polygon_loop_pairs: list[tuple[bpy.types.MeshPolygon, bpy.types.MeshPolygon]] = []

    for polygon in polygons:
        face: list[int] = []
        for original_index in polygon.vertices:
            if original_index not in original_to_new:
                original_to_new[original_index] = len(vertices)
                vertices.append(tuple(source.data.vertices[original_index].co))
            face.append(original_to_new[original_index])
        faces.append(face)
        material_indices.append(polygon.material_index)

    mesh = bpy.data.meshes.new(f"MatureSenpai_V15_{part_name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    for material in source.data.materials:
        mesh.materials.append(material)
    for index, polygon in enumerate(mesh.polygons):
        polygon.material_index = material_indices[index]
        polygon.use_smooth = True
        polygon_loop_pairs.append((polygons[index], polygon))

    for source_uv in source.data.uv_layers:
        target_uv = mesh.uv_layers.new(name=source_uv.name)
        for source_polygon, target_polygon in polygon_loop_pairs:
            for source_loop_index, target_loop_index in zip(source_polygon.loop_indices, target_polygon.loop_indices):
                target_uv.data[target_loop_index].uv = source_uv.data[source_loop_index].uv

    obj = bpy.data.objects.new(f"MatureSenpai_V15_{part_name}", mesh)
    collection.objects.link(obj)
    obj.parent = source.parent
    obj.matrix_parent_inverse = source.matrix_parent_inverse.copy()
    obj.matrix_basis = source.matrix_basis.copy()

    source_groups = {group.index: group.name for group in source.vertex_groups}
    for source_group in source.vertex_groups:
        obj.vertex_groups.new(name=source_group.name)
    for original_index, new_index in original_to_new.items():
        source_vertex = source.data.vertices[original_index]
        for assignment in source_vertex.groups:
            group_name = source_groups.get(assignment.group)
            if not group_name:
                continue
            obj.vertex_groups[group_name].add([new_index], assignment.weight, "ADD")

    if source.data.shape_keys:
        source_keys = source.data.shape_keys.key_blocks
        obj.shape_key_add(name="Basis")
        for source_key in source_keys:
            if source_key.name == "Basis":
                continue
            target_key = obj.shape_key_add(name=source_key.name)
            target_key.slider_min = source_key.slider_min
            target_key.slider_max = source_key.slider_max
            for original_index, new_index in original_to_new.items():
                target_key.data[new_index].co = source_key.data[original_index].co
        obj.data.shape_keys.use_relative = True

    modifier = obj.modifiers.new("V15 production armature", "ARMATURE")
    modifier.object = armature
    obj["commercial_v15_part"] = part_name
    obj["commercial_v15_source"] = source.name
    obj["commercial_v15_split_method"] = "source topology physical split preserving UVs, materials, weights, and shape keys"
    return obj


def split_visible_body(
    body: bpy.types.Object,
    armature: bpy.types.Object,
) -> tuple[bpy.types.Collection, list[bpy.types.Object], dict[str, int]]:
    collection = bpy.data.collections.new("MatureSenpai_CommercialV15_PhysicalRuntimeParts")
    bpy.context.scene.collection.children.link(collection)
    polygons_by_part: dict[str, list[bpy.types.MeshPolygon]] = {part: [] for part in PART_ORDER}
    for polygon in body.data.polygons:
        polygons_by_part[classify_face_part(body, polygon)].append(polygon)

    split_parts: list[bpy.types.Object] = []
    face_counts: dict[str, int] = {}
    for part_name in PART_ORDER:
        polygons = polygons_by_part[part_name]
        face_counts[part_name] = len(polygons)
        if not polygons:
            continue
        split_parts.append(copy_mesh_part(body, armature, part_name, polygons, collection))

    body.name = "MatureSenpai_V15_SourceReferenceHidden"
    body.hide_viewport = True
    body.hide_render = True
    body["commercial_v15_reference_only"] = "hidden source mesh retained in blend only; not selected for runtime export"
    return collection, split_parts, face_counts


def rename_detail_parts(detail_parts: list[bpy.types.Object], armature: bpy.types.Object) -> list[bpy.types.Object]:
    renamed: list[bpy.types.Object] = []
    for obj in detail_parts:
        if "ChokerPendant" in obj.name:
            obj.name = "MatureSenpai_V15_ChokerPendant"
            obj.data.name = "MatureSenpai_V15_ChokerPendantMesh"
            obj["commercial_v15_part"] = "ChokerPendant"
            obj["commercial_v15_source"] = "v14 skinned accessory"
            renamed.append(obj)
            continue
        obj.name = f"MatureSenpai_V15_SourceDetailReference_{obj.name}"
        obj.hide_viewport = True
        obj.hide_render = True
        obj["commercial_v15_reference_only"] = "imported source detail excluded from runtime export"
    for obj in renamed:
        for modifier in obj.modifiers:
            if modifier.type == "ARMATURE":
                modifier.object = armature
    return renamed


def list_morph_targets(obj: bpy.types.Object) -> list[str]:
    if not obj.data.shape_keys:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis"]


def summarize_split_parts(parts: list[bpy.types.Object]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for obj in parts:
        summaries.append({
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "faces": len(obj.data.polygons),
            "materials": [material.name for material in obj.data.materials if material],
            "morphTargets": list_morph_targets(obj),
            "vertexGroups": len(obj.vertex_groups),
        })
    return summaries


def export_outputs(export_objects: list[bpy.types.Object], armature: bpy.types.Object) -> None:
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))

    for obj in bpy.context.scene.objects:
        obj.select_set(obj == armature or obj in export_objects)
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
    source_body: bpy.types.Object,
    split_parts: list[bpy.types.Object],
    detail_parts: list[bpy.types.Object],
    armature: bpy.types.Object,
    face_counts: dict[str, int],
) -> None:
    split_part_summaries = summarize_split_parts(split_parts)
    detail_summaries = summarize_split_parts(detail_parts)
    total_split_faces = sum(summary["faces"] for summary in split_part_summaries)
    head_part = next((obj for obj in split_parts if obj.name.endswith("Face_Head")), None)
    secondary = v12.summarize_secondary_bones(armature)
    all_morphs = {obj.name: list_morph_targets(obj) for obj in split_parts if list_morph_targets(obj)}
    split_part_names = [obj.name for obj in split_parts]
    acceptance_checks = {
        "preservesSourceFaceCount": total_split_faces == len(source_body.data.polygons),
        "hasPhysicalRuntimeParts": len(split_parts) >= 10,
        "hasNamedFaceHairTorsoSkirtLegShoeParts": all(any(part in name for name in split_part_names) for part in ["Face_Head", "Hair_Back", "Torso_Camisole", "Skirt_Center", "Legs", "Shoes"]),
        "hasFaceMorphsOnSplitHead": head_part is not None and sorted(list_morph_targets(head_part)) == sorted(MORPH_NAMES),
        "hasMorphsPreservedOnEverySplitPart": all(sorted(list_morph_targets(obj)) == sorted(MORPH_NAMES) for obj in split_parts),
        "hasVertexGroupsOnEverySplitPart": all(len(obj.vertex_groups) >= 8 for obj in split_parts),
        "hasHairSecondaryBones": len(secondary["hair"]) >= 6,
        "hasSkirtSecondaryBones": len(secondary["skirt"]) >= 5,
        "keepsOnlyCleanAccessoryDetail": len(detail_parts) == 1 and any("ChokerPendant" in obj.name for obj in detail_parts),
        "sourceReferenceHiddenFromRender": source_body.hide_render and source_body.hide_viewport,
        "webRuntimeBudgetTarget": total_split_faces + sum(len(obj.data.polygons) for obj in detail_parts) <= 65000,
    }
    report = {
        "assetId": "mature-senpai-commercial-v15",
        "characterId": "mature_senpai",
        "status": "physical-split-production-preview",
        "source": "public/assets/models/mature_senpai_commercial_v14.glb",
        "blendSource": "assets/characters/mature_senpai/source/mature_senpai_commercial_v15.blend",
        "output": "public/assets/models/mature_senpai_commercial_v15.glb",
        "thumbnail": "public/assets/models/mature_senpai_commercial_v15.png",
        "generatedBy": "remote Blender headless + assets/characters/mature_senpai/tools/build_final_v15.py",
        "runtime": {
            "defaultAsset": True,
            "format": "glb",
            "url": "/assets/models/mature_senpai_commercial_v15.glb",
            "thumbnailUrl": "/assets/models/mature_senpai_commercial_v15.png",
            "fallbackAssetId": "mature-senpai-commercial-v14",
            "threeRuntimeFeatures": [
                "multiple SkinnedMesh runtime parts",
                "AnimationMixer clips",
                "morphTargetInfluences",
                "Secondary_* bone spring overlay",
            ],
        },
        "productionFlags": {
            "physicalRuntimeSplitParts": True,
            "sourceTopologyPreserved": True,
            "uvsAndMaterialsPreserved": True,
            "vertexGroupsAndWeightsPreserved": True,
            "facialMorphsCopiedToSplitParts": True,
            "hiddenSourceReferenceMeshInBlend": True,
            "hairSecondaryBones": True,
            "skirtSecondaryBones": True,
            "webRuntimeReady": True,
        },
        "sourceBody": {
            "name": source_body.name,
            "vertices": len(source_body.data.vertices),
            "faces": len(source_body.data.polygons),
            "morphTargets": list_morph_targets(source_body),
        },
        "splitFaceCounts": face_counts,
        "splitParts": split_part_summaries,
        "detailParts": detail_summaries,
        "armatureBones": [bone.name for bone in armature.data.bones],
        "secondaryRig": secondary,
        "morphTargets": all_morphs,
        "acceptanceChecks": acceptance_checks,
        "runtimeDecision": {
            "defaultAsset": True,
            "fallbackAssetId": "mature-senpai-commercial-v14",
            "reason": "v15 is the first production-structure pass that physically splits the preserved v14 visible source into editable skinned runtime parts while keeping the source UVs, texture atlas, weights, animations, and expression shape keys.",
        },
        "completedPasses": [
            "imported the accepted v14 runtime GLB as the visual source",
            "physically split the visible source mesh into named face, hair, torso, arms, skirt, legs, and shoe runtime meshes",
            "preserved original UV coordinates, material slots, vertex groups, skin weights, and all six expression shape keys on split meshes",
            "kept the source mesh hidden in the blend file as an audit/reference object but excluded it from runtime export",
            "retained the v14 clean skinned choker/pendant detail part",
            "exported a GLB with multiple SkinnedMesh parts, skins, morphs, and animations",
        ],
        "limitations": [
            "v15 performs a physical source-topology split, not a final hand-authored quad retopology.",
            "The split parts are suitable for production editing and runtime control, but final commercial deformation still needs artist brush-painted weights.",
            "Expression morphs are preserved from v14 on split meshes; final dialogue quality still needs dedicated facial topology and sculpted blendshapes.",
            "The texture atlas is preserved from the Hunyuan source; final commercial polish still needs UV cleanup and texture repaint.",
        ],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> dict[str, Any]:
    clean_scene()
    source_body, armature, imported_details = import_v14_source()
    _collection, split_parts, face_counts = split_visible_body(source_body, armature)
    detail_parts = rename_detail_parts(imported_details, armature)
    all_runtime_parts = split_parts + detail_parts
    v12.render_preview(split_parts[0], all_runtime_parts)
    export_outputs(all_runtime_parts, armature)
    write_report(source_body, split_parts, detail_parts, armature, face_counts)
    return {
        "glb": str(OUTPUT_GLB),
        "png": str(OUTPUT_PNG),
        "blend": str(OUTPUT_BLEND),
        "report": str(OUTPUT_REPORT),
        "splitParts": len(split_parts),
        "detailParts": len(detail_parts),
        "splitFaces": sum(face_counts.values()),
        "morphParts": [obj.name for obj in split_parts if list_morph_targets(obj)],
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))

"""Export Magic Academy authored world chunks from Blender.

Run with:
  blender assets/world/magic-academy.blend --background --python scripts/blender/export_academy_scene_chunks.py

Collections named "chunk_<id>" are exported to public/assets/world/chunks/<id>.high.glb.
Collections named "collision_<id>" are exported to public/assets/world/chunks/<id>.collision.glb.
Lightmap images baked in Blender should be saved to public/assets/world/lightmaps/<id>.lightmap.png
before the Node optimization step converts/compresses runtime assets.
"""

from __future__ import annotations

from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "assets" / "world" / "chunks"
LIGHTMAP_DIR = ROOT / "public" / "assets" / "world" / "lightmaps"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LIGHTMAP_DIR.mkdir(parents=True, exist_ok=True)
    configure_scene()

    exported = 0
    for collection in bpy.data.collections:
        if collection.name.startswith("chunk_"):
            chunk_id = collection.name.removeprefix("chunk_").replace("_", "-")
            export_collection(collection, OUT_DIR / f"{chunk_id}.high.glb")
            exported += 1
        elif collection.name.startswith("collision_"):
            chunk_id = collection.name.removeprefix("collision_").replace("_", "-")
            export_collection(collection, OUT_DIR / f"{chunk_id}.collision.glb")
            exported += 1

    if exported == 0:
        create_reference_scene()
        for collection in bpy.data.collections:
            if collection.name.startswith("chunk_"):
                chunk_id = collection.name.removeprefix("chunk_").replace("_", "-")
                export_collection(collection, OUT_DIR / f"{chunk_id}.high.glb")
                exported += 1

    print(f"[world-export] exported {exported} chunk files to {OUT_DIR}")


def configure_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.world.color = (0.02, 0.025, 0.035)


def export_collection(collection: bpy.types.Collection, output_path: Path) -> None:
    deselect_all()
    for obj in collection.objects:
        obj.select_set(True)
        prepare_object(obj)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_yup=True,
        export_lights=True,
        export_cameras=False,
        export_animations=False,
        export_extras=True,
    )
    print(f"[world-export] {collection.name} -> {output_path.relative_to(ROOT)}")


def prepare_object(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    obj.data.update(calc_edges=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj["r3f_chunk_asset"] = True


def create_reference_scene() -> None:
    """Create a small authored chunk so the pipeline works before final art exists."""
    collection = bpy.data.collections.new("chunk_atrium")
    bpy.context.scene.collection.children.link(collection)

    floor_mat = make_principled("polished_rune_stone", (0.48, 0.43, 0.55, 1), roughness=0.62, metallic=0.03)
    trim_mat = make_principled("aged_arcane_brass", (0.86, 0.68, 0.34, 1), roughness=0.28, metallic=0.55)
    glass_mat = make_principled("enchanted_glass", (0.38, 0.74, 1.0, 0.45), roughness=0.08, metallic=0.0, alpha=0.45)

    add_cube(collection, "floor_slab", (0, 0, 0), (9.5, 0.12, 6.5), floor_mat)
    add_cube(collection, "north_wall", (0, 1.55, -3.36), (9.8, 3.1, 0.22), floor_mat)
    add_cube(collection, "left_column", (-4.2, 1.55, -3.05), (0.42, 3.1, 0.42), trim_mat)
    add_cube(collection, "right_column", (4.2, 1.55, -3.05), (0.42, 3.1, 0.42), trim_mat)

    bpy.ops.mesh.primitive_torus_add(major_radius=1.45, minor_radius=0.06, major_segments=72, minor_segments=12, location=(0, 2.65, -3.02))
    arch = bpy.context.object
    arch.name = "brass_arch"
    arch.rotation_euler[0] = 1.5708
    arch.data.materials.append(trim_mat)
    collection.objects.link(arch)
    bpy.context.collection.objects.unlink(arch)

    for x in (-1.8, 0, 1.8):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.28, location=(x, 2.0, -3.18))
        orb = bpy.context.object
        orb.name = f"sky_orb_{x}"
        orb.data.materials.append(glass_mat)
        collection.objects.link(orb)
        bpy.context.collection.objects.unlink(orb)


def add_cube(collection: bpy.types.Collection, name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material) -> None:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    collection.objects.link(obj)
    bpy.context.collection.objects.unlink(obj)


def make_principled(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float,
    alpha: float = 1.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Alpha"].default_value = alpha
    mat.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    return mat


def deselect_all() -> None:
    for obj in bpy.context.scene.objects:
        obj.select_set(False)


if __name__ == "__main__":
    main()

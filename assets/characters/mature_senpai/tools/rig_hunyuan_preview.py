import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ANIMATED_BONES = [
    "Hips",
    "Spine",
    "Chest",
    "Neck",
    "Head",
    "LeftUpperArm",
    "LeftLowerArm",
    "RightUpperArm",
    "RightLowerArm",
    "LeftUpperLeg",
    "LeftLowerLeg",
    "LeftFoot",
    "RightUpperLeg",
    "RightLowerLeg",
    "RightFoot",
    "Secondary_Hair_Back",
    "Secondary_Hair_Left",
    "Secondary_Hair_Right",
    "Secondary_Skirt_Left",
    "Secondary_Skirt_Right",
]


def parse_args() -> tuple[Path, Path, Path]:
    if "--" not in sys.argv:
        raise SystemExit("Usage: blender --background --python rig_hunyuan_preview.py -- input.glb output.glb report.json")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) != 3:
        raise SystemExit("Expected input.glb output.glb report.json")
    return Path(args[0]), Path(args[1]), Path(args[2])


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_model(path: Path) -> list[bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh found after importing {path}")
    for obj in meshes:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)
        obj.name = "MatureSenpaiBody"
        obj.data.name = "MatureSenpaiBodyMesh"
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return meshes


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    min_v = Vector((float("inf"), float("inf"), float("inf")))
    max_v = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, world.x)
            min_v.y = min(min_v.y, world.y)
            min_v.z = min(min_v.z, world.z)
            max_v.x = max(max_v.x, world.x)
            max_v.y = max(max_v.y, world.y)
            max_v.z = max(max_v.z, world.z)
    return min_v, max_v


def create_armature(bounds_min: Vector, bounds_max: Vector) -> bpy.types.Object:
    size = bounds_max - bounds_min
    cx = (bounds_min.x + bounds_max.x) * 0.5
    cy = (bounds_min.y + bounds_max.y) * 0.5
    z0 = bounds_min.z
    height = size.z

    def z(t: float) -> float:
        return z0 + height * t

    half_width = max(0.001, size.x * 0.5)
    shoulder_x = half_width * 0.54
    hip_x = half_width * 0.27
    elbow_x = half_width * 0.83
    hand_x = half_width * 0.72
    knee_x = half_width * 0.18
    foot_x = half_width * 0.20
    front_y = cy - size.y * 0.10
    back_y = cy + size.y * 0.12

    armature_data = bpy.data.armatures.new("MatureSenpaiRigData")
    armature = bpy.data.objects.new("MatureSenpaiRig", armature_data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    armature_data.edit_bones.remove(armature_data.edit_bones[0]) if armature_data.edit_bones else None

    created: dict[str, bpy.types.EditBone] = {}

    def add_bone(name: str, head: tuple[float, float, float], tail: tuple[float, float, float], parent: str | None = None) -> None:
        bone = armature_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.roll = 0
        if parent:
            bone.parent = created[parent]
            bone.use_connect = False
        created[name] = bone

    add_bone("Hips", (cx, cy, z(0.50)), (cx, cy, z(0.58)))
    add_bone("Spine", (cx, cy, z(0.58)), (cx, cy, z(0.69)), "Hips")
    add_bone("Chest", (cx, cy, z(0.69)), (cx, cy, z(0.79)), "Spine")
    add_bone("Neck", (cx, cy, z(0.79)), (cx, cy, z(0.84)), "Chest")
    add_bone("Head", (cx, cy, z(0.84)), (cx, cy, z(0.96)), "Neck")

    add_bone("LeftUpperArm", (cx + shoulder_x, cy, z(0.75)), (cx + elbow_x, cy, z(0.55)), "Chest")
    add_bone("LeftLowerArm", (cx + elbow_x, cy, z(0.55)), (cx + hand_x, front_y, z(0.34)), "LeftUpperArm")
    add_bone("LeftHand", (cx + hand_x, front_y, z(0.34)), (cx + hand_x, front_y, z(0.25)), "LeftLowerArm")
    add_bone("RightUpperArm", (cx - shoulder_x, cy, z(0.75)), (cx - elbow_x, cy, z(0.55)), "Chest")
    add_bone("RightLowerArm", (cx - elbow_x, cy, z(0.55)), (cx - hand_x, front_y, z(0.34)), "RightUpperArm")
    add_bone("RightHand", (cx - hand_x, front_y, z(0.34)), (cx - hand_x, front_y, z(0.25)), "RightLowerArm")

    add_bone("LeftUpperLeg", (cx + hip_x, cy, z(0.50)), (cx + knee_x, cy, z(0.27)), "Hips")
    add_bone("LeftLowerLeg", (cx + knee_x, cy, z(0.27)), (cx + foot_x, cy, z(0.08)), "LeftUpperLeg")
    add_bone("LeftFoot", (cx + foot_x, cy, z(0.08)), (cx + foot_x, front_y, z(0.02)), "LeftLowerLeg")
    add_bone("RightUpperLeg", (cx - hip_x, cy, z(0.50)), (cx - knee_x, cy, z(0.27)), "Hips")
    add_bone("RightLowerLeg", (cx - knee_x, cy, z(0.27)), (cx - foot_x, cy, z(0.08)), "RightUpperLeg")
    add_bone("RightFoot", (cx - foot_x, cy, z(0.08)), (cx - foot_x, front_y, z(0.02)), "RightLowerLeg")

    add_bone("Secondary_Hair_Back", (cx, back_y, z(0.82)), (cx, back_y, z(0.58)), "Head")
    add_bone("Secondary_Hair_Left", (cx + half_width * 0.28, cy, z(0.80)), (cx + half_width * 0.34, back_y, z(0.54)), "Head")
    add_bone("Secondary_Hair_Right", (cx - half_width * 0.28, cy, z(0.80)), (cx - half_width * 0.34, back_y, z(0.54)), "Head")
    add_bone("Secondary_Skirt_Left", (cx + hip_x, cy, z(0.48)), (cx + half_width * 0.36, cy, z(0.20)), "Hips")
    add_bone("Secondary_Skirt_Right", (cx - hip_x, cy, z(0.48)), (cx - half_width * 0.36, cy, z(0.20)), "Hips")

    bpy.ops.object.mode_set(mode="OBJECT")
    armature.show_in_front = True
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
    return armature


def mix(weights: dict[str, float], name: str, value: float) -> None:
    if value <= 0:
        return
    weights[name] = weights.get(name, 0.0) + value


def assign_weights(meshes: list[bpy.types.Object], armature: bpy.types.Object, bounds_min: Vector, bounds_max: Vector) -> dict[str, int]:
    size = bounds_max - bounds_min
    cx = (bounds_min.x + bounds_max.x) * 0.5
    cy = (bounds_min.y + bounds_max.y) * 0.5
    height = max(0.001, size.z)
    half_width = max(0.001, size.x * 0.5)
    bone_names = [bone.name for bone in armature.data.bones]
    assignments = {name: 0 for name in bone_names}

    for obj in meshes:
      obj.vertex_groups.clear()
      groups = {name: obj.vertex_groups.new(name=name) for name in bone_names}

      for vertex in obj.data.vertices:
          world = obj.matrix_world @ vertex.co
          t = max(0.0, min(1.0, (world.z - bounds_min.z) / height))
          x_norm = (world.x - cx) / half_width
          abs_x = abs(x_norm)
          y_norm = (world.y - cy) / max(0.001, size.y * 0.5)
          left = x_norm >= 0
          side = "Left" if left else "Right"
          weights: dict[str, float] = {}

          if t > 0.84:
              mix(weights, "Head", 0.86)
              mix(weights, "Neck", 0.14)
              if y_norm > 0.12 or abs_x > 0.35:
                  mix(weights, f"Secondary_Hair_{'Left' if left else 'Right'}", 0.10)
                  mix(weights, "Secondary_Hair_Back", 0.10 if y_norm > 0 else 0.04)
          elif t > 0.75:
              mix(weights, "Head", 0.45)
              mix(weights, "Neck", 0.30)
              mix(weights, "Chest", 0.25)
              if abs_x > 0.42:
                  mix(weights, f"Secondary_Hair_{side}", 0.12)
          elif abs_x > 0.60 and 0.24 < t < 0.76:
              if t > 0.55:
                  mix(weights, f"{side}UpperArm", 0.78)
                  mix(weights, "Chest", 0.22)
              elif t > 0.38:
                  mix(weights, f"{side}UpperArm", 0.42)
                  mix(weights, f"{side}LowerArm", 0.58)
              else:
                  mix(weights, f"{side}LowerArm", 0.62)
                  mix(weights, f"{side}Hand", 0.38)
          elif t > 0.66:
              mix(weights, "Chest", 0.72)
              mix(weights, "Spine", 0.28)
          elif t > 0.52:
              mix(weights, "Spine", 0.58)
              mix(weights, "Hips", 0.32)
              mix(weights, "Chest", 0.10)
          elif t > 0.42:
              mix(weights, "Hips", 0.58)
              if abs_x > 0.22:
                  mix(weights, f"{side}UpperLeg", 0.28)
                  mix(weights, f"Secondary_Skirt_{side}", 0.14)
              else:
                  mix(weights, "Spine", 0.14)
          elif t > 0.25:
              if abs_x > 0.12:
                  mix(weights, f"{side}UpperLeg", 0.62)
                  mix(weights, "Hips", 0.18)
                  mix(weights, f"Secondary_Skirt_{side}", 0.20)
              else:
                  mix(weights, "Hips", 0.72)
                  mix(weights, "Spine", 0.28)
          elif t > 0.10:
              mix(weights, f"{side}LowerLeg", 0.70)
              mix(weights, f"{side}UpperLeg", 0.22)
              mix(weights, f"Secondary_Skirt_{side}", 0.08 if abs_x > 0.24 else 0.0)
          else:
              mix(weights, f"{side}Foot", 0.72)
              mix(weights, f"{side}LowerLeg", 0.28)

          total = sum(weights.values()) or 1.0
          for name, weight in weights.items():
              normalized = weight / total
              groups[name].add([vertex.index], normalized, "ADD")
              assignments[name] += 1

      modifier = obj.modifiers.new("MatureSenpaiArmature", "ARMATURE")
      modifier.object = armature
      modifier.use_vertex_groups = True
      obj.parent = armature
      obj.matrix_parent_inverse = armature.matrix_world.inverted()

    return assignments


def key_bones(armature: bpy.types.Object, frame: int) -> None:
    for name in ANIMATED_BONES:
        bone = armature.pose.bones.get(name)
        if not bone:
            continue
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
        if name == "Hips":
            bone.keyframe_insert(data_path="location", frame=frame)


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)


def stash_action(armature: bpy.types.Object, action: bpy.types.Action, start: int, end: int) -> None:
    if not armature.animation_data:
        armature.animation_data_create()
    track = armature.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, start, action)
    strip.name = action.name
    strip.frame_start = start
    strip.frame_end = end


def build_actions(armature: bpy.types.Object) -> list[str]:
    bpy.context.view_layer.objects.active = armature
    if not armature.animation_data:
        armature.animation_data_create()
    created: list[str] = []

    def action(name: str, frame_end: int, sampler) -> None:
        reset_pose(armature)
        act = bpy.data.actions.new(name)
        armature.animation_data.action = act
        for frame in range(1, frame_end + 1, 4):
            reset_pose(armature)
            phase = (frame - 1) / max(1, frame_end - 1)
            sampler(phase)
            key_bones(armature, frame)
        reset_pose(armature)
        sampler(0.0)
        key_bones(armature, frame_end)
        act.frame_range = (1, frame_end)
        stash_action(armature, act, 1, frame_end)
        created.append(name)
        armature.animation_data.action = None

    def idle_sampler(phase: float) -> None:
        wave = math.sin(phase * math.tau)
        armature.pose.bones["Hips"].location.z = wave * 0.006
        armature.pose.bones["Spine"].rotation_euler.x = wave * 0.025
        armature.pose.bones["Chest"].rotation_euler.x = wave * 0.018
        armature.pose.bones["Head"].rotation_euler.z = math.sin(phase * math.tau + 0.7) * 0.025
        armature.pose.bones["LeftUpperArm"].rotation_euler.z = -0.06 + wave * 0.012
        armature.pose.bones["RightUpperArm"].rotation_euler.z = 0.06 - wave * 0.012
        armature.pose.bones["Secondary_Hair_Back"].rotation_euler.x = -wave * 0.045
        armature.pose.bones["Secondary_Skirt_Left"].rotation_euler.y = wave * 0.025
        armature.pose.bones["Secondary_Skirt_Right"].rotation_euler.y = -wave * 0.025

    def walk_sampler(phase: float) -> None:
        stride = math.sin(phase * math.tau)
        opposite = math.sin(phase * math.tau + math.pi)
        bounce = abs(math.cos(phase * math.tau))
        armature.pose.bones["Hips"].location.z = bounce * 0.018
        armature.pose.bones["Hips"].rotation_euler.y = stride * 0.025
        armature.pose.bones["Chest"].rotation_euler.y = -stride * 0.035
        armature.pose.bones["LeftUpperLeg"].rotation_euler.x = stride * 0.34
        armature.pose.bones["RightUpperLeg"].rotation_euler.x = opposite * 0.34
        armature.pose.bones["LeftLowerLeg"].rotation_euler.x = max(0, -stride) * 0.42
        armature.pose.bones["RightLowerLeg"].rotation_euler.x = max(0, stride) * 0.42
        armature.pose.bones["LeftFoot"].rotation_euler.x = max(0, stride) * 0.16
        armature.pose.bones["RightFoot"].rotation_euler.x = max(0, opposite) * 0.16
        armature.pose.bones["LeftUpperArm"].rotation_euler.x = opposite * 0.28
        armature.pose.bones["RightUpperArm"].rotation_euler.x = stride * 0.28
        armature.pose.bones["LeftLowerArm"].rotation_euler.x = -0.10 + stride * 0.08
        armature.pose.bones["RightLowerArm"].rotation_euler.x = -0.10 + opposite * 0.08
        armature.pose.bones["Secondary_Hair_Back"].rotation_euler.x = -stride * 0.08
        armature.pose.bones["Secondary_Hair_Left"].rotation_euler.z = -stride * 0.055
        armature.pose.bones["Secondary_Hair_Right"].rotation_euler.z = -stride * 0.055
        armature.pose.bones["Secondary_Skirt_Left"].rotation_euler.y = stride * 0.07
        armature.pose.bones["Secondary_Skirt_Right"].rotation_euler.y = opposite * 0.07

    def talk_sampler(phase: float) -> None:
        wave = math.sin(phase * math.tau)
        soft = math.sin(phase * math.tau * 2.0)
        armature.pose.bones["Head"].rotation_euler.z = wave * 0.045
        armature.pose.bones["Head"].rotation_euler.x = soft * 0.018
        armature.pose.bones["Chest"].rotation_euler.z = -wave * 0.018
        armature.pose.bones["LeftUpperArm"].rotation_euler.z = -0.12 + wave * 0.035
        armature.pose.bones["LeftLowerArm"].rotation_euler.x = -0.16 + soft * 0.04
        armature.pose.bones["RightUpperArm"].rotation_euler.z = 0.11 - wave * 0.030
        armature.pose.bones["RightLowerArm"].rotation_euler.x = -0.15 - soft * 0.035
        armature.pose.bones["Secondary_Hair_Back"].rotation_euler.x = -wave * 0.035

    action("idle", 60, idle_sampler)
    action("walk", 32, walk_sampler)
    action("talk", 48, talk_sampler)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 60
    return created


def export_glb(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_frame_range=False,
        export_materials="EXPORT",
        export_yup=True,
    )


def count_triangles(meshes: list[bpy.types.Object]) -> int:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        total += sum(len(poly.vertices) - 2 for poly in mesh.polygons)
        evaluated.to_mesh_clear()
    return total


def write_report(report_path: Path, input_path: Path, output_path: Path, meshes: list[bpy.types.Object], armature: bpy.types.Object, assignments: dict[str, int], actions: list[str]) -> None:
    bounds_min, bounds_max = world_bounds(meshes)
    report = {
        "source": str(input_path),
        "output": str(output_path),
        "model": {
            "meshCount": len(meshes),
            "triangleCount": count_triangles(meshes),
            "vertexCount": sum(len(obj.data.vertices) for obj in meshes),
            "boundsMin": [round(v, 5) for v in bounds_min],
            "boundsMax": [round(v, 5) for v in bounds_max],
            "size": [round(v, 5) for v in (bounds_max - bounds_min)],
        },
        "rig": {
            "armature": armature.name,
            "bones": [bone.name for bone in armature.data.bones],
            "weightedVertexAssignments": assignments,
        },
        "animations": actions,
        "limitations": [
            "single Hunyuan mesh, not hand-retopologized",
            "coordinate-region weights, not final hand-painted skin weights",
            "no facial morph targets yet",
            "hair and skirt secondary motion is approximate",
        ],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> None:
    input_path, output_path, report_path = parse_args()
    reset_scene()
    meshes = import_model(input_path)
    bounds_min, bounds_max = world_bounds(meshes)
    armature = create_armature(bounds_min, bounds_max)
    assignments = assign_weights(meshes, armature, bounds_min, bounds_max)
    actions = build_actions(armature)
    write_report(report_path, input_path, output_path, meshes, armature, assignments, actions)
    export_glb(output_path)
    print(json.dumps({
        "status": "ok",
        "output": str(output_path),
        "report": str(report_path),
        "actions": actions,
        "bones": len(armature.data.bones),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

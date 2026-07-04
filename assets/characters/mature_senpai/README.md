# Mature Senpai Character Asset

Current target: v7 mature senpai concept, used as an adult academy NPC.

## Current Files

- `references/concept-sheet-v7-roman-strappy-heels.png`: preferred concept.
- `references/hunyuan-multiview-v7/`: Hunyuan3D multi-view upload images.
- `character-model-brief.json`: source-of-truth model brief.
- `tools/rig_hunyuan_preview.py`: Blender batch rigging script for the current preview asset.
- `tools/build_retopo_v3.py`: BlenderMCP production-structure script that rebuilds the Hunyuan mesh into named skinned submeshes, rule-painted weights, facial morph targets, and secondary-motion hooks.
- `mature_senpai_rigged_v1.report.json`: generated rig and animation audit.
- `mature_senpai_production_v1.report.json`: disabled procedural template audit and decision record.
- `mature_senpai_retopo_v3.report.json`: active automated retopo/parts/morph/weights/secondary-bone audit.
- `mature_senpai_mcp_polish_v2.report.json`: previous BlenderMCP polish audit and visual fallback.
- `mature_senpai_mcp_retouch_v1.report.json`: previous BlenderMCP retouch audit and runtime fallback.
- `source/mature_senpai.blend`: procedural Blender reference template for rigging and modular cleanup experiments.
- `source/mature_senpai_retopo_v3.blend`: active automated production-structure source scene.
- `source/mature_senpai_mcp_polish_v2.blend`: active BlenderMCP-polished Hunyuan source scene.
- `source/mature_senpai_mcp_retouch_v1.blend`: BlenderMCP-retouched Hunyuan source scene.
- `candidates/registered/mature-senpai-hunyuan-v7-textured-preview/`: local 179k triangle Hunyuan audit candidate.
- `candidates/registered/mature-senpai-hunyuan-v7-web/`: local 60k triangle Hunyuan audit candidate.

Runtime export registered for preview:

- `mature_senpai_retopo_v3.glb`: active automated production-structure asset with 11 named skinned submeshes, `Blink`, `WarmSmile`, and `Surprised` morph targets on the face mesh, refreshed rule-painted weights, and secondary hair/skirt bones.
- `mature_senpai_mcp_polish_v2.glb`: previous Hunyuan-based BlenderMCP polish, retained as visual fallback.
- `mature_senpai_mcp_retouch_v1.glb`: previous Hunyuan-based BlenderMCP retouch, retained as runtime fallback.
- `mature_senpai_rigged_v1.glb`: 60k triangle auto-rigged web preview with `idle`, `walk`, and `talk` clips.
- `mature_senpai_production_v1.glb`: disabled procedural Blender template export; useful for bone, morph, and modular-part reference, but not visually close enough to replace the Hunyuan mesh.

Local inspection exports not intended for the runtime commit:

- `mature_senpai_hunyuan_v7_web.glb`: 60k triangle static web-test source export.
- `mature_senpai_hunyuan_v7_raw.glb`: high-detail textured source export, about 1.5M triangles.
- `mature_senpai_hunyuan_v7_preview.glb`: 179k triangle preview export.

## Current Gate

The automated retopo v3 Hunyuan output is the active runtime preview because it
keeps the more lively AI-generated likeness while adding named skinned submeshes,
facial morph targets, refreshed rule-painted weights, and secondary hair/skirt
bone hooks. The procedural Blender template has cleaner authored separation and
morph hooks, but it is too schematic to become the default visual model.

Remaining production blockers:

- The topology is split from Hunyuan triangles and UVs, not hand-drawn quad
  retopology.
- Skin weights are deterministic Blender rules, not artist brush-painted final
  weights.
- Facial morphs are subtle generated shape keys, not sculpted expression
  blendshapes.
- Hair and skirt secondary motion is bone-driven and approximate.
- The character still needs artist retopology, texture cleanup, and final
  expression sculpting before it should be treated as final mainstream
  JRPG-quality runtime art.

The `mature_senpai_retopo_v3.glb` file is the current in-game animated
preview NPC. It should not be considered final until retopology, hand-painted
weights, face morphs, and final material polish are complete. The next
production pass should preserve the Hunyuan model's likeness instead of
replacing it with the procedural template's simplified silhouette.

## Next Production Step

1. Replace the automated Hunyuan-triangle split with artist-authored quad
   topology while preserving the v7 likeness.
2. Brush-paint final deformation weights over the generated rule weights.
3. Sculpt final expression blendshapes for blink, smile, teasing, surprised,
   and thoughtful.
4. Tune secondary-motion bones for long hair, skirt panels, straps, and pendant
   against actual in-game movement.
5. Export to `public/assets/models/mature_senpai.glb`.
6. Register `mature-senpai-supporting-v1` only after the final runtime audit
   and visual QA pass.

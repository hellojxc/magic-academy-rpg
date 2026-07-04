# Mature Senpai Character Asset

Current target: v7 mature senpai concept, used as an adult academy NPC.

## Current Files

- `references/concept-sheet-v7-roman-strappy-heels.png`: preferred concept.
- `references/hunyuan-multiview-v7/`: Hunyuan3D multi-view upload images.
- `character-model-brief.json`: source-of-truth model brief.
- `tools/rig_hunyuan_preview.py`: Blender batch rigging script for the current preview asset.
- `mature_senpai_rigged_v1.report.json`: generated rig and animation audit.
- `mature_senpai_production_v1.report.json`: disabled procedural template audit and decision record.
- `mature_senpai_mcp_polish_v2.report.json`: active BlenderMCP polish audit.
- `mature_senpai_mcp_retouch_v1.report.json`: previous BlenderMCP retouch audit and runtime fallback.
- `source/mature_senpai.blend`: procedural Blender reference template for rigging and modular cleanup experiments.
- `source/mature_senpai_mcp_polish_v2.blend`: active BlenderMCP-polished Hunyuan source scene.
- `source/mature_senpai_mcp_retouch_v1.blend`: BlenderMCP-retouched Hunyuan source scene.
- `candidates/registered/mature-senpai-hunyuan-v7-textured-preview/`: local 179k triangle Hunyuan audit candidate.
- `candidates/registered/mature-senpai-hunyuan-v7-web/`: local 60k triangle Hunyuan audit candidate.

Runtime export registered for preview:

- `mature_senpai_mcp_polish_v2.glb`: active Hunyuan-based BlenderMCP polish with helper geometry removed, smoothed normals, material response polish, and `idle`, `walk`, and `talk` clips.
- `mature_senpai_mcp_retouch_v1.glb`: previous Hunyuan-based BlenderMCP retouch, retained as runtime fallback.
- `mature_senpai_rigged_v1.glb`: 60k triangle auto-rigged web preview with `idle`, `walk`, and `talk` clips.
- `mature_senpai_production_v1.glb`: disabled procedural Blender template export; useful for bone, morph, and modular-part reference, but not visually close enough to replace the Hunyuan mesh.

Local inspection exports not intended for the runtime commit:

- `mature_senpai_hunyuan_v7_web.glb`: 60k triangle static web-test source export.
- `mature_senpai_hunyuan_v7_raw.glb`: high-detail textured source export, about 1.5M triangles.
- `mature_senpai_hunyuan_v7_preview.glb`: 179k triangle preview export.

## Current Gate

The BlenderMCP-polished Hunyuan output is the active runtime preview because it
keeps the more lively AI-generated likeness while cleaning the scene, normals,
and material response. The procedural Blender template has better separation and
morph hooks, but it is too schematic to become the default visual model.

Remaining production blockers:

- No facial morphs.
- Skin weights are coordinate-region generated, not hand-painted.
- Hair and skirt secondary motion is approximate.
- Single source mesh, so face, eyes, hair, outfit, hands, and shoes are not
  separable for production cleanup.
- The character still needs retopology before it should be treated as final
  mainstream JRPG-quality runtime art.

The `mature_senpai_mcp_polish_v2.glb` file is the current in-game animated
preview NPC. It should not be considered final until retopology, hand-painted
weights, face morphs, and final material polish are complete. The next
production pass should preserve the Hunyuan model's likeness instead of
replacing it with the procedural template's simplified silhouette.

## Next Production Step

1. Retopologize the Hunyuan mesh into separated body, face, hair, outfit, hands,
   skirt, pendant, and shoes meshes.
2. Replace the preview armature weights with hand-painted humanoid weights.
3. Add facial morph targets for blink, smile, teasing, surprised, and thoughtful.
4. Add secondary-motion bones for long hair, skirt panels, straps, and pendant.
5. Export to `public/assets/models/mature_senpai.glb`.
6. Register `mature-senpai-supporting-v1` only after the runtime audit passes.

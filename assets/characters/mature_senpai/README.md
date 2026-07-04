# Mature Senpai Character Asset

Current target: v7 mature senpai concept, used as an adult academy NPC.

## Current Files

- `references/concept-sheet-v7-roman-strappy-heels.png`: preferred concept.
- `references/hunyuan-multiview-v7/`: Hunyuan3D multi-view upload images.
- `character-model-brief.json`: source-of-truth model brief.
- `tools/rig_hunyuan_preview.py`: Blender batch rigging script for the current preview asset.
- `mature_senpai_rigged_v1.report.json`: generated rig and animation audit.
- `candidates/registered/mature-senpai-hunyuan-v7-textured-preview/`: local 179k triangle Hunyuan audit candidate.
- `candidates/registered/mature-senpai-hunyuan-v7-web/`: local 60k triangle Hunyuan audit candidate.

Runtime export registered for preview:

- `mature_senpai_rigged_v1.glb`: 60k triangle auto-rigged web preview with `idle`, `walk`, and `talk` clips.

Local inspection exports not intended for the runtime commit:

- `mature_senpai_hunyuan_v7_web.glb`: 60k triangle static web-test source export.
- `mature_senpai_hunyuan_v7_raw.glb`: high-detail textured source export, about 1.5M triangles.
- `mature_senpai_hunyuan_v7_preview.glb`: 179k triangle preview export.

## Current Gate

The Hunyuan output now has a usable auto-rigged game preview. It can load as a
skinned GLB, play basic idle/walk/talk clips, and receive runtime toon/outline
treatment in Three.js.

Remaining production blockers:

- No facial morphs.
- Skin weights are coordinate-region generated, not hand-painted.
- Hair and skirt secondary motion is approximate.
- Single source mesh, so face, eyes, hair, outfit, hands, and shoes are not
  separable for production cleanup.
- The character still needs retopology before it should be treated as final
  mainstream JRPG-quality runtime art.

The `mature_senpai_rigged_v1.glb` file is suitable for an in-game animated
preview NPC. It should not replace the final character until retopology,
hand-painted weights, face morphs, and final material polish are complete.

## Next Production Step

1. Retopologize the Hunyuan mesh into separated body, face, hair, outfit, hands,
   skirt, pendant, and shoes meshes.
2. Replace the preview armature weights with hand-painted humanoid weights.
3. Add facial morph targets for blink, smile, teasing, surprised, and thoughtful.
4. Add secondary-motion bones for long hair, skirt panels, straps, and pendant.
5. Export to `public/assets/models/mature_senpai.glb`.
6. Register `mature-senpai-supporting-v1` only after the runtime audit passes.

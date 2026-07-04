# Mature Senpai Character Asset

Current target: v7 mature senpai concept, used as an adult academy NPC.

## Current Files

- `references/concept-sheet-v7-roman-strappy-heels.png`: preferred concept.
- `references/hunyuan-multiview-v7/`: Hunyuan3D multi-view upload images.
- `character-model-brief.json`: source-of-truth model brief.
- `candidates/registered/mature-senpai-hunyuan-v7-textured-preview/`: local 179k triangle Hunyuan audit candidate.
- `candidates/registered/mature-senpai-hunyuan-v7-web/`: local 60k triangle Hunyuan audit candidate.

Runtime export registered for preview:

- `mature_senpai_hunyuan_v7_web.glb`: 60k triangle web-test export.

Local inspection exports not intended for the runtime commit:

- `mature_senpai_hunyuan_v7_raw.glb`: high-detail textured source export, about 1.5M triangles.
- `mature_senpai_hunyuan_v7_preview.glb`: 179k triangle preview export.

## Current Gate

The Hunyuan output has a useful silhouette and texture match, but it is not a
finished game character.

Blocked items:

- No humanoid skeleton.
- No skin weights.
- No idle, walk, or talk animation clips.
- No facial morphs.
- No secondary-motion bones for hair, skirt, straps, or pendant.
- Single mesh named `Mesh_0`, so face, eyes, hair, outfit, hands, and shoes are
  not separable for production cleanup.

The `mature_senpai_hunyuan_v7_web.glb` file is suitable for static visual review
or a temporary non-animated NPC preview only. It should not replace a gameplay
character until retopology and rigging are complete.

## Next Production Step

1. Retopologize the Hunyuan mesh into separated body, face, hair, outfit, hands,
   skirt, pendant, and shoes meshes.
2. Build a humanoid armature and skin weights.
3. Add facial morph targets for blink, smile, teasing, surprised, and thoughtful.
4. Add secondary-motion bones for long hair, skirt panels, straps, and pendant.
5. Export to `public/assets/models/mature_senpai.glb`.
6. Register `mature-senpai-supporting-v1` only after the runtime audit passes.

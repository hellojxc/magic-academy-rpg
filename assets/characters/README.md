# Character Source Asset Workspace

This directory is the source-of-truth workspace for production character assets.
Runtime files still live under `public/assets/models`, but hero characters should
be made from editable source files here first.

## Directory Contract

```text
assets/characters/<character-id>/
  references/
    portrait.png
    front.png
    side.png
    back.png
  source/
    <character-id>.blend
    textures/
  candidates/
    ai-001.glb
    ai-001-notes.md
  character-model-brief.json
```

The first production target is `lyra`. The current generated template GLBs are
only pipeline probes; they should not be treated as final character art.

## Production Flow

1. Convert the portrait and `CharacterSpec` into a model brief.
2. Generate candidate meshes with AI tools such as CharacterGen or Hunyuan3D.
3. Audit each generated GLB/VRM before registration:

   ```sh
   npm run assets:characters:candidate:audit -- \
     --character lyra \
     --tool charactergen \
     --input /path/to/generated.glb
   ```

   The audit separates `acceptedForCleanup` from `runtimeReady`. AI outputs can
   be useful Blender cleanup candidates without being safe runtime replacements.
4. Register the best inspected candidate:

   ```sh
   npm run assets:characters:candidate:register -- \
     --character lyra \
     --tool charactergen \
     --job lyra-charactergen-001 \
     --input /path/to/generated.glb
   ```

   Registration automatically writes a candidate audit report for GLB, GLTF, and
   VRM inputs. OBJ/FBX sources should be converted to GLB/VRM before automated
   promotion decisions.
5. Bring the best candidate into Blender.
6. Rebuild the face, hair, body, clothing, topology, UVs, materials, rig, facial
   morphs, and secondary-motion bones.
7. Export the source `.blend` to `public/assets/models/<character-id>.glb`.
8. Inspect the GLB and compare it against the portrait in the review page.
9. Enable or keep the asset in `public/assets/models/character-models.json`.

The web runtime should stay stable while source models improve.

## Current Mature Senpai Runtime Layer

`mature_senpai` currently uses `mature-senpai-commercial-v9` as the active
runtime asset. The generated source and audit files are:

- `assets/characters/mature_senpai/tools/build_final_v9.py`
- `assets/characters/mature_senpai/source/mature_senpai_commercial_v9.blend`
- `assets/characters/mature_senpai/mature_senpai_commercial_v9.report.json`
- `public/assets/models/mature_senpai_commercial_v9.glb`
- `public/assets/models/mature_senpai_commercial_v9.png`

This layer completes the current automated Blender pass: helper mesh removal,
hybrid source-preserving runtime retopo, named skinned submesh splitting,
explicit per-part weight profiles, six expression morph targets,
hair/hair-tip/skirt/skirt-tip/strap/pendant secondary bones, and
dialogue-distance face detail overlays. v9 keeps the v8 audit structure and
adds a close-up hand polish pass: rounded segmented fingers, a tighter thumb
pose, soft nail surfaces, and subtle knuckle shade planes. It deliberately
remains marked as a commercial candidate because the topology, hands, and
expression shapes are generated cleanup work rather than a final
artist-sculpted quad retopology and brush-painted weight pass.

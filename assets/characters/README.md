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
3. Bring the best candidate into Blender.
4. Rebuild the face, hair, body, clothing, topology, UVs, materials, rig, facial
   morphs, and secondary-motion bones.
5. Export the source `.blend` to `public/assets/models/<character-id>.glb`.
6. Inspect the GLB and compare it against the portrait in the review page.
7. Enable or keep the asset in `public/assets/models/character-models.json`.

The web runtime should stay stable while source models improve.

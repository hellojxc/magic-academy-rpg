# AI-Assisted Character Source Model Pipeline

## Why This Exists

The procedural Blender template proved the runtime path, but it cannot reach the
portrait likeness and polish expected from a mainstream Japanese RPG character.
The next useful step is not more primitive modeling. It is a source-model
pipeline that can accept AI-generated candidates, Blender cleanup, rigging,
facial morphs, secondary motion, and runtime export.

## Target Outcome

For each hero character, the project should own:

```text
assets/characters/<id>/source/<id>.blend
public/assets/models/<id>.glb
public/assets/character-reviews/<id>.json
public/assets/character-reviews/<id>-source-preview.png
```

The `.blend` file is the editable art source. The `.glb` file is the web runtime
asset. The review JSON and preview image prove whether the model matches the
portrait and runtime requirements.

## Open Source AI 3D Toolchain

The project should test tools in this order:

1. CharacterGen: first choice for portrait-to-character candidate generation.
2. Hunyuan3D: first fallback for image-to-3D shape and texture candidates.
3. ComfyUI-3D-Pack: harness for comparing several 3D generation backends.
4. TRELLIS: general 3D generation fallback.
5. VRM Addon for Blender: export route when a character needs VRM metadata,
   expressions, MToon materials, and spring-bone motion.

The repository list and intended use live in:

```text
assets/characters/ai-toolchain.json
```

These tools are candidate generators, not final game-character exporters. The
expected result is a useful starting mesh or multiview reference. The final model
still needs Blender cleanup.

## Production Steps

1. Generate or draw front, side, and back references from the portrait.
2. Run at least three AI candidate generations for Lyra.
3. Select the candidate with the best silhouette, face proportions, and editable
   hair/clothing structure.
4. Import it into Blender.
5. Rebuild the head, eyes, hair, clothing, hands, and shoes as clean meshes.
6. Retopologize for deformation.
7. UV unwrap and paint toon textures.
8. Build a humanoid rig with deform bones only for export.
9. Add shape keys for blink, smile, shy, surprised, and thinking.
10. Add hair, skirt, capelet, and ribbon secondary-motion bones.
11. Export GLB or VRM.
12. Inspect the asset and compare it against the portrait.
13. Only then update the runtime manifest if the asset is visually acceptable.

## Commands

Inspect runtime and template GLBs:

```sh
npm run assets:characters:inspect
```

Generate the review JSON used by the browser comparison page:

```sh
npm run assets:characters:review
```

Export a production source `.blend`:

```sh
npm run assets:characters:source:export -- --character lyra
```

The export command expects:

```text
assets/characters/lyra/source/lyra.blend
```

It writes:

```text
public/assets/models/lyra.glb
public/assets/character-reviews/lyra-source-preview.png
public/assets/character-reviews/lyra-source-audit.json
```

Open the review page after running the review command:

```text
/tools/character-model-review.html?character=lyra
```

## Quality Gate

A model is not accepted just because it loads in Three.js. It must pass:

- Portrait likeness: face, eyes, hair, expression, silhouette.
- Mesh quality: clean topology, separated hair and clothing sections.
- Rig quality: humanoid skeleton, stable skin weights, no major deformation
  collapse during walk and talk.
- Facial quality: blink and basic expression shape keys.
- Secondary motion: long hair, skirt, cape, and ribbons move naturally.
- Web budget: hero LOD around 25k-45k triangles, limited materials, 4 MB texture
  budget target.
- Runtime proof: loads through `CharacterManifest` without falling back.

## Current Status

The current `player.glb` and `lyra.glb` are runtime prototypes. The
`*.blender-template.glb` files are technical pipeline probes. The next real
milestone is a Lyra source `.blend` produced through an AI candidate plus Blender
cleanup workflow, then exported through `assets:characters:source:export`.

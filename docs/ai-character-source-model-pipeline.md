# AI-Assisted Character Source Model Pipeline

## Why This Exists

The procedural Blender template proved the runtime path, but it cannot reach the
portrait likeness and polish expected from a mainstream Japanese RPG character.
The next useful step is not more primitive modeling. It is a source-model
pipeline that can accept AI-generated candidates, Blender cleanup, rigging,
facial morphs, secondary motion, and runtime export.

The important correction is that the procedural template is no longer treated as
the main art path. It is a fallback and preview placeholder. The main path is a
real source model: a VRM/GLB/PMX-converted character, a Blender-authored base
mesh, or an AI-generated candidate that is rebuilt into clean anime topology.

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

1. StdGEN: first choice for anime-character-specific candidate generation.
2. CharacterGen: portrait-to-character candidate generation fallback.
3. Hunyuan3D: strong general image-to-3D shape and texture candidate fallback.
4. TRELLIS: general 3D generation fallback.
5. InstantMesh or Wonder3D: sparse-view reconstruction baselines.
6. TripoSR: lightweight single-image mesh baseline.
7. SkinTokens: first automatic skinning experiment for cleaned generated meshes.
8. UniRig: automatic skeleton and skinning fallback.
9. VRM Addon for Blender: export route when a character needs VRM metadata,
   expressions, MToon-style materials, and spring-bone motion.
10. MakeHuman or MB-Lab: parameterized humanoid base mesh fallback when AI
    generation is unavailable or too unstable.

The repository list and intended use live in:

```text
assets/characters/ai-toolchain.json
```

These tools are separate pipeline stages, not one-click final game-character
exporters. Image-to-3D tools produce candidate meshes. Auto-rigging tools produce
candidate skeletons and skin weights. The final model still needs Blender cleanup,
retopology, facial morphs, secondary-motion bones, material work, and runtime
audit before it can replace a gameplay character.

Current references worth tracking:

- Hunyuan3D: https://github.com/Tencent-Hunyuan/Hunyuan3D-2
  High-resolution image-to-3D and texture/PBR generation with GLB export
  support.
- TRELLIS: https://github.com/microsoft/TRELLIS
  General 3D generation baseline for candidate meshes.
- VRM Add-on for Blender: https://github.com/saturday06/VRM-Addon-for-Blender
  VRM import/export, expressions, MToon materials, and humanoid metadata.
- UniRig: https://github.com/VAST-AI-Research/UniRig
  Automatic skeleton and skinning research route for candidate rigs.

## Production Steps

1. Generate or draw front, side, and back references from the portrait.
2. Run at least three AI candidate generations for Lyra.
3. Select the candidate with the best silhouette, face proportions, and editable
   hair/clothing structure.
4. If the candidate has no skeleton, run an automatic rigging pass such as
   UniRig only as a starting point.
5. Import it into Blender.
6. Rebuild the head, eyes, hair, clothing, hands, and shoes as clean meshes.
7. Retopologize for deformation.
8. UV unwrap and paint toon textures.
9. Build or repair a humanoid rig with deform bones only for export.
10. Add shape keys for blink, smile, shy, surprised, and thinking.
11. Add hair, skirt, capelet, and ribbon secondary-motion bones.
12. Export GLB or VRM.
13. Inspect the asset and compare it against the portrait.
14. Only then update the runtime manifest if the asset is visually acceptable.

## Commands

Inspect runtime and template GLBs:

```sh
npm run assets:characters:inspect
```

Audit whether runtime GLBs pass the production character gate:

```sh
npm run assets:characters:audit
```

Generate the review JSON used by the browser comparison page:

```sh
npm run assets:characters:review
```

Prepare an AI candidate generation job:

```sh
npm run assets:characters:candidate:prepare -- --character lyra --tool stdgen --job lyra-stdgen-001
npm run assets:characters:candidate:prepare -- --character lyra --tool charactergen --job lyra-charactergen-001
npm run assets:characters:candidate:prepare -- --character lyra --tool hunyuan3d --job lyra-hunyuan3d-001
npm run assets:characters:candidate:prepare -- --character lyra --tool instantmesh --job lyra-instantmesh-001
npm run assets:characters:candidate:prepare -- --character lyra --tool triposr --job lyra-triposr-001
npm run assets:characters:candidate:prepare -- --character lyra --tool skintokens --job lyra-skintokens-001
npm run assets:characters:candidate:prepare -- --character lyra --tool unirig --job lyra-unirig-001
```

Register a generated candidate after an external AI tool writes a mesh:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool charactergen --job lyra-charactergen-001 --input /path/to/generated.glb
```

Register a high-quality external GLB/VRM, audit it, and promote it only if it is
runtime-ready:

```sh
npm run assets:characters:commercial:promote -- --character lyra --input /path/to/lyra.glb --promote
```

For a VRM file, either let the manifest point at `public/assets/models/lyra.vrm`
or provide an explicit runtime output:

```sh
npm run assets:characters:commercial:promote -- --character lyra --input /path/to/lyra.vrm --runtime-output public/assets/models/lyra.vrm --material-profile mtoon --promote
```

The promotion command writes:

```text
assets/characters/<id>/candidates/commercial/<label>/candidate.json
public/assets/models/<id>.glb or public/assets/models/<id>.vrm
public/assets/models/character-models.json
public/assets/character-reviews/<id>-runtime-audit.json
```

Promotion is blocked unless the model passes the candidate runtime gate. Use
`--allow-runtime-reject` only when deliberately putting a prototype into preview.

Prepare a front/side/back modeling reference-sheet job:

```sh
npm run assets:characters:reference:prepare -- --character lyra --tool imagegen --job lyra-reference-sheet-001
```

Register completed reference images:

```sh
npm run assets:characters:reference:register -- --character lyra --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character lyra --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character lyra --type back --input /path/to/back.png
```

Import the current story NPC roster from a preview/generated `npcs.json` file:

```sh
npm run assets:characters:story:import -- --input /tmp/npcs.json --dialogues /tmp/dialogues.json
```

This writes `assets/characters/story-npc-roster.json` and one
`assets/characters/<id>/character-model-brief.json` for every story NPC outside
Lyra. The generated briefs preserve role, area, arc, world position, dialogue
coverage, target silhouette, face priorities, hair priorities, outfit
priorities, runtime budgets, and AI candidate gates.

Generate a Blender-template config from those story NPC briefs:

```sh
npm run assets:characters:npc:template-specs
npm run assets:characters:npc:template-specs -- --limit 6
```

This writes `scripts/blender/story_npc_template_specs.json`. It is a fast batch
entry for preview-quality placeholders and source-model planning: height,
presentation, hair, eyes, outfit palette, held item, and animation personality
are inferred from each `character-model-brief.json`.

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

## Hardware Reality

The current `miemie` preview/build host has Python and enough disk for project
builds, but it does not expose an NVIDIA/CUDA runtime. It currently reports AMD
Radeon Vega integrated graphics, no `nvidia-smi`, and `sudo` requires a
password. Blender 4.0.2 is available at `/home/dennisj/tools/blender/blender`
and `/home/dennisj/.local/blender-4.0.2-linux-x64/blender`, but it is not on
`PATH`. That makes deterministic Blender export practical on `miemie`, but local
StdGEN, CharacterGen, Hunyuan3D, TRELLIS, InstantMesh, Wonder3D, SkinTokens, or
UniRig inference remains impractical on that host.

Use `miemie` for preview, TypeScript builds, GLB inspection, runtime audits,
candidate registration, and Blender headless export through the known executable
paths or `BLENDER_BIN`. Treat heavy AI generation as an external GPU job on a
CUDA workstation, cloud GPU, ComfyUI server, Hugging Face Space, or another
machine. The generated mesh is then registered back into
`assets/characters/<id>/candidates/registered` and continues through Blender
cleanup and source export.

Open the review page after running the review command. The page reads
`public/assets/character-reviews/index.json`, so it can review every generated
NPC brief, not just player and Lyra:

```text
/tools/character-model-review.html?character=lyra
/tools/character-model-review.html?character=mira_voss
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

The visual acceptance gate is separate from the automated runtime audit:

- Face likeness: front close-up matches the registered portrait for eye shape,
  brow line, mouth size, nose treatment, cheek softness, and expression.
- Body design: height, head-to-body ratio, torso volume, limb length, hand size,
  and shoe scale match the character brief.
- Hair construction: bangs, side locks, back volume, accessories, and sway bones
  are separate readable pieces rather than a single cap or flat strips.
- Clothing construction: blouse/jacket/skirt/cape/shoes have silhouette depth,
  seams or panels, and deformation-friendly topology.
- Motion proof: idle, walk, and talk clips play without foot sliding, shoulder
  collapse, elbow popping, wrist twisting, skirt clipping, or hair jitter.
- Web performance: hero characters stay within the declared triangle and
  texture budgets, and supporting NPCs use lower-budget LODs.

## Current Status

The current `player.glb` and `lyra.glb` are runtime prototypes. The
`*.blender-template.glb` files are technical pipeline probes. The latest player
source pass is generated from
`assets/characters/player/source/player.blend` and exports to
`public/assets/models/player.glb` with 24,933 runtime triangles, 17 bones, 11
morph-target primitives, and `idle`, `walk`, and `talk` clips. The latest pass
replaces the old ellipsoid-plus-face-patches head with a single deformed anime
head mesh: a pulled-forward face plane, tapered jaw, broader cranium, ears, more
readable eyes, upper-eye shadow morph meshes, layered prism-mesh short hair, and
individual gloved fingers. It also replaces the old player torso/chest/pelvis
sphere stack with a higher resolution closed academy-jacket body shell, tailored
lapel panels, front-aligned uniform details, and a curved short cape mesh. The
current limb pass replaces the old stretched sphere limbs with stable tapered
cone limb sections, shortened hand details, and sleeve/trouser cloth folds for
readable joints and fabric breaks. The runtime audit accepts it as a web-ready
prototype, and the manifest now marks player facial morph support as enabled. It
is still template-quality compared with a commercial Japanese RPG character.

Mira Voss has the first NPC runtime candidate at
`public/assets/models/mira_voss.glb`. It is a Blender-generated skinned GLB with
25,164 triangles, 17 bones, 9 morph-target primitives, and `idle`, `walk`, and
`talk` animation clips, so it passes the current runtime audit. The latest pass
improves the Mira-specific silhouette, visible eyes, white capelet, deep-blue
bodice, layered skirt, and side-framed silver hair from the model sheet. It is
still a template-quality candidate, not the final mainstream Japanese RPG
character target.

The model-sheet references for both player and Lyra are now registered in
`assets/characters/<id>/references` and mirrored to
`public/assets/character-reviews`.

The preview story roster currently contains 31 NPCs including Lyra. Thirty
additional NPC model briefs have been generated from that roster and its
dialogue data. Mira Voss is the first non-Lyra NPC with a registered model sheet
and split front, side, back, face, hair, and outfit reference images.

The next real milestone is replacing Mira's template geometry with a higher
fidelity AI/generated or hand-modeled source mesh, then repeating the accepted
runtime path for Lyra and the remaining story NPCs.

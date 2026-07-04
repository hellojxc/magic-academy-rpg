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
3. TRELLIS: general 3D generation fallback.
4. TripoSR: lightweight single-image mesh baseline when GPU generation is not
   available.
5. MakeHuman or MB-Lab: parameterized humanoid base mesh fallback when AI
   generation is unavailable or too unstable.
6. ComfyUI-3D-Pack: harness for comparing several 3D generation backends.
7. UniRig: automatic skeleton and skinning candidate pass for a cleaned humanoid
   mesh.
8. VRM Addon for Blender: export route when a character needs VRM metadata,
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
npm run assets:characters:candidate:prepare -- --character lyra --tool charactergen --job lyra-charactergen-001
npm run assets:characters:candidate:prepare -- --character lyra --tool hunyuan3d --job lyra-hunyuan3d-001
npm run assets:characters:candidate:prepare -- --character lyra --tool triposr --job lyra-triposr-001
npm run assets:characters:candidate:prepare -- --character lyra --tool unirig --job lyra-unirig-001
```

Register a generated candidate after an external AI tool writes a mesh:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool charactergen --job lyra-charactergen-001 --input /path/to/generated.glb
```

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

The current `miemie` preview/build host has Blender and Python, but no visible
NVIDIA runtime. That makes local CharacterGen, Hunyuan3D, or TRELLIS inference
impractical on that host. The project pipeline therefore treats AI generation as
an external job that can run on a GPU workstation, cloud GPU, ComfyUI server, or
another machine. The generated mesh is then registered back into
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

## Current Status

The current `player.glb` and `lyra.glb` are runtime prototypes. The
`*.blender-template.glb` files are technical pipeline probes. The latest player
source pass is generated from
`assets/characters/player/source/player.blend` and exports to
`public/assets/models/player.glb` with 24,528 runtime triangles, 17 bones, 11
morph-target primitives, and `idle`, `walk`, and `talk` clips. The latest pass
replaces the old ellipsoid-plus-face-patches head with a single deformed anime
head mesh: a pulled-forward face plane, tapered jaw, broader cranium, ears, more
readable eyes, upper-eye shadow morph meshes, and individual gloved fingers. It
also replaces the old player torso/chest/pelvis sphere stack with a higher
resolution closed academy-jacket body shell, tailored lapel panels, and
front-aligned uniform details. The current limb pass replaces the old stretched
sphere limbs with stable tapered cone limb sections and adds sleeve/trouser cloth
folds for readable joints and fabric breaks. The runtime audit accepts it as a
web-ready prototype, and the manifest now marks player facial morph support as
enabled. It is still template-quality compared with a commercial Japanese RPG
character.

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

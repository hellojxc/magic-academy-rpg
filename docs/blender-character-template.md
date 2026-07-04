# Blender Character Template Pipeline

This project keeps character identity in `src/characters` and runtime model
selection in `public/assets/models/character-models.json`. The Blender template
pipeline is the first DCC-grade asset path for replacing procedural placeholder
characters with reusable anime RPG humanoids.

## Command

```sh
npm run assets:characters:blender
```

The command looks for Blender on `PATH`, known versioned executable names, the
remote `miemie` tool paths, and the macOS app path. If Blender is installed in a
custom location, pass it explicitly:

```sh
BLENDER_BIN=/Applications/Blender.app/Contents/MacOS/Blender npm run assets:characters:blender
```

Known `miemie` paths:

```text
/home/dennisj/tools/blender/blender
/home/dennisj/.local/blender-4.0.2-linux-x64/blender
```

Generate one character:

```sh
npm run assets:characters:blender -- --character lyra
```

Save editable `.blend` sources next to the exported GLBs:

```sh
npm run assets:characters:blender -- --blend
```

Render PNG previews from the generated template GLBs:

```sh
npm run assets:characters:blender:preview
```

## Inputs

- `scripts/blender/character_template_specs.json`
- `scripts/blender/character_template.py`

The JSON file defines body proportions, face colors, hair style, outfit colors,
and animation personality. The Python script turns those specs into a humanoid
armature, modular meshes, toon-friendly materials, and NLA clips.

## Outputs

By default, generated files are written to:

```text
public/assets/models/player.blender-template.glb
public/assets/models/lyra.blender-template.glb
public/assets/models/player.blender-template.png
public/assets/models/lyra.blender-template.png
```

These template outputs do not replace the runtime `player.glb` and `lyra.glb`
until they are visually checked. After approval, copy or export the final files
to the manifest URLs and update `character-models.json` if needed.

## Template Contract

The generated template rig uses stable humanoid node names:

- `Hips`, `Spine`, `Chest`, `Neck`, `Head`
- `LeftUpperArm`, `LeftLowerArm`, `LeftHand`
- `RightUpperArm`, `RightLowerArm`, `RightHand`
- `LeftUpperLeg`, `LeftLowerLeg`, `LeftFoot`
- `RightUpperLeg`, `RightLowerLeg`, `RightFoot`

The generated clips are:

- `idle`
- `walk`
- `talk`

The current pass exports a Blender Armature, weighted meshes, facial morph
targets, animation clips, and a player-specific deformed anime head mesh with a
front face plane instead of only an ellipsoid head. The player torso now uses a
closed tapered jacket mesh instead of separate pelvis, torso, and chest spheres.
The player limbs now use tapered cone sections plus cloth-fold rings instead of
stretched sphere segments. It is still a template generator, not a final
commercial model. The final quality pass should replace the remaining primitive
hair and clothing sections with sculpted topology, UV textures, polished skin
weights, richer facial shape keys, and spring-bone style secondary motion for
hair, skirt, cape, and ribbons.

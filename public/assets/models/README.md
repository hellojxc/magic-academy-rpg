# Character Model Assets

Runtime model loading is controlled by `character-models.json`. The current
preview loads `player.glb` and `lyra.glb` when those files are present and the
manifest entries are enabled.

`scripts/generate-character-glb.mjs` creates the lightweight Three.js-generated
prototype GLBs currently used by the runtime.

`npm run assets:characters:blender` runs the reusable Blender template pipeline
when Blender is installed. Its default outputs are
`player.blender-template.glb` and `lyra.blender-template.glb`; those files should
be visually checked before replacing the runtime `player.glb` and `lyra.glb`.

Production source models should come from `assets/characters/<id>/source/*.blend`
and be exported with `npm run assets:characters:source:export`. Use
`npm run assets:characters:inspect` and the character review page before changing
the runtime manifest.

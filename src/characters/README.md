# Character System

This module is the boundary for production-quality character work.

The existing Three.js procedural characters are useful as temporary fallbacks, but they cannot reach mainstream Japanese RPG character quality by adding more primitives. The intended production path is:

1. Define the character with `CharacterSpec`.
2. Produce a GLB or VRM asset from Blender, VRoid Studio, Maya, or another DCC pipeline.
3. Optimize textures, mesh, skeleton, morph targets, and LODs before shipping to the web runtime.
4. Register the asset in `CharacterManifest`.
5. Let the runtime select an optimized asset or the procedural fallback based on availability and distance.

`CharacterFactory` returns the build plan consumed by `src/three/CharacterModel3D.ts`. The Three layer now receives a `CharacterSpec`, resolves an optimized GLB/VRM asset through the character manifest, and falls back to `ProceduralCharacterRig` only when a production asset is unavailable.

The first reusable DCC template path lives in `scripts/blender`. See
`docs/blender-character-template.md` for the headless Blender command, template
contract, and generated GLB output names.

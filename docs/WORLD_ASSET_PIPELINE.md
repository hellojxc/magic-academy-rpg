# Magic Academy World Asset Pipeline

This project now supports a React Three Fiber runtime in parallel with the legacy Three renderer.

## Runtime Stack

- `@react-three/fiber` for scene composition
- `@react-three/drei` for helpers, labels, instancing, environment lighting and GLB loading
- `@react-three/postprocessing` plus `postprocessing` for AO, bloom, depth of field, ACES tone mapping and vignette
- `@react-three/rapier` plus `ecctrl` for physics-driven character control
- `glTF/GLB` chunks for authored world geometry
- distance-prioritized chunk streaming with staged authored-GLB activation
- instanced vegetation, decals, file-backed PBR material maps, generated lightmaps, HDRI/lightmap directories and cutaway interior walls for playable camera framing

## Runtime Lighting And Reflection Policy

Use baked lightmaps, local chunk lights, environment lighting, AO, bloom and ACES tone mapping as the default quality path. Chunk floors use transparent PBR clearcoat sheen layers for wet stone and polished magical inlays instead of render-target reflections; this avoids black-frame failures on headless or low-end WebGL contexts while still preserving specular material response. Reserve true planar or screen-space reflections for isolated hero water/mirror assets after a browser compatibility pass.

## Authoring Contract

Create or update `assets/world/magic-academy.blend` with these collections:

- `chunk_atrium`
- `chunk_arcane_library`
- `chunk_grand_hall`
- `chunk_dining_hall`
- `chunk_moonlit_lawn`
- `chunk_lake_grotto`
- `chunk_training_yard`
- `chunk_crystal_greenhouse`

Collision-only geometry uses matching collections:

- `collision_atrium`
- `collision_arcane_library`
- etc.

The Blender exporter writes:

- `public/assets/world/chunks/<id>.high.glb`
- `public/assets/world/chunks/<id>.collision.glb`
- `public/assets/world/lightmaps/<id>.lightmap.png` when lightmaps are baked

When a Blender scene is not available, the procedural generator writes the same eight `.high.glb` and `.collision.glb` files so the R3F runtime always has authored chunks to stream.

The procedural authored chunks include a spatial depth pass: interior chunks receive upper vault ribs, clerestory glass, mullions and high occlusion planes; exterior/combat chunks receive terrain skirts, perimeter walls, distant academy silhouettes and tree lines; cavern chunks receive layered rock backdrops, mist sheets, stalactites and wet rock streaks. These are still fallback authored assets, but they define the expected Blender composition targets for a production art pass.

The generated chunks also include a hero surface dressing pass for close-view material richness. It adds chipped tile highlights, deepened grout/contact AO, worn brass glints, parchment scraps, wax drops, ink/soot smudges, leaf litter, twigs, wet puddles, mineral bloom, crystal flakes, chalk scuffs, weapon scrapes and wood splinters. These details are named semantically so the R3F loader can map them to the closest file-backed PBR surface family and so Blender-authored replacements can preserve the same material intent.

Floor slabs now receive a settled tile relief pass before props are added. Each chunk gets individual shallow beveled stone tiles with small height variation, tonal variation and chipped corners layered over the base slab. The slab still provides broad continuity, while the tiles create actual geometry for grazing light, contact shadows and PBR normal detail to read against.

Procedural exterior trees use authored-style construction rather than single blob crowns: tapered trunks, exposed root flares, bark ridges, secondary/fork branches and layered double-sided leaf cards. Distant tree lines use lighter cross-card clusters with the same semantic names so production Blender trees can replace them without changing runtime material classification. The runtime now maps trunk/branch/root names to a dedicated bark PBR set, leaf/canopy/frond names to alpha-cutout foliage PBR, and grass/reed/blade names to alpha-cutout grass PBR.

The runtime also supports a CC0 vendor prop layer driven by `src/r3f/third-party-world-props.json`. Run `npm run assets:world:vendor` to download and optimize selected Polygonal Mind GLBs into `public/assets/world/vendor/cc0/polygonal-mind/**`. These props stream only for active chunks and receive the same semantic PBR material enhancement as authored chunk meshes, letting Blender-authored chunks be supplemented by reusable columns, walls, shelves, lamps, crystals, barrels and training-yard set dressing.

The same manifest owns the vendor runtime metadata. `runtime.lod` assigns hero/set-dressing/detail importance, desktop and mobile fade distances, and shadow distance caps so small props do not keep rendering full shadows off camera. `runtime.colliders` assigns simple box colliders for solid props; the R3F scene turns them into Rapier `CuboidCollider` instances only for active chunks and only while the matching visual placement is inside its LOD range. Keep carpets, curtains, decals and other non-blocking dressing out of `runtime.colliders`.

The R3F runtime also adds an instanced macro surface decal pass after the hand-placed decals. This pass generates deterministic grime, dust, crack, rune-wear, impact, organic-litter and mineral-stain overlays per active chunk, grouped by texture so each decal family uses one instanced draw path. Its purpose is to break up repeated floor and terrain texture reads at camera distance without adding dozens of unique mesh objects. QA exposes the count through `window.__r3fChunkRenderState.macroDecals`.

## Generated Texture Pass

`npm run assets:world:materials` writes browser-loadable PNG textures with no native dependencies:

- `public/assets/world/materials/procedural/<surface>.basecolor.png`
- `public/assets/world/materials/procedural/<surface>.normal.png`
- `public/assets/world/materials/procedural/<surface>.roughness.png`
- `public/assets/world/materials/procedural/<surface>.ao.png`
- `public/assets/world/lightmaps/<chunk>.lightmap.png`
- `public/assets/world/decals/procedural/<decal>.albedo.png`
- `public/assets/world/decals/procedural/<decal>.normal.png`
- `public/assets/world/decals/procedural/<decal>.roughness.png`
- `public/assets/world/vegetation/procedural/<plant>.albedo.png`
- `public/assets/world/vegetation/procedural/<plant>.normal.png`
- `public/assets/world/vegetation/procedural/<plant>.roughness.png`
- `public/assets/world/hdri/academy-night-atrium.hdr`
- `public/assets/world/hdri/academy-night-atrium.preview.png`

Current generated surfaces are `stone`, `wood`, `metal`, `organic`, `crystal`, `ground`, `bark`, `foliage`, and `grass`. The R3F authored chunk loader applies those texture sets by classified surface type, then applies each chunk's generated lightmap as `MeshStandardMaterial.lightMap`. `foliage` and `grass` use alpha-tested PBR maps for leaf/grass silhouettes so vegetation can render with depth writes instead of unstable blended transparency.

Current generated decal sets are `rune-wear`, `grime`, `metal-wear`, `crack`, `spill`, `dust`, `organic-litter`, `mineral-stain`, and `impact`. Runtime surface decals choose from those texture sets by semantic id, so floor cracks, dirt, chalk, liquid spills, leaf litter and mineral stains carry alpha, normal and roughness detail instead of rendering as flat color planes.

Current generated vegetation sets are `grass-clump`, `fern-frond`, and `reed-clump`. Runtime instanced vegetation cards use those color-alpha, normal and roughness maps instead of flat colored planes, so grass, ferns and wetland reeds have cutout silhouettes and respond to IBL/local lighting. Each scatter point expands into two or three crossed cards with type-specific width/height, small offsets and varied tilt; this gives close vegetation more volume while keeping the renderer on instanced geometry.

The generated HDRI is a Radiance RGBE equirectangular map used by the R3F scene as `scene.environment`, giving metals, clearcoat, wet surfaces and crystals image-based lighting. The same HDRI is also assigned to `scene.background` at low intensity and high blurriness, replacing the old flat dark background without washing out the night scene. The PNG next to it is only a tone-mapped preview for asset review.

## Material Targets

Each important material should have:

- base color
- normal
- roughness
- metallic when relevant
- ambient occlusion
- emissive where magical objects glow

Use 2K textures for hero assets and 1K textures for repeated props. Run `npm run assets:world:optimize` before previewing a large authored scene.

The current browser-safe optimization target writes:

- `public/assets/world/chunks/optimized/<id>.high.optimized.glb`
- `public/assets/world/chunks/optimized/<id>.collision.optimized.glb`

The optimizer uses glTF-Transform `optimize` with quantized geometry, mesh joining, instancing and palette texture generation disabled. This keeps runtime parsing stable in headless and browser previews while preserving smaller GLB chunks. Meshopt compression can be re-enabled later after a production browser compatibility pass.

## Commands

```bash
npm run assets:world:materials
npm run assets:world:chunks
npm run assets:world:blender
npm run assets:world:optimize
npm run assets:world:report
```

For a full generated asset pass:

```bash
npm run assets:world
```

Preview the new renderer with:

```bash
npm run dev -- --host 0.0.0.0
# open /?renderer=r3f
```

Run render QA:

```bash
npm run qa:r3f -- "http://127.0.0.1:5173/?renderer=r3f" .qa
QA_WIDTH=390 QA_HEIGHT=844 npm run qa:r3f -- "http://127.0.0.1:5173/?renderer=r3f" .qa
npm run qa:r3f -- "http://127.0.0.1:5173/?renderer=r3f&shot=materials" .qa
```

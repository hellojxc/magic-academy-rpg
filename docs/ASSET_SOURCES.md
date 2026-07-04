# Asset Sources

This project separates public-safe assets from private experiments.

## Public-safe CC0 Vendor Assets

The R3F world can stream CC0 GLB props from:

- Manifest: `src/r3f/third-party-world-props.json`
- Runtime path: `public/assets/world/vendor/cc0/polygonal-mind/**`
- Download and optimization script: `npm run assets:world:vendor`

Current sources include Polygonal Mind collections indexed by
`ToxSam/open-source-3D-assets` and mirrored through permanent GitHub raw URLs:

- `pm-ca-world`: classical mansion architecture, walls, columns, windows, stairs, shelves, carpets, benches and curtains.
- `pm-medieval-fair`: barrels, carts, lamps, signs, tables and wood platform props.
- `pm-crystal-crossroads`: magical crystal clusters and broken ruin columns.

The exterior biomes also use Kenney's `Nature Kit` under CC0:

- `kenney-nature-kit`: grass ground patches, river/shore tiles, trees, bushes, rocks, hanging moss and grass clumps.

The registry metadata is CC0 and each selected collection is marked `CC0`.
The sync script refuses non-CC0 entries and only writes optimized assets under
`/assets/world/vendor/cc0/`.

Runtime placement metadata lives in the same manifest. The library layout
prioritizes CC0 shelves, carpets, benches, tables, lamps and curtains before
procedural detail is added in the R3F scene. The lawn and lake prioritize CC0
Kenney trees, bushes, rocks, grass and riverbank meshes, with procedural PBR
vegetation only used to fill density around those authored props.

The `runtime.lod` map
controls desktop/mobile fade distance and shadow distance, and
`runtime.colliders` defines simple Rapier box colliders for solid set dressing.
Only add colliders for objects the player should physically bump into.

## Private Experiment Assets

Private, non-commercial-only, attribution-heavy, or mixed-license models must
not be added to the CC0 manifest. If they are used for local-only experiments,
keep them under:

`public/assets/world/vendor/private-experiment/`

Record the source URL and license note next to the asset before previewing it.

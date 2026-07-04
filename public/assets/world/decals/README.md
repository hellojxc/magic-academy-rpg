# World Decals

Generated decal textures are written to `procedural/` by:

```bash
npm run assets:world:materials
```

Each decal set contains:

- `<id>.albedo.png` with color and alpha
- `<id>.normal.png`
- `<id>.roughness.png`

The R3F runtime selects decal sets by semantic surface decal id.

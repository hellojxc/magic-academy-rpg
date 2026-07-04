# World Vegetation

Generated vegetation cutout textures are written to `procedural/` by:

```bash
npm run assets:world:materials
```

Each vegetation set contains:

- `<id>.albedo.png` with color and alpha
- `<id>.normal.png`
- `<id>.roughness.png`

The R3F runtime uses these maps on instanced cross-card vegetation clusters for grass, fern and reed scatter points.

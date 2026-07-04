# InstantMesh Job

InstantMesh is a sparse-view reconstruction baseline. Use it to compare whether a generated multi-view mesh preserves the character silhouette better than the character-specific routes.

Upstream setup summary:

```sh
git clone https://github.com/TencentARC/InstantMesh.git
cd InstantMesh
# Follow upstream CUDA/Python setup and checkpoint instructions.
```

Use this project job input:

- Portrait or model sheet: public/assets/portraits/lyra-3d.png
- Prompt: assets/characters/lyra/candidates/jobs/lyra-instantmesh-001/prompt.md
- Expected output folder: assets/characters/lyra/candidates/jobs/lyra-instantmesh-001/outputs

Register the best output:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool instantmesh --job lyra-instantmesh-001 --input /path/to/generated.glb
```

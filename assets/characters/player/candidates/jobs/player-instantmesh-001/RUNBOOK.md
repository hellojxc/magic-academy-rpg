# InstantMesh Job

InstantMesh is a sparse-view reconstruction baseline. Use it to compare whether a generated multi-view mesh preserves the character silhouette better than the character-specific routes.

Upstream setup summary:

```sh
git clone https://github.com/TencentARC/InstantMesh.git
cd InstantMesh
# Follow upstream CUDA/Python setup and checkpoint instructions.
```

Use this project job input:

- Portrait or model sheet: public/assets/portraits/player-3d.png
- Prompt: assets/characters/player/candidates/jobs/player-instantmesh-001/prompt.md
- Expected output folder: assets/characters/player/candidates/jobs/player-instantmesh-001/outputs

Register the best output:

```sh
npm run assets:characters:candidate:register -- --character player --tool instantmesh --job player-instantmesh-001 --input /path/to/generated.glb
```

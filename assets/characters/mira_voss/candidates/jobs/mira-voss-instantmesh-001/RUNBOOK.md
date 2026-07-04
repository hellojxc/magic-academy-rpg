# InstantMesh Job

InstantMesh is a sparse-view reconstruction baseline. Use it to compare whether a generated multi-view mesh preserves the character silhouette better than the character-specific routes.

Upstream setup summary:

```sh
git clone https://github.com/TencentARC/InstantMesh.git
cd InstantMesh
# Follow upstream CUDA/Python setup and checkpoint instructions.
```

Use this project job input:

- Portrait or model sheet: public/assets/portraits/mira_voss-concept.png
- Prompt: assets/characters/mira_voss/candidates/jobs/mira-voss-instantmesh-001/prompt.md
- Expected output folder: assets/characters/mira_voss/candidates/jobs/mira-voss-instantmesh-001/outputs

Register the best output:

```sh
npm run assets:characters:candidate:register -- --character mira_voss --tool instantmesh --job mira-voss-instantmesh-001 --input /path/to/generated.glb
```

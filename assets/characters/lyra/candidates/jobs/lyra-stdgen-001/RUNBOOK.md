# StdGEN Job

StdGEN is the first-choice open-source experiment for anime RPG characters because it treats a character as semantically decomposed parts instead of a generic object mesh.

Upstream setup summary:

```sh
git clone https://github.com/hyz317/StdGEN.git
cd StdGEN
# Follow upstream CUDA/Python setup and checkpoint instructions.
```

Use this project job input:

- Portrait: public/assets/portraits/lyra-3d.png
- Prompt: assets/characters/lyra/candidates/jobs/lyra-stdgen-001/prompt.md
- Expected output folder: assets/characters/lyra/candidates/jobs/lyra-stdgen-001/outputs

After generation, export or copy the best GLB/OBJ result and register it:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool stdgen --job lyra-stdgen-001 --input /path/to/generated.glb
```

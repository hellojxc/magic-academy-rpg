# SkinTokens Job

SkinTokens is not a portrait-to-mesh generator. Use it after a generated or hand-cleaned humanoid mesh has acceptable silhouette but lacks stable skin weights.

Upstream setup summary:

```sh
git clone https://github.com/VAST-AI-Research/SkinTokens.git
cd SkinTokens
# Follow upstream CUDA/Python setup and checkpoint instructions.
```

Use this project job input:

- Source brief: assets/characters/lyra/character-model-brief.json
- Prompt: assets/characters/lyra/candidates/jobs/lyra-skintokens-001/prompt.md
- Expected output folder: assets/characters/lyra/candidates/jobs/lyra-skintokens-001/outputs

Register the rigged candidate after exporting GLB:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool skintokens --job lyra-skintokens-001 --input /path/to/rigged.glb
```

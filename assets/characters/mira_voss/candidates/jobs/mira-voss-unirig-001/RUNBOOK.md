# UniRig Job

UniRig is not a portrait-to-mesh generator. Use it after a generated or cleaned humanoid mesh has acceptable silhouette but lacks skeleton and skin weights.

Upstream setup summary:

```sh
git clone https://github.com/VAST-AI-Research/UniRig.git
cd UniRig
# Follow upstream Python/CUDA setup for automatic skeleton and skinning.
```

Use this project job input:

- Source brief: assets/characters/mira_voss/character-model-brief.json
- Prompt: assets/characters/mira_voss/candidates/jobs/mira-voss-unirig-001/prompt.md
- Expected output folder: assets/characters/mira_voss/candidates/jobs/mira-voss-unirig-001/outputs

Register the rigged candidate after exporting GLB:

```sh
npm run assets:characters:candidate:register -- --character mira_voss --tool unirig --job mira-voss-unirig-001 --input /path/to/rigged.glb
```

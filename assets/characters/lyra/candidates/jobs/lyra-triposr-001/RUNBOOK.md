# TripoSR Job

TripoSR is a lightweight image-to-3D baseline. Use it for quick silhouette probes when a GPU-backed CharacterGen/Hunyuan3D run is unavailable.

Upstream setup summary:

```sh
git clone https://github.com/VAST-AI-Research/TripoSR.git
cd TripoSR
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Use this project job input:

- Portrait or front reference: public/assets/portraits/lyra-3d.png
- Prompt: assets/characters/lyra/candidates/jobs/lyra-triposr-001/prompt.md
- Expected output folder: assets/characters/lyra/candidates/jobs/lyra-triposr-001/outputs

Register the best output:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool triposr --job lyra-triposr-001 --input /path/to/generated.glb
```

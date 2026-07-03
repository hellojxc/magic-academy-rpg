# ComfyUI-3D-Pack Job

Use this route to compare Hunyuan3D, TRELLIS, TripoSR, StableFast3D, and other 3D generation workflows from the same portrait.

Upstream setup summary:

```sh
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI/custom_nodes
git clone https://github.com/MrForExample/ComfyUI-3D-Pack.git
```

Use this project job input:

- Portrait: public/assets/portraits/lyra-3d.png
- Prompt: assets/characters/lyra/candidates/jobs/lyra-comfyui-3d-pack-001/prompt.md
- Expected output folder: assets/characters/lyra/candidates/jobs/lyra-comfyui-3d-pack-001/outputs

Register the best output:

```sh
npm run assets:characters:candidate:register -- --character lyra --tool comfyui-3d-pack --job lyra-comfyui-3d-pack-001 --input /path/to/generated.glb
```

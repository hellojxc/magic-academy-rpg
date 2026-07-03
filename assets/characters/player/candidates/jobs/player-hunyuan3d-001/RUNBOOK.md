# Hunyuan3D Job

Hunyuan3D is the first fallback route for image-to-3D shape and texture candidates.

Upstream setup summary:

```sh
git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git
cd Hunyuan3D-2
pip install -r requirements.txt
pip install -e .
```

Recommended Python API route from the upstream README:

```py
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2')
mesh = pipeline(image='public/assets/portraits/player-3d.png')[0]
mesh.export('outputs/generated.glb')
```

Use this project job input:

- Portrait: public/assets/portraits/player-3d.png
- Prompt: assets/characters/player/candidates/jobs/player-hunyuan3d-001/prompt.md
- Expected output folder: assets/characters/player/candidates/jobs/player-hunyuan3d-001/outputs

Register the best output:

```sh
npm run assets:characters:candidate:register -- --character player --tool hunyuan3d --job player-hunyuan3d-001 --input /path/to/generated.glb
```

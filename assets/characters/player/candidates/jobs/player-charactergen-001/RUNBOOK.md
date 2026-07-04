# CharacterGen Job

CharacterGen is the first-choice route for Lyra because it is built around single-image 3D character generation.

Upstream setup summary:

```sh
git clone https://github.com/zjp-shadow/CharacterGen.git
cd CharacterGen
python3.9 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python webui.py
```

Use this project job input:

- Portrait: public/assets/portraits/player-3d.png
- Prompt: assets/characters/player/candidates/jobs/player-charactergen-001/prompt.md
- Expected output folder: assets/characters/player/candidates/jobs/player-charactergen-001/outputs

After generation, export or copy the best GLB/OBJ result and register it:

```sh
npm run assets:characters:candidate:register -- --character player --tool charactergen --job player-charactergen-001 --input /path/to/generated.glb
```

# Lyra Reference Sheet Job

Job id: `lyra-comfyui-reference-001`
Tool route: `comfyui`

Inputs:

- Portrait: `public/assets/portraits/lyra-3d.png`
- Brief: `assets/characters/lyra/character-model-brief.json`
- Prompt: `assets/characters/lyra/references/jobs/lyra-comfyui-reference-001/prompt.md`

Use a ComfyUI image workflow with reference-image conditioning to produce orthographic model-sheet outputs.

Recommended output names:

```text
model-sheet.png
front.png
side.png
back.png
face-detail.png
hair-breakdown.png
outfit-breakdown.png
```

Register outputs with `assets:characters:reference:register`.

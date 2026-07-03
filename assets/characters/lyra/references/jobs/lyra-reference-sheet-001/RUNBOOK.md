# Lyra Reference Sheet Job

Job id: `lyra-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/lyra-3d.png`
- Brief: `assets/characters/lyra/character-model-brief.json`
- Prompt: `assets/characters/lyra/references/jobs/lyra-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character lyra --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character lyra --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character lyra --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character lyra --type back --input /path/to/back.png
```

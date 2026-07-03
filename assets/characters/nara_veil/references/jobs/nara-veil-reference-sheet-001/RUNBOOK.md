# Nara Veil Reference Sheet Job

Job id: `nara-veil-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/nara_veil-concept.png`
- Brief: `assets/characters/nara_veil/character-model-brief.json`
- Prompt: `assets/characters/nara_veil/references/jobs/nara-veil-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character nara_veil --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character nara_veil --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character nara_veil --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character nara_veil --type back --input /path/to/back.png
```

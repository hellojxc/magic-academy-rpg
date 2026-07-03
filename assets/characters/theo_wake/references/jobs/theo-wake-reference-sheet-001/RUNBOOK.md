# Theo Wake Reference Sheet Job

Job id: `theo-wake-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/theo_wake-concept.png`
- Brief: `assets/characters/theo_wake/character-model-brief.json`
- Prompt: `assets/characters/theo_wake/references/jobs/theo-wake-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character theo_wake --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character theo_wake --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character theo_wake --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character theo_wake --type back --input /path/to/back.png
```

# Sera Lumen Reference Sheet Job

Job id: `sera-lumen-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/sera_lumen-concept.png`
- Brief: `assets/characters/sera_lumen/character-model-brief.json`
- Prompt: `assets/characters/sera_lumen/references/jobs/sera-lumen-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character sera_lumen --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character sera_lumen --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character sera_lumen --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character sera_lumen --type back --input /path/to/back.png
```

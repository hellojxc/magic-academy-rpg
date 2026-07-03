# Corin Ash Reference Sheet Job

Job id: `corin-ash-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/corin_ash-concept.png`
- Brief: `assets/characters/corin_ash/character-model-brief.json`
- Prompt: `assets/characters/corin_ash/references/jobs/corin-ash-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character corin_ash --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character corin_ash --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character corin_ash --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character corin_ash --type back --input /path/to/back.png
```

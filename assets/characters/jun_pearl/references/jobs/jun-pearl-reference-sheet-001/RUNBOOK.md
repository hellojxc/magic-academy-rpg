# Jun Pearl Reference Sheet Job

Job id: `jun-pearl-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/jun_pearl-concept.png`
- Brief: `assets/characters/jun_pearl/character-model-brief.json`
- Prompt: `assets/characters/jun_pearl/references/jobs/jun-pearl-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character jun_pearl --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character jun_pearl --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character jun_pearl --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character jun_pearl --type back --input /path/to/back.png
```

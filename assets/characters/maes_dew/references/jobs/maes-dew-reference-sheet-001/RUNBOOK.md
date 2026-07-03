# Maes Dew Reference Sheet Job

Job id: `maes-dew-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/maes_dew-concept.png`
- Brief: `assets/characters/maes_dew/character-model-brief.json`
- Prompt: `assets/characters/maes_dew/references/jobs/maes-dew-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character maes_dew --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character maes_dew --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character maes_dew --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character maes_dew --type back --input /path/to/back.png
```

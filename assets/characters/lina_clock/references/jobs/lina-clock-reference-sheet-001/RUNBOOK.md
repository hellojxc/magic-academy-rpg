# Lina Clock Reference Sheet Job

Job id: `lina-clock-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/lina_clock-concept.png`
- Brief: `assets/characters/lina_clock/character-model-brief.json`
- Prompt: `assets/characters/lina_clock/references/jobs/lina-clock-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character lina_clock --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character lina_clock --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character lina_clock --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character lina_clock --type back --input /path/to/back.png
```

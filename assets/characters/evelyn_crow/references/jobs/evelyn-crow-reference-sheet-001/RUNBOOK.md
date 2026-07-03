# Evelyn Crow Reference Sheet Job

Job id: `evelyn-crow-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/evelyn_crow-concept.png`
- Brief: `assets/characters/evelyn_crow/character-model-brief.json`
- Prompt: `assets/characters/evelyn_crow/references/jobs/evelyn-crow-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character evelyn_crow --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character evelyn_crow --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character evelyn_crow --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character evelyn_crow --type back --input /path/to/back.png
```

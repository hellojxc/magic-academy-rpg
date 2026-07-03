# Owen Grove Reference Sheet Job

Job id: `owen-grove-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/owen_grove-concept.png`
- Brief: `assets/characters/owen_grove/character-model-brief.json`
- Prompt: `assets/characters/owen_grove/references/jobs/owen-grove-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character owen_grove --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character owen_grove --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character owen_grove --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character owen_grove --type back --input /path/to/back.png
```

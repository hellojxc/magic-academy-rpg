# Orin Bell Reference Sheet Job

Job id: `orin-bell-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/orin_bell-concept.png`
- Brief: `assets/characters/orin_bell/character-model-brief.json`
- Prompt: `assets/characters/orin_bell/references/jobs/orin-bell-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character orin_bell --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character orin_bell --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character orin_bell --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character orin_bell --type back --input /path/to/back.png
```

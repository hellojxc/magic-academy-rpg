# Celine Wisp Reference Sheet Job

Job id: `celine-wisp-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/celine_wisp-concept.png`
- Brief: `assets/characters/celine_wisp/character-model-brief.json`
- Prompt: `assets/characters/celine_wisp/references/jobs/celine-wisp-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character celine_wisp --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character celine_wisp --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character celine_wisp --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character celine_wisp --type back --input /path/to/back.png
```

# Ilya Glass Reference Sheet Job

Job id: `ilya-glass-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/ilya_glass-concept.png`
- Brief: `assets/characters/ilya_glass/character-model-brief.json`
- Prompt: `assets/characters/ilya_glass/references/jobs/ilya-glass-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character ilya_glass --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character ilya_glass --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character ilya_glass --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character ilya_glass --type back --input /path/to/back.png
```

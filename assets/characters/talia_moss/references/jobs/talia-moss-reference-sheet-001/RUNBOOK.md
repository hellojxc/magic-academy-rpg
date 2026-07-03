# Talia Moss Reference Sheet Job

Job id: `talia-moss-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/talia_moss-concept.png`
- Brief: `assets/characters/talia_moss/character-model-brief.json`
- Prompt: `assets/characters/talia_moss/references/jobs/talia-moss-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character talia_moss --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character talia_moss --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character talia_moss --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character talia_moss --type back --input /path/to/back.png
```

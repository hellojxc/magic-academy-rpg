# Vera Night Reference Sheet Job

Job id: `vera-night-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/vera_night-concept.png`
- Brief: `assets/characters/vera_night/character-model-brief.json`
- Prompt: `assets/characters/vera_night/references/jobs/vera-night-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character vera_night --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character vera_night --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character vera_night --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character vera_night --type back --input /path/to/back.png
```

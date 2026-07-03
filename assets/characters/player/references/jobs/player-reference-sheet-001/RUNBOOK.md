# Academy Protagonist Reference Sheet Job

Job id: `player-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/player-3d.png`
- Brief: `assets/characters/player/character-model-brief.json`
- Prompt: `assets/characters/player/references/jobs/player-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character player --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character player --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character player --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character player --type back --input /path/to/back.png
```

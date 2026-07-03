# Selene Moon Reference Sheet Job

Job id: `selene-moon-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/selene_moon-concept.png`
- Brief: `assets/characters/selene_moon/character-model-brief.json`
- Prompt: `assets/characters/selene_moon/references/jobs/selene-moon-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character selene_moon --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character selene_moon --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character selene_moon --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character selene_moon --type back --input /path/to/back.png
```

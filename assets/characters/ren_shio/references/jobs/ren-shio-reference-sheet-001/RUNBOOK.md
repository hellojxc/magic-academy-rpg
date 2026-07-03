# Ren Shio Reference Sheet Job

Job id: `ren-shio-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/ren_shio-concept.png`
- Brief: `assets/characters/ren_shio/character-model-brief.json`
- Prompt: `assets/characters/ren_shio/references/jobs/ren-shio-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character ren_shio --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character ren_shio --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character ren_shio --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character ren_shio --type back --input /path/to/back.png
```

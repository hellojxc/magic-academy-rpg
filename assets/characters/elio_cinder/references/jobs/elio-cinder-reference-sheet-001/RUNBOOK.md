# Elio Cinder Reference Sheet Job

Job id: `elio-cinder-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/elio_cinder-concept.png`
- Brief: `assets/characters/elio_cinder/character-model-brief.json`
- Prompt: `assets/characters/elio_cinder/references/jobs/elio-cinder-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character elio_cinder --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character elio_cinder --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character elio_cinder --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character elio_cinder --type back --input /path/to/back.png
```

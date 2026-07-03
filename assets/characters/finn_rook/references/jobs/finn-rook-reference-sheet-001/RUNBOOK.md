# Finn Rook Reference Sheet Job

Job id: `finn-rook-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/finn_rook-concept.png`
- Brief: `assets/characters/finn_rook/character-model-brief.json`
- Prompt: `assets/characters/finn_rook/references/jobs/finn-rook-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character finn_rook --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character finn_rook --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character finn_rook --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character finn_rook --type back --input /path/to/back.png
```

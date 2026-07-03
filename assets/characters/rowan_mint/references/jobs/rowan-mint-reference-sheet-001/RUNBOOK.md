# Rowan Mint Reference Sheet Job

Job id: `rowan-mint-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/rowan_mint-concept.png`
- Brief: `assets/characters/rowan_mint/character-model-brief.json`
- Prompt: `assets/characters/rowan_mint/references/jobs/rowan-mint-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character rowan_mint --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character rowan_mint --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character rowan_mint --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character rowan_mint --type back --input /path/to/back.png
```

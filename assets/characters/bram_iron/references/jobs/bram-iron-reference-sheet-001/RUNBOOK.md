# Bram Iron Reference Sheet Job

Job id: `bram-iron-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/bram_iron-concept.png`
- Brief: `assets/characters/bram_iron/character-model-brief.json`
- Prompt: `assets/characters/bram_iron/references/jobs/bram-iron-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character bram_iron --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character bram_iron --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character bram_iron --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character bram_iron --type back --input /path/to/back.png
```

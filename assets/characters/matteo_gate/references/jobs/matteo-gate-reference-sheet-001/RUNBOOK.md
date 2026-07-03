# Matteo Gate Reference Sheet Job

Job id: `matteo-gate-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/matteo_gate-concept.png`
- Brief: `assets/characters/matteo_gate/character-model-brief.json`
- Prompt: `assets/characters/matteo_gate/references/jobs/matteo-gate-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character matteo_gate --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character matteo_gate --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character matteo_gate --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character matteo_gate --type back --input /path/to/back.png
```

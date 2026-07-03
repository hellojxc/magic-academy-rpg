# Kael Thorn Reference Sheet Job

Job id: `kael-thorn-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/kael_thorn-concept.png`
- Brief: `assets/characters/kael_thorn/character-model-brief.json`
- Prompt: `assets/characters/kael_thorn/references/jobs/kael-thorn-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character kael_thorn --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character kael_thorn --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character kael_thorn --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character kael_thorn --type back --input /path/to/back.png
```

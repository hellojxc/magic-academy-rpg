# Aria Frost Reference Sheet Job

Job id: `aria-frost-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/aria_frost-concept.png`
- Brief: `assets/characters/aria_frost/character-model-brief.json`
- Prompt: `assets/characters/aria_frost/references/jobs/aria-frost-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character aria_frost --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character aria_frost --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character aria_frost --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character aria_frost --type back --input /path/to/back.png
```

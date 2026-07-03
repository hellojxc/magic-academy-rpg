# Mira Voss Reference Sheet Job

Job id: `mira-voss-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/mira_voss-concept.png`
- Brief: `assets/characters/mira_voss/character-model-brief.json`
- Prompt: `assets/characters/mira_voss/references/jobs/mira-voss-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character mira_voss --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character mira_voss --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character mira_voss --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character mira_voss --type back --input /path/to/back.png
```

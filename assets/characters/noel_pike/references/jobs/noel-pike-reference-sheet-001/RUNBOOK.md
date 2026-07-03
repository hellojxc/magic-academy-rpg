# Noel Pike Reference Sheet Job

Job id: `noel-pike-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/noel_pike-concept.png`
- Brief: `assets/characters/noel_pike/character-model-brief.json`
- Prompt: `assets/characters/noel_pike/references/jobs/noel-pike-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character noel_pike --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character noel_pike --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character noel_pike --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character noel_pike --type back --input /path/to/back.png
```

# Silas Ink Reference Sheet Job

Job id: `silas-ink-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/silas_ink-concept.png`
- Brief: `assets/characters/silas_ink/character-model-brief.json`
- Prompt: `assets/characters/silas_ink/references/jobs/silas-ink-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character silas_ink --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character silas_ink --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character silas_ink --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character silas_ink --type back --input /path/to/back.png
```

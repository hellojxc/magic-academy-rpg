# Iris Vale Reference Sheet Job

Job id: `iris-vale-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/iris_vale-concept.png`
- Brief: `assets/characters/iris_vale/character-model-brief.json`
- Prompt: `assets/characters/iris_vale/references/jobs/iris-vale-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character iris_vale --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character iris_vale --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character iris_vale --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character iris_vale --type back --input /path/to/back.png
```

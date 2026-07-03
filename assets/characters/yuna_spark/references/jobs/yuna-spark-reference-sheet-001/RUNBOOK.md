# Yuna Spark Reference Sheet Job

Job id: `yuna-spark-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/yuna_spark-concept.png`
- Brief: `assets/characters/yuna_spark/character-model-brief.json`
- Prompt: `assets/characters/yuna_spark/references/jobs/yuna-spark-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character yuna_spark --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character yuna_spark --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character yuna_spark --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character yuna_spark --type back --input /path/to/back.png
```

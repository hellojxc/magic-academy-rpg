# Arden Quill Reference Sheet Job

Job id: `arden-quill-reference-sheet-001`
Tool route: `imagegen`

Inputs:

- Portrait: `public/assets/portraits/arden_quill-concept.png`
- Brief: `assets/characters/arden_quill/character-model-brief.json`
- Prompt: `assets/characters/arden_quill/references/jobs/arden-quill-reference-sheet-001/prompt.md`

Use an image generation model to create the modeling sheet from the prompt.

Register outputs:

```sh
npm run assets:characters:reference:register -- --character arden_quill --type model-sheet --input /path/to/model-sheet.png
npm run assets:characters:reference:register -- --character arden_quill --type front --input /path/to/front.png
npm run assets:characters:reference:register -- --character arden_quill --type side --input /path/to/side.png
npm run assets:characters:reference:register -- --character arden_quill --type back --input /path/to/back.png
```

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supportedTools = new Set(['imagegen', 'comfyui', 'manual']);

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function localPublicPath(url) {
  return url.startsWith('/') ? `public${url}` : url;
}

function promptFor(brief, viewSet) {
  const identity = brief.targetIdentity;
  const portraitPath = localPublicPath(brief.referenceImages.portrait);
  const hasPortrait = existsSync(resolve(portraitPath));
  const parts = [
    `Create a clean anime RPG character model sheet for ${brief.displayName}.`,
    '',
    hasPortrait
      ? `Use the portrait target as the source identity: ${portraitPath}.`
      : 'No approved portrait target exists yet. Use the design identity, narrative role, and outfit priorities below as the source of truth.',
    `Style: ${identity.style}.`,
    `Silhouette: ${identity.silhouette}.`,
    `Height: ${identity.heightMeters} meters.`,
    `Head-to-body ratio: ${identity.headToBodyRatio}.`,
    '',
  ];

  if (brief.narrativeSource) {
    parts.push(
      'Narrative role:',
      `- Title: ${brief.narrativeSource.title}`,
      `- Role: ${brief.narrativeSource.role}`,
      `- Arc: ${brief.narrativeSource.arc}`,
      `- Story function: ${brief.narrativeSource.description}`,
      '',
    );
  }

  parts.push(
    'Required views:',
    '- Orthographic front view, neutral A-pose, full body.',
    '- Orthographic side view, neutral A-pose, full body.',
    '- Orthographic back view, neutral A-pose, full body.',
    '- Face close-up with eyes, brows, nose, mouth, cheek tint, and expression notes.',
    '- Hair breakdown showing bangs, side locks, back hair, tips, and accessories.',
    '- Outfit breakdown showing torso, sleeves, lower body, shoes, accessories, and held item.',
    '',
    'Face identity priorities:',
    ...identity.facePriorities.map((item) => `- ${item}`),
    '',
    'Hair identity priorities:',
    ...identity.hairPriorities.map((item) => `- ${item}`),
    '',
    'Outfit identity priorities:',
    ...identity.outfitPriorities.map((item) => `- ${item}`),
    '',
    'Hard constraints:',
    '- Same character across every view.',
    '- No dramatic pose, no perspective camera, no cropped limbs.',
    '- Keep clothing and hair construction unambiguous for Blender modeling.',
    '- Avoid painterly background, effects, props that hide anatomy, or excessive lighting.',
    '- Prefer flat neutral studio lighting on a plain light background.',
    '- The result is a modeling reference, not marketing art.',
  );

  if (viewSet === 'turnaround') {
    parts.push('', 'Layout: front, side, and back full-body views aligned on one sheet.');
  } else if (viewSet === 'breakdown') {
    parts.push('', 'Layout: face detail, hair construction, outfit construction, accessories.');
  } else {
    parts.push('', 'Layout: full turnaround plus detail callouts.');
  }

  return `${parts.join('\n')}\n`;
}

function runbookFor(tool, job) {
  const common = [
    `# ${job.displayName} Reference Sheet Job`,
    '',
    `Job id: \`${job.jobId}\``,
    `Tool route: \`${tool}\``,
    '',
    'Inputs:',
    '',
    `- Portrait: \`${job.input.localPortraitPath}\``,
    `- Brief: \`${job.input.sourceBrief}\``,
    `- Prompt: \`${job.files.prompt}\``,
    '',
  ];

  if (tool === 'imagegen') {
    return [
      ...common,
      'Use an image generation model to create the modeling sheet from the prompt.',
      '',
      'Register outputs:',
      '',
      '```sh',
      `npm run assets:characters:reference:register -- --character ${job.characterId} --type model-sheet --input /path/to/model-sheet.png`,
      `npm run assets:characters:reference:register -- --character ${job.characterId} --type front --input /path/to/front.png`,
      `npm run assets:characters:reference:register -- --character ${job.characterId} --type side --input /path/to/side.png`,
      `npm run assets:characters:reference:register -- --character ${job.characterId} --type back --input /path/to/back.png`,
      '```',
      '',
    ].join('\n');
  }

  if (tool === 'comfyui') {
    return [
      ...common,
      'Use a ComfyUI image workflow with reference-image conditioning to produce orthographic model-sheet outputs.',
      '',
      'Recommended output names:',
      '',
      '```text',
      'model-sheet.png',
      'front.png',
      'side.png',
      'back.png',
      'face-detail.png',
      'hair-breakdown.png',
      'outfit-breakdown.png',
      '```',
      '',
      'Register outputs with `assets:characters:reference:register`.',
      '',
    ].join('\n');
  }

  return [
    ...common,
    'Use this job for hand-drawn or manually edited turnarounds.',
    '',
    'Register completed reference images with `assets:characters:reference:register`.',
    '',
  ].join('\n');
}

const characterId = readArg('--character', 'lyra');
const tool = readArg('--tool', 'imagegen');
const viewSet = readArg('--view-set', 'complete');
if (!supportedTools.has(tool)) {
  console.error(`[reference-sheet-job] Unsupported tool: ${tool}`);
  console.error(`[reference-sheet-job] Supported tools: ${[...supportedTools].join(', ')}`);
  process.exit(1);
}

const briefPath = resolve(`assets/characters/${characterId}/character-model-brief.json`);
const brief = readJson(briefPath);
const jobId = slug(readArg('--job', `${characterId}-${tool}-${viewSet}-${timestamp()}`));
const jobDir = resolve(`assets/characters/${characterId}/references/jobs/${jobId}`);
const outputsDir = `assets/characters/${characterId}/references/jobs/${jobId}/outputs`;
const promptPath = `assets/characters/${characterId}/references/jobs/${jobId}/prompt.md`;
const runbookPath = `assets/characters/${characterId}/references/jobs/${jobId}/RUNBOOK.md`;
const jobJsonPath = `assets/characters/${characterId}/references/jobs/${jobId}/job.json`;

const job = {
  version: 'character-reference-sheet-job-v1',
  jobId,
  characterId,
  displayName: brief.displayName,
  tool,
  viewSet,
  status: 'ready-to-run',
  input: {
    portraitUrl: brief.referenceImages.portrait,
    localPortraitPath: localPublicPath(brief.referenceImages.portrait),
    sourceBrief: `assets/characters/${characterId}/character-model-brief.json`,
  },
  files: {
    prompt: promptPath,
    runbook: runbookPath,
    outputsDir,
  },
  expectedReferenceTypes: [
    'model-sheet',
    'front',
    'side',
    'back',
    'face-detail',
    'hair-breakdown',
    'outfit-breakdown',
  ],
};

mkdirSync(jobDir, { recursive: true });
mkdirSync(resolve(outputsDir), { recursive: true });
writeFileSync(resolve(promptPath), promptFor(brief, viewSet));
writeFileSync(resolve(runbookPath), runbookFor(tool, job));
writeFileSync(resolve(jobJsonPath), `${JSON.stringify(job, null, 2)}\n`);

console.log(`[reference-sheet-job] wrote ${jobJsonPath}`);
console.log(`[reference-sheet-job] wrote ${promptPath}`);
console.log(`[reference-sheet-job] wrote ${runbookPath}`);

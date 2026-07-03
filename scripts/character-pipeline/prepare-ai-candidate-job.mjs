import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supportedTools = new Set([
  'charactergen',
  'hunyuan3d',
  'comfyui-3d-pack',
  'trellis',
  'triposr',
  'unirig',
]);

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

function promptFor(brief, tool) {
  const identity = brief.targetIdentity;
  const requirements = brief.sourceModelRequirements;
  return [
    `Create a production candidate 3D anime RPG character for ${brief.displayName}.`,
    '',
    `Character style: ${identity.style}.`,
    `Silhouette: ${identity.silhouette}.`,
    `Height: ${identity.heightMeters} meters.`,
    `Head-to-body ratio: ${identity.headToBodyRatio}.`,
    '',
    'Face priorities:',
    ...identity.facePriorities.map((item) => `- ${item}`),
    '',
    'Hair priorities:',
    ...identity.hairPriorities.map((item) => `- ${item}`),
    '',
    'Outfit priorities:',
    ...identity.outfitPriorities.map((item) => `- ${item}`),
    '',
    'Output requirements:',
    `- Tool route: ${tool}`,
    `- Runtime target: ${requirements.preferredFormat.toUpperCase()} or ${requirements.acceptableFormat.toUpperCase()}`,
    `- Hero triangle target: ${requirements.triangleBudget.hero[0]}-${requirements.triangleBudget.hero[1]}`,
    `- Required animation clips after Blender cleanup: ${requirements.requiredAnimationClips.join(', ')}`,
    `- Required expressions after Blender cleanup: ${requirements.requiredExpressions.join(', ')}`,
    `- Required secondary motion after Blender cleanup: ${requirements.requiredSecondaryMotion.join(', ')}`,
    '',
    'Important:',
    '- This AI output is only a candidate mesh, not an accepted final asset.',
    '- Preserve portrait likeness over generic anime style.',
    '- Keep hair and clothing as separable editable regions when possible.',
    '- Do not promote to runtime until Blender cleanup, rigging, morphs, and review pass.',
    '',
  ].join('\n');
}

function toolRunbook(tool, job) {
  if (tool === 'charactergen') {
    return [
      '# CharacterGen Job',
      '',
      'CharacterGen is the first-choice route for Lyra because it is built around single-image 3D character generation.',
      '',
      'Upstream setup summary:',
      '',
      '```sh',
      'git clone https://github.com/zjp-shadow/CharacterGen.git',
      'cd CharacterGen',
      'python3.9 -m venv .venv',
      '. .venv/bin/activate',
      'pip install -r requirements.txt',
      'python webui.py',
      '```',
      '',
      'Use this project job input:',
      '',
      `- Portrait: ${job.input.localPortraitPath}`,
      `- Prompt: ${job.files.prompt}`,
      `- Expected output folder: ${job.files.outputsDir}`,
      '',
      'After generation, export or copy the best GLB/OBJ result and register it:',
      '',
      '```sh',
      `npm run assets:characters:candidate:register -- --character ${job.characterId} --tool charactergen --job ${job.jobId} --input /path/to/generated.glb`,
      '```',
      '',
    ].join('\n');
  }

  if (tool === 'hunyuan3d') {
    return [
      '# Hunyuan3D Job',
      '',
      'Hunyuan3D is the first fallback route for image-to-3D shape and texture candidates.',
      '',
      'Upstream setup summary:',
      '',
      '```sh',
      'git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git',
      'cd Hunyuan3D-2',
      'pip install -r requirements.txt',
      'pip install -e .',
      '```',
      '',
      'Recommended Python API route from the upstream README:',
      '',
      '```py',
      'from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline',
      "pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2')",
      `mesh = pipeline(image='${job.input.localPortraitPath}')[0]`,
      "mesh.export('outputs/generated.glb')",
      '```',
      '',
      'Use this project job input:',
      '',
      `- Portrait: ${job.input.localPortraitPath}`,
      `- Prompt: ${job.files.prompt}`,
      `- Expected output folder: ${job.files.outputsDir}`,
      '',
      'Register the best output:',
      '',
      '```sh',
      `npm run assets:characters:candidate:register -- --character ${job.characterId} --tool hunyuan3d --job ${job.jobId} --input /path/to/generated.glb`,
      '```',
      '',
    ].join('\n');
  }

  if (tool === 'comfyui-3d-pack') {
    return [
      '# ComfyUI-3D-Pack Job',
      '',
      'Use this route to compare Hunyuan3D, TRELLIS, TripoSR, StableFast3D, and other 3D generation workflows from the same portrait.',
      '',
      'Upstream setup summary:',
      '',
      '```sh',
      'git clone https://github.com/comfyanonymous/ComfyUI.git',
      'cd ComfyUI/custom_nodes',
      'git clone https://github.com/MrForExample/ComfyUI-3D-Pack.git',
      '```',
      '',
      'Use this project job input:',
      '',
      `- Portrait: ${job.input.localPortraitPath}`,
      `- Prompt: ${job.files.prompt}`,
      `- Expected output folder: ${job.files.outputsDir}`,
      '',
      'Register the best output:',
      '',
      '```sh',
      `npm run assets:characters:candidate:register -- --character ${job.characterId} --tool comfyui-3d-pack --job ${job.jobId} --input /path/to/generated.glb`,
      '```',
      '',
    ].join('\n');
  }

  if (tool === 'triposr') {
    return [
      '# TripoSR Job',
      '',
      'TripoSR is a lightweight image-to-3D baseline. Use it for quick silhouette probes when a GPU-backed CharacterGen/Hunyuan3D run is unavailable.',
      '',
      'Upstream setup summary:',
      '',
      '```sh',
      'git clone https://github.com/VAST-AI-Research/TripoSR.git',
      'cd TripoSR',
      'python3 -m venv .venv',
      '. .venv/bin/activate',
      'pip install -r requirements.txt',
      '```',
      '',
      'Use this project job input:',
      '',
      `- Portrait or front reference: ${job.input.localPortraitPath}`,
      `- Prompt: ${job.files.prompt}`,
      `- Expected output folder: ${job.files.outputsDir}`,
      '',
      'Register the best output:',
      '',
      '```sh',
      `npm run assets:characters:candidate:register -- --character ${job.characterId} --tool triposr --job ${job.jobId} --input /path/to/generated.glb`,
      '```',
      '',
    ].join('\n');
  }

  if (tool === 'unirig') {
    return [
      '# UniRig Job',
      '',
      'UniRig is not a portrait-to-mesh generator. Use it after a generated or cleaned humanoid mesh has acceptable silhouette but lacks skeleton and skin weights.',
      '',
      'Upstream setup summary:',
      '',
      '```sh',
      'git clone https://github.com/VAST-AI-Research/UniRig.git',
      'cd UniRig',
      '# Follow upstream Python/CUDA setup for automatic skeleton and skinning.',
      '```',
      '',
      'Use this project job input:',
      '',
      `- Source brief: ${job.input.sourceBrief}`,
      `- Prompt: ${job.files.prompt}`,
      `- Expected output folder: ${job.files.outputsDir}`,
      '',
      'Register the rigged candidate after exporting GLB:',
      '',
      '```sh',
      `npm run assets:characters:candidate:register -- --character ${job.characterId} --tool unirig --job ${job.jobId} --input /path/to/rigged.glb`,
      '```',
      '',
    ].join('\n');
  }

  return [
    '# TRELLIS Job',
    '',
    'TRELLIS is a general image-to-3D fallback. Use it when character-specific tools fail to preserve useful structure.',
    '',
    'Upstream setup summary:',
    '',
    '```sh',
    'git clone --recurse-submodules https://github.com/microsoft/TRELLIS.git',
    'cd TRELLIS',
    '# Follow upstream conda/CUDA setup.',
    '```',
    '',
    'Use this project job input:',
    '',
    `- Portrait: ${job.input.localPortraitPath}`,
    `- Prompt: ${job.files.prompt}`,
    `- Expected output folder: ${job.files.outputsDir}`,
    '',
    'Register the best output:',
    '',
    '```sh',
    `npm run assets:characters:candidate:register -- --character ${job.characterId} --tool trellis --job ${job.jobId} --input /path/to/generated.glb`,
    '```',
    '',
  ].join('\n');
}

const characterId = readArg('--character', 'lyra');
const tool = readArg('--tool', 'charactergen');
if (!supportedTools.has(tool)) {
  console.error(`[ai-candidate-job] Unsupported tool: ${tool}`);
  console.error(`[ai-candidate-job] Supported tools: ${[...supportedTools].join(', ')}`);
  process.exit(1);
}

const briefPath = resolve(`assets/characters/${characterId}/character-model-brief.json`);
const brief = readJson(briefPath);
const jobId = slug(readArg('--job', `${characterId}-${tool}-${timestamp()}`));
const jobDir = resolve(`assets/characters/${characterId}/candidates/jobs/${jobId}`);
const outputsDir = `assets/characters/${characterId}/candidates/jobs/${jobId}/outputs`;
const localPortraitPath = localPublicPath(brief.referenceImages.portrait);
const promptPath = `assets/characters/${characterId}/candidates/jobs/${jobId}/prompt.md`;
const runbookPath = `assets/characters/${characterId}/candidates/jobs/${jobId}/RUNBOOK.md`;
const jobJsonPath = `assets/characters/${characterId}/candidates/jobs/${jobId}/job.json`;

const job = {
  version: 'ai-character-candidate-job-v1',
  jobId,
  characterId,
  displayName: brief.displayName,
  tool,
  status: 'ready-to-run',
  input: {
    portraitUrl: brief.referenceImages.portrait,
    localPortraitPath,
    sourceBrief: `assets/characters/${characterId}/character-model-brief.json`,
  },
  files: {
    prompt: promptPath,
    runbook: runbookPath,
    outputsDir,
  },
  expectedOutput: {
    registerCommand: `npm run assets:characters:candidate:register -- --character ${characterId} --tool ${tool} --job ${jobId} --input /path/to/generated.glb`,
  },
  acceptanceGate: brief.aiCandidatePlan.acceptanceGate,
};

mkdirSync(jobDir, { recursive: true });
mkdirSync(resolve(outputsDir), { recursive: true });
writeFileSync(resolve(promptPath), promptFor(brief, tool));
writeFileSync(resolve(runbookPath), toolRunbook(tool, job));
writeFileSync(resolve(jobJsonPath), `${JSON.stringify(job, null, 2)}\n`);

console.log(`[ai-candidate-job] wrote ${jobJsonPath}`);
console.log(`[ai-candidate-job] wrote ${promptPath}`);
console.log(`[ai-candidate-job] wrote ${runbookPath}`);

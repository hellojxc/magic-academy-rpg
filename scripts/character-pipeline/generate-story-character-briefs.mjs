import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const baseProfiles = {
  mira_voss: {
    presentation: 'female',
    style: 'mainstream Japanese RPG mirror astrologer heroine',
    silhouette: 'slim academy astrologer with reflective silver-blue accents',
    heightMeters: 1.62,
    headToBodyRatio: 0.2,
    face: ['clear aqua eyes with mirror-like highlights', 'calm worried brows', 'small reserved mouth', 'cool cheek tint'],
    hair: ['long silver-blue hair', 'side-swept fringe', 'mirror shard hairpin', 'separate glossy side locks'],
    outfit: ['blue-white astrologer uniform', 'reflective capelet', 'star chart waist sash', 'mirror star compass accessory', 'ankle boots with silver trim'],
    secondaryMotion: ['long-hair-sway', 'capelet-sway', 'sash-sway'],
  },
  arden_quill: {
    presentation: 'male',
    style: 'mainstream Japanese RPG student editor',
    silhouette: 'lean academy journalist with feather motifs and messenger satchel',
    heightMeters: 1.72,
    headToBodyRatio: 0.18,
    face: ['sharp amber eyes', 'curious slightly guarded brows', 'small skeptical mouth', 'ink-smudged cheek detail'],
    hair: ['short chestnut hair', 'messy editorial bangs', 'small feather clip', 'separate crown tufts'],
    outfit: ['amber-trim academy jacket', 'rolled sleeve shirt', 'press armband', 'paper satchel', 'quill pen accessory'],
    secondaryMotion: ['satchel-sway', 'hair-tip-sway'],
  },
  selene_moon: {
    presentation: 'female',
    style: 'elegant Japanese RPG moon etiquette assistant',
    silhouette: 'tall graceful ceremonial student with crescent cape and formal posture',
    heightMeters: 1.66,
    headToBodyRatio: 0.19,
    face: ['soft moonlit violet eyes', 'composed brows', 'gentle ceremonial smile', 'pearl cheek tint'],
    hair: ['waist-length white-lavender hair', 'crescent side ornament', 'smooth face-framing locks', 'low ribbon tie'],
    outfit: ['moon-phase etiquette uniform', 'ivory blouse', 'lavender layered skirt', 'crescent shoulder cape', 'white heeled boots'],
    secondaryMotion: ['long-hair-sway', 'skirt-sway', 'capelet-sway', 'ribbon-sway'],
  },
  orin_bell: {
    presentation: 'male',
    style: 'Japanese RPG clocktower mechanic student',
    silhouette: 'compact mechanical apprentice with brass gears and tool belt',
    heightMeters: 1.65,
    headToBodyRatio: 0.18,
    face: ['warm brown eyes', 'focused brows', 'small anxious mouth', 'clockwork mark on one hand and cheek'],
    hair: ['short sandy hair', 'gear-shaped side clip', 'practical layered bangs', 'oil-darkened tips'],
    outfit: ['brown academy work jacket', 'brass gear fasteners', 'tool belt', 'rolled cuffs', 'sturdy dark boots'],
    secondaryMotion: ['tool-belt-sway', 'hair-tip-sway'],
  },
  talia_moss: {
    presentation: 'female',
    style: 'soft Japanese RPG greenhouse herbalist heroine',
    silhouette: 'petite herbalist with leafy apron and botanical accessories',
    heightMeters: 1.57,
    headToBodyRatio: 0.21,
    face: ['green gentle eyes', 'soft worried brows', 'small warm smile', 'freckled cheek tint'],
    hair: ['wavy moss-brown hair', 'leaf hairpins', 'loose side braids', 'separate curled tips'],
    outfit: ['greenhouse apron dress', 'cream blouse', 'leaf embroidered capelet', 'seed pouch belt', 'soft brown boots'],
    secondaryMotion: ['braid-sway', 'apron-sway', 'pouch-sway'],
  },
  ren_shio: {
    presentation: 'male',
    style: 'Japanese RPG eastern exchange sword-mage',
    silhouette: 'athletic exchange student with short haori cape and broken blade',
    heightMeters: 1.74,
    headToBodyRatio: 0.18,
    face: ['deep blue focused eyes', 'straight determined brows', 'restrained serious mouth', 'small cheek scar'],
    hair: ['dark indigo tied-back hair', 'loose front strands', 'short ponytail', 'separate swordmage locks'],
    outfit: ['east-inspired academy haori', 'blue-black uniform layers', 'sword charm belt', 'broken blade accessory', 'split-toe boots'],
    secondaryMotion: ['ponytail-sway', 'haori-sway', 'blade-charm-sway'],
  },
  elio_cinder: {
    presentation: 'male',
    style: 'warm Japanese RPG flame kitchen mage',
    silhouette: 'sturdy culinary fire mage with apron coat and ember gloves',
    heightMeters: 1.7,
    headToBodyRatio: 0.18,
    face: ['orange-brown lively eyes', 'friendly thick brows', 'confident grin', 'warm cheek tint'],
    hair: ['short copper hair', 'flame-shaped fringe', 'dark underlayer', 'ember hairpin'],
    outfit: ['red-orange kitchen mage coat', 'heatproof apron', 'rolled sleeves', 'ember gloves', 'heavy kitchen boots'],
    secondaryMotion: ['apron-sway', 'flame-charm-sway'],
  },
  nara_veil: {
    presentation: 'female',
    style: 'dramatic Japanese RPG illusion theatre heroine',
    silhouette: 'slender stage magician with veil ribbons and asymmetric skirt',
    heightMeters: 1.64,
    headToBodyRatio: 0.2,
    face: ['magenta playful eyes', 'arched performer brows', 'mysterious smile', 'stage makeup cheek mark'],
    hair: ['dark plum hair', 'side ponytail', 'veil ribbon strands', 'separate curled bangs'],
    outfit: ['magenta illusionist academy costume', 'short cape veil', 'asymmetric skirt', 'star curtain sash', 'heeled ankle boots'],
    secondaryMotion: ['side-ponytail-sway', 'veil-sway', 'skirt-sway'],
  },
  cassia_rune: {
    presentation: 'female',
    style: 'polished Japanese RPG rune honor student',
    silhouette: 'neat elite student with rune ribbons and formal robe panels',
    heightMeters: 1.63,
    headToBodyRatio: 0.19,
    face: ['violet analytical eyes', 'precise confident brows', 'small proud mouth', 'cool cheek tint'],
    hair: ['straight dark violet hair', 'blunt bangs', 'rune hair ribbon', 'clean back sheet'],
    outfit: ['purple rune scholar uniform', 'formal robe panels', 'glowing rune belt', 'book clasp accessory', 'black academy boots'],
    secondaryMotion: ['robe-panel-sway', 'ribbon-sway'],
  },
  yuna_spark: {
    presentation: 'female',
    style: 'energetic Japanese RPG lightning freshman',
    silhouette: 'small lively lightning student with oversized lab jacket and spark clips',
    heightMeters: 1.54,
    headToBodyRatio: 0.22,
    face: ['bright golden eyes', 'eager nervous brows', 'open excited smile', 'small spark cheek mark'],
    hair: ['short fluffy yellow hair', 'lightning bolt side clips', 'messy outward tips', 'separate bang spikes'],
    outfit: ['yellow-accent academy lab coat', 'short uniform skirt or shorts', 'insulated gloves', 'battery charm belt', 'rubber-soled boots'],
    secondaryMotion: ['hair-tip-sway', 'lab-coat-sway', 'charm-sway'],
  },
  evelyn_crow: {
    presentation: 'female',
    style: 'strict Japanese RPG discipline committee heroine',
    silhouette: 'tall black-uniform prefect with crow-feather capelet',
    heightMeters: 1.68,
    headToBodyRatio: 0.19,
    face: ['dark red serious eyes', 'sharp disciplined brows', 'small firm mouth', 'cool pale cheek tone'],
    hair: ['long black hair', 'straight side bangs', 'crow feather hairpiece', 'low tied back locks'],
    outfit: ['black discipline uniform', 'red armband', 'crow-feather capelet', 'silver rulebook chain', 'polished black boots'],
    secondaryMotion: ['long-hair-sway', 'capelet-sway', 'chain-sway'],
  },
  vera_night: {
    presentation: 'female',
    style: 'mysterious Japanese RPG night archive heroine',
    silhouette: 'quiet midnight archivist with dark cardigan robe and future-ink motifs',
    heightMeters: 1.61,
    headToBodyRatio: 0.2,
    face: ['deep violet tired eyes', 'soft uncertain brows', 'small hesitant mouth', 'subtle under-eye shadow'],
    hair: ['long midnight-blue hair', 'soft side bangs', 'ink-black ribbon', 'loose low tail'],
    outfit: ['dark archive cardigan robe', 'blue-black academy dress', 'silver book chain', 'midnight ledger accessory', 'soft black boots'],
    secondaryMotion: ['low-tail-sway', 'robe-sway', 'book-chain-sway'],
  },
};

const fallbackPalettes = {
  grand_hall: ['ivory academy uniform', 'formal capelet', 'ceremonial sash'],
  atrium: ['standard academy jacket', 'personalized waist sash', 'light travel satchel'],
  library: ['scholar cardigan', 'book charm belt', 'soft boots'],
  greenhouse: ['botanical apron uniform', 'leaf embroidery', 'gardening pouch'],
  training_ground: ['combat academy uniform', 'reinforced gloves', 'practical boots'],
  dining_hall: ['work apron uniform', 'rolled sleeves', 'utility belt'],
  lake: ['waterproof academy cloak', 'shell or pearl accessory', 'soft boots'],
  lawn: ['outdoor academy cape', 'messenger pouch', 'weathered boots'],
  moonstone_grotto: ['moonstone-trim robe', 'glow charm', 'soft cave-walking boots'],
};

function titleToFeature(npc) {
  const text = `${npc.title} ${npc.role} ${npc.arc}`;
  if (text.includes('镜')) return 'mirror charm accessory';
  if (text.includes('钟') || text.includes('时间')) return 'clockwork charm accessory';
  if (text.includes('月')) return 'crescent moon accessory';
  if (text.includes('火') || text.includes('灰')) return 'ember charm accessory';
  if (text.includes('湖') || text.includes('水') || text.includes('珍珠')) return 'water pearl accessory';
  if (text.includes('符')) return 'rune ribbon accessory';
  if (text.includes('信') || text.includes('档案')) return 'letter satchel accessory';
  if (text.includes('花') || text.includes('藤') || text.includes('草')) return 'botanical charm accessory';
  return `${npc.role} signature prop`;
}

function fallbackProfile(npc) {
  const areaItems = fallbackPalettes[npc.area] ?? fallbackPalettes.atrium;
  const feature = titleToFeature(npc);
  return {
    presentation: 'supporting',
    style: `mainstream Japanese RPG academy NPC, ${npc.role}`,
    silhouette: `readable academy supporting character for ${npc.title}`,
    heightMeters: 1.58 + ((npc.order ?? 0) % 8) * 0.025,
    headToBodyRatio: 0.19,
    face: [
      'large readable anime eyes matching the role mood',
      'clear brows that show the personal conflict',
      'minimal stylized nose',
      'small expressive mouth',
    ],
    hair: [
      'distinct silhouette hair matching the role',
      'separate bangs and side locks',
      'one recognizable hair accessory',
      'game-ready hair chunks for later rigging',
    ],
    outfit: [
      ...areaItems,
      feature,
      'school crest detail',
    ],
    secondaryMotion: ['hair-tip-sway', 'cloth-sway', 'accessory-sway'],
  };
}

function profileFor(npc) {
  return baseProfiles[npc.id] ?? fallbackProfile(npc);
}

function dialogueSummaryFor(dialogues, npcId) {
  const trees = dialogues?.[npcId];
  if (!Array.isArray(trees)) return undefined;
  return {
    trees: trees.length,
    pages: trees.reduce((total, tree) => total + (Array.isArray(tree.pages) ? tree.pages.length : 0), 0),
    firstTreeId: trees[0]?.id,
  };
}

function briefFor(npc, dialogueSummary) {
  const profile = profileFor(npc);
  const characterId = npc.id;
  const isHeroLike = ['female', 'male'].includes(profile.presentation);
  return {
    version: 'character-model-brief-v1',
    characterId,
    displayName: npc.name,
    runtimeAssetId: `${characterId}-supporting-v1`,
    narrativeSource: {
      title: npc.title,
      role: npc.role,
      area: npc.area,
      arc: npc.arc,
      description: npc.description,
      worldPosition: {
        x: npc.worldX,
        z: npc.worldZ,
      },
      order: npc.order,
      dialogueSummary,
    },
    referenceImages: {
      portrait: `/assets/portraits/${characterId}-concept.png`,
      front: `assets/characters/${characterId}/references/front.png`,
      side: `assets/characters/${characterId}/references/side.png`,
      back: `assets/characters/${characterId}/references/back.png`,
    },
    targetIdentity: {
      style: profile.style,
      silhouette: profile.silhouette,
      heightMeters: profile.heightMeters,
      headToBodyRatio: profile.headToBodyRatio,
      facePriorities: profile.face,
      hairPriorities: profile.hair,
      outfitPriorities: profile.outfit,
    },
    sourceModelRequirements: {
      sourceFile: `assets/characters/${characterId}/source/${characterId}.blend`,
      targetRuntimeFile: `public/assets/models/${characterId}.glb`,
      preferredFormat: 'glb',
      acceptableFormat: 'vrm',
      triangleBudget: {
        hero: isHeroLike ? [18000, 32000] : [14000, 26000],
        mid: [8000, 14000],
        low: [2500, 6000],
      },
      textureBudgetKb: 2048,
      requiredAnimationClips: ['idle', 'walk', 'talk'],
      requiredExpressions: ['neutral', 'blink', 'smile', 'concerned', 'surprised'],
      requiredSecondaryMotion: profile.secondaryMotion,
    },
    aiCandidatePlan: {
      primaryTool: 'hunyuan3d',
      secondaryTool: 'triposr',
      riggingTool: 'unirig',
      candidateFolder: `assets/characters/${characterId}/candidates`,
      minimumCandidates: 2,
      acceptanceGate: [
        'identity reads from the third-person camera',
        'face and hair silhouette match the narrative role',
        'outfit contains the signature prop and school crest',
        'mesh can be retopologized and rigged for idle, walk, and talk',
        'web runtime budget stays suitable for supporting NPCs',
      ],
    },
  };
}

function writeReadme(characterId, npc) {
  const text = [
    `# ${npc.name}`,
    '',
    `${npc.title} / ${npc.role}`,
    '',
    `Arc: ${npc.arc}`,
    '',
    npc.description,
    '',
    'This folder is generated from the story NPC roster. Replace generated briefs',
    'with hand-authored source models only after the character has an approved',
    'model sheet and runtime GLB/VRM candidate.',
    '',
  ].join('\n');
  writeFileSync(resolve(`assets/characters/${characterId}/README.md`), text);
}

const inputPath = resolve(readArg('--input', 'src/data/npcs.json'));
if (!existsSync(inputPath)) {
  console.error(`[story-character-briefs] Missing input: ${inputPath}`);
  process.exit(1);
}

const rosterPath = resolve(readArg('--roster-out', 'assets/characters/story-npc-roster.json'));
const dialoguePathArg = readArg('--dialogues');
const dialoguePath = dialoguePathArg ? resolve(dialoguePathArg) : undefined;
const dialogues = dialoguePath && existsSync(dialoguePath) ? readJson(dialoguePath) : undefined;
const includeLyra = process.argv.includes('--include-lyra');
const npcs = readJson(inputPath);
const storyNpcs = includeLyra ? npcs : npcs.filter((npc) => npc.id !== 'lyra');
const dialogueSummaries = Object.fromEntries(
  npcs.map((npc) => [npc.id, dialogueSummaryFor(dialogues, npc.id)]).filter((entry) => entry[1])
);

writeJson(rosterPath, {
  version: 'story-npc-roster-v1',
  source: readArg('--source-label', inputPath),
  dialogueSource: dialoguePathArg,
  count: npcs.length,
  modelBriefCount: storyNpcs.length,
  dialogueSummaries,
  npcs,
});

for (const npc of storyNpcs) {
  const characterId = npc.id;
  ensureDir(resolve(`assets/characters/${characterId}/references/jobs`));
  ensureDir(resolve(`assets/characters/${characterId}/candidates/jobs`));
  ensureDir(resolve(`assets/characters/${characterId}/source/textures`));
  writeJson(
    resolve(`assets/characters/${characterId}/character-model-brief.json`),
    briefFor(npc, dialogueSummaryFor(dialogues, characterId))
  );
  writeReadme(characterId, npc);
}

console.log(`[story-character-briefs] wrote ${rosterPath}`);
console.log(`[story-character-briefs] wrote ${storyNpcs.length} character briefs`);

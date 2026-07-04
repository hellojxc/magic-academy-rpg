import type { CharacterSpec } from './CharacterSpec';

export const storyNpcCharacterSpecs = {
  "arden_quill": {
    "id": "arden_quill",
    "displayName": "Arden Quill",
    "designIntent": "mainstream Japanese RPG student editor; lean academy journalist with feather motifs and messenger satchel. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.72,
      "headToBodyRatio": 0.18,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "sharp amber eyes",
      "eyeColor": "#d99b4d",
      "eyeScale": 1.06,
      "browShape": "curious slightly guarded brows",
      "browColor": "#7a4a32",
      "noseBridge": "stylized-minimal",
      "mouthShape": "small skeptical mouth",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7a4a32",
      "highlightColor": "#d99b4d",
      "style": "short chestnut hair",
      "bangs": "messy editorial bangs",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "small feather clip",
        "separate crown tufts"
      ]
    },
    "outfit": {
      "style": "amber-trim academy jacket",
      "primaryColor": "#132b68",
      "secondaryColor": "#d99b4d",
      "accentColor": "#d99b4d",
      "torso": "amber-trim academy jacket",
      "sleeves": "rolled sleeve shirt",
      "lowerBody": "press armband",
      "outerwear": "paper satchel",
      "shoes": "dark academy boots",
      "accessories": [
        "press armband",
        "paper satchel",
        "quill pen accessory"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "arden_quill-supporting-v1",
      "fallbackRigId": "arden_quill-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "aria_frost": {
    "id": "aria_frost",
    "displayName": "Aria Frost",
    "designIntent": "mainstream Japanese RPG academy NPC, 合唱首席; readable academy supporting character for 冰音合唱首席. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.605,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.13,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#7d6f95",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7d6f95",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "ivory academy uniform",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "ivory academy uniform",
      "sleeves": "formal capelet",
      "lowerBody": "ceremonial sash",
      "outerwear": "合唱首席 signature prop",
      "shoes": "light academy ankle boots",
      "accessories": [
        "ceremonial sash",
        "合唱首席 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "aria_frost-supporting-v1",
      "fallbackRigId": "aria_frost-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "bram_iron": {
    "id": "bram_iron",
    "displayName": "Bram Iron",
    "designIntent": "mainstream Japanese RPG academy NPC, 锻造师; readable academy supporting character for 护符锻造师. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.605,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "combat academy uniform",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "combat academy uniform",
      "sleeves": "reinforced gloves",
      "lowerBody": "practical boots",
      "outerwear": "rune ribbon accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "practical boots",
        "rune ribbon accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "bram_iron-supporting-v1",
      "fallbackRigId": "bram_iron-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "cassia_rune": {
    "id": "cassia_rune",
    "displayName": "Cassia Rune",
    "designIntent": "polished Japanese RPG rune honor student; neat elite student with rune ribbons and formal robe panels. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.63,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "violet analytical eyes",
      "eyeColor": "#8d72ff",
      "eyeScale": 1.13,
      "browShape": "precise confident brows",
      "browColor": "#4b2d78",
      "noseBridge": "stylized-minimal",
      "mouthShape": "small proud mouth",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#4b2d78",
      "highlightColor": "#8d72ff",
      "style": "straight dark violet hair",
      "bangs": "blunt bangs",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "rune hair ribbon",
        "clean back sheet"
      ]
    },
    "outfit": {
      "style": "purple rune scholar uniform",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#8d72ff",
      "accentColor": "#8d72ff",
      "torso": "purple rune scholar uniform",
      "sleeves": "formal robe panels",
      "lowerBody": "glowing rune belt",
      "outerwear": "book clasp accessory",
      "shoes": "light academy ankle boots",
      "accessories": [
        "glowing rune belt",
        "book clasp accessory",
        "black academy boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "cassia_rune-supporting-v1",
      "fallbackRigId": "cassia_rune-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "celine_wisp": {
    "id": "celine_wisp",
    "displayName": "Celine Wisp",
    "designIntent": "mainstream Japanese RPG academy NPC, 路标维护员; readable academy supporting character for 幽光路标维护员. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.655,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.13,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#7d6f95",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7d6f95",
      "highlightColor": "#b8a6e8",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "moonstone-trim robe",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#b8a6e8",
      "accentColor": "#b8a6e8",
      "torso": "moonstone-trim robe",
      "sleeves": "glow charm",
      "lowerBody": "soft cave-walking boots",
      "outerwear": "路标维护员 signature prop",
      "shoes": "light academy ankle boots",
      "accessories": [
        "soft cave-walking boots",
        "路标维护员 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "celine_wisp-supporting-v1",
      "fallbackRigId": "celine_wisp-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "corin_ash": {
    "id": "corin_ash",
    "displayName": "Corin Ash",
    "designIntent": "mainstream Japanese RPG academy NPC, 炼金学生; readable academy supporting character for 灰烬炼金生. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.705,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#c66742",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "work apron uniform",
      "primaryColor": "#132b68",
      "secondaryColor": "#c66742",
      "accentColor": "#c66742",
      "torso": "work apron uniform",
      "sleeves": "rolled sleeves",
      "lowerBody": "utility belt",
      "outerwear": "ember charm accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "utility belt",
        "ember charm accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "corin_ash-supporting-v1",
      "fallbackRigId": "corin_ash-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "elio_cinder": {
    "id": "elio_cinder",
    "displayName": "Elio Cinder",
    "designIntent": "warm Japanese RPG flame kitchen mage; sturdy culinary fire mage with apron coat and ember gloves. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.7,
      "headToBodyRatio": 0.18,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "orange-brown lively eyes",
      "eyeColor": "#b84659",
      "eyeScale": 1.06,
      "browShape": "friendly thick brows",
      "browColor": "#211b24",
      "noseBridge": "stylized-minimal",
      "mouthShape": "confident grin",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#211b24",
      "highlightColor": "#b84659",
      "style": "short copper hair",
      "bangs": "flame-shaped fringe",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "dark underlayer",
        "ember hairpin"
      ]
    },
    "outfit": {
      "style": "red-orange kitchen mage coat",
      "primaryColor": "#132b68",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "red-orange kitchen mage coat",
      "sleeves": "heatproof apron",
      "lowerBody": "rolled sleeves",
      "outerwear": "ember gloves",
      "shoes": "dark academy boots",
      "accessories": [
        "rolled sleeves",
        "ember gloves",
        "heavy kitchen boots"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "elio_cinder-supporting-v1",
      "fallbackRigId": "elio_cinder-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "evelyn_crow": {
    "id": "evelyn_crow",
    "displayName": "Evelyn Crow",
    "designIntent": "strict Japanese RPG discipline committee heroine; tall black-uniform prefect with crow-feather capelet. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.68,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "dark red serious eyes",
      "eyeColor": "#b84659",
      "eyeScale": 1.13,
      "browShape": "sharp disciplined brows",
      "browColor": "#9fc8df",
      "noseBridge": "stylized-minimal",
      "mouthShape": "small firm mouth",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#9fc8df",
      "highlightColor": "#b84659",
      "style": "long black hair",
      "bangs": "straight side bangs",
      "length": "long",
      "volume": 0.9,
      "secondaryMotion": "full",
      "accessories": [
        "crow feather hairpiece",
        "low tied back locks"
      ]
    },
    "outfit": {
      "style": "black discipline uniform",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "black discipline uniform",
      "sleeves": "red armband",
      "lowerBody": "crow-feather capelet",
      "outerwear": "silver rulebook chain",
      "shoes": "light academy ankle boots",
      "accessories": [
        "crow-feather capelet",
        "silver rulebook chain",
        "polished black boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "long-hair-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "evelyn_crow-supporting-v1",
      "fallbackRigId": "evelyn_crow-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "finn_rook": {
    "id": "finn_rook",
    "displayName": "Finn Rook",
    "designIntent": "mainstream Japanese RPG academy NPC, 送信员; readable academy supporting character for 屋顶送信员. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.6300000000000001,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#b84659",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#b84659",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "outdoor academy cape",
      "primaryColor": "#132b68",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "outdoor academy cape",
      "sleeves": "messenger pouch",
      "lowerBody": "weathered boots",
      "outerwear": "letter satchel accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "weathered boots",
        "letter satchel accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "finn_rook-supporting-v1",
      "fallbackRigId": "finn_rook-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "ilya_glass": {
    "id": "ilya_glass",
    "displayName": "Ilya Glass",
    "designIntent": "mainstream Japanese RPG academy NPC, 乐器修复师; readable academy supporting character for 玻璃乐器修复师. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.73,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.13,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#7d6f95",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7d6f95",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "standard academy jacket",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "standard academy jacket",
      "sleeves": "personalized waist sash",
      "lowerBody": "light travel satchel",
      "outerwear": "乐器修复师 signature prop",
      "shoes": "light academy ankle boots",
      "accessories": [
        "light travel satchel",
        "乐器修复师 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "ilya_glass-supporting-v1",
      "fallbackRigId": "ilya_glass-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "iris_vale": {
    "id": "iris_vale",
    "displayName": "Iris Vale",
    "designIntent": "mainstream Japanese RPG academy NPC, 记忆园丁; readable academy supporting character for 花径记忆师. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.705,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.13,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#7d6f95",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7d6f95",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "botanical apron uniform",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "botanical apron uniform",
      "sleeves": "leaf embroidery",
      "lowerBody": "gardening pouch",
      "outerwear": "botanical charm accessory",
      "shoes": "light academy ankle boots",
      "accessories": [
        "gardening pouch",
        "botanical charm accessory",
        "school crest detail"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "iris_vale-supporting-v1",
      "fallbackRigId": "iris_vale-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "jun_pearl": {
    "id": "jun_pearl",
    "displayName": "Jun Pearl",
    "designIntent": "mainstream Japanese RPG academy NPC, 算术导师; readable academy supporting character for 珍珠算术导师. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.6300000000000001,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "waterproof academy cloak",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "waterproof academy cloak",
      "sleeves": "shell or pearl accessory",
      "lowerBody": "soft boots",
      "outerwear": "water pearl accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "soft boots",
        "water pearl accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "jun_pearl-supporting-v1",
      "fallbackRigId": "jun_pearl-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "kael_thorn": {
    "id": "kael_thorn",
    "displayName": "Kael Thorn",
    "designIntent": "mainstream Japanese RPG academy NPC, 边界看守; readable academy supporting character for 禁林边界看守. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.655,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#b84659",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#b84659",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "outdoor academy cape",
      "primaryColor": "#132b68",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "outdoor academy cape",
      "sleeves": "messenger pouch",
      "lowerBody": "weathered boots",
      "outerwear": "边界看守 signature prop",
      "shoes": "dark academy boots",
      "accessories": [
        "weathered boots",
        "边界看守 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "kael_thorn-supporting-v1",
      "fallbackRigId": "kael_thorn-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "lina_clock": {
    "id": "lina_clock",
    "displayName": "Lina Clock",
    "designIntent": "mainstream Japanese RPG academy NPC, 课程管理员; readable academy supporting character for 时间表管理员. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.7550000000000001,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.13,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#7d6f95",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7d6f95",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "standard academy jacket",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "standard academy jacket",
      "sleeves": "personalized waist sash",
      "lowerBody": "light travel satchel",
      "outerwear": "clockwork charm accessory",
      "shoes": "light academy ankle boots",
      "accessories": [
        "light travel satchel",
        "clockwork charm accessory",
        "school crest detail"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "lina_clock-supporting-v1",
      "fallbackRigId": "lina_clock-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "maes_dew": {
    "id": "maes_dew",
    "displayName": "Maes Dew",
    "designIntent": "mainstream Japanese RPG academy NPC, 水文学徒; readable academy supporting character for 镜湖水文学徒. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.6800000000000002,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "waterproof academy cloak",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "waterproof academy cloak",
      "sleeves": "shell or pearl accessory",
      "lowerBody": "soft boots",
      "outerwear": "mirror charm accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "soft boots",
        "mirror charm accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "maes_dew-supporting-v1",
      "fallbackRigId": "maes_dew-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "matteo_gate": {
    "id": "matteo_gate",
    "displayName": "Matteo Gate",
    "designIntent": "mainstream Japanese RPG academy NPC, 钥匙保管员; readable academy supporting character for 旧门钥匙保管员. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.6800000000000002,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "standard academy jacket",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "standard academy jacket",
      "sleeves": "personalized waist sash",
      "lowerBody": "light travel satchel",
      "outerwear": "钥匙保管员 signature prop",
      "shoes": "dark academy boots",
      "accessories": [
        "light travel satchel",
        "钥匙保管员 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "matteo_gate-supporting-v1",
      "fallbackRigId": "matteo_gate-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "nara_veil": {
    "id": "nara_veil",
    "displayName": "Nara Veil",
    "designIntent": "dramatic Japanese RPG illusion theatre heroine; slender stage magician with veil ribbons and asymmetric skirt. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.64,
      "headToBodyRatio": 0.2,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "magenta playful eyes",
      "eyeColor": "#c45ab2",
      "eyeScale": 1.13,
      "browShape": "arched performer brows",
      "browColor": "#211b24",
      "noseBridge": "stylized-minimal",
      "mouthShape": "mysterious smile",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#211b24",
      "highlightColor": "#c45ab2",
      "style": "dark plum hair",
      "bangs": "side ponytail",
      "length": "long",
      "volume": 0.9,
      "secondaryMotion": "full",
      "accessories": [
        "veil ribbon strands",
        "separate curled bangs"
      ]
    },
    "outfit": {
      "style": "magenta illusionist academy costume",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#c45ab2",
      "accentColor": "#c45ab2",
      "torso": "magenta illusionist academy costume",
      "sleeves": "short cape veil",
      "lowerBody": "asymmetric skirt",
      "outerwear": "star curtain sash",
      "shoes": "light academy ankle boots",
      "accessories": [
        "asymmetric skirt",
        "star curtain sash",
        "heeled ankle boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "long-hair-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "nara_veil-supporting-v1",
      "fallbackRigId": "nara_veil-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "noel_pike": {
    "id": "noel_pike",
    "displayName": "Noel Pike",
    "designIntent": "mainstream Japanese RPG academy NPC, 决斗裁判; readable academy supporting character for 湖畔决斗裁判. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.6800000000000002,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "waterproof academy cloak",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "waterproof academy cloak",
      "sleeves": "shell or pearl accessory",
      "lowerBody": "soft boots",
      "outerwear": "water pearl accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "soft boots",
        "water pearl accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "noel_pike-supporting-v1",
      "fallbackRigId": "noel_pike-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "orin_bell": {
    "id": "orin_bell",
    "displayName": "Orin Bell",
    "designIntent": "Japanese RPG clocktower mechanic student; compact mechanical apprentice with brass gears and tool belt. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.65,
      "headToBodyRatio": 0.18,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "warm brown eyes",
      "eyeColor": "#9a6a42",
      "eyeScale": 1.06,
      "browShape": "focused brows",
      "browColor": "#211b24",
      "noseBridge": "stylized-minimal",
      "mouthShape": "small anxious mouth",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#211b24",
      "highlightColor": "#b84659",
      "style": "short sandy hair",
      "bangs": "gear-shaped side clip",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "practical layered bangs",
        "oil-darkened tips"
      ]
    },
    "outfit": {
      "style": "brown academy work jacket",
      "primaryColor": "#132b68",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "brown academy work jacket",
      "sleeves": "brass gear fasteners",
      "lowerBody": "tool belt",
      "outerwear": "rolled cuffs",
      "shoes": "dark academy boots",
      "accessories": [
        "tool belt",
        "rolled cuffs",
        "sturdy dark boots"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "orin_bell-supporting-v1",
      "fallbackRigId": "orin_bell-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "owen_grove": {
    "id": "owen_grove",
    "displayName": "Owen Grove",
    "designIntent": "mainstream Japanese RPG academy NPC, 星兽饲育员; readable academy supporting character for 草坪星兽饲育员. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.705,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#b84659",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#b84659",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "outdoor academy cape",
      "primaryColor": "#132b68",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "outdoor academy cape",
      "sleeves": "messenger pouch",
      "lowerBody": "weathered boots",
      "outerwear": "botanical charm accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "weathered boots",
        "botanical charm accessory",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "owen_grove-supporting-v1",
      "fallbackRigId": "owen_grove-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "ren_shio": {
    "id": "ren_shio",
    "displayName": "Ren Shio",
    "designIntent": "Japanese RPG eastern exchange sword-mage; athletic exchange student with short haori cape and broken blade. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.74,
      "headToBodyRatio": 0.18,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "deep blue focused eyes",
      "eyeColor": "#4f8ed9",
      "eyeScale": 1.06,
      "browShape": "straight determined brows",
      "browColor": "#16131c",
      "noseBridge": "stylized-minimal",
      "mouthShape": "restrained serious mouth",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#16131c",
      "highlightColor": "#b84659",
      "style": "dark indigo tied-back hair",
      "bangs": "loose front strands",
      "length": "long",
      "volume": 0.78,
      "secondaryMotion": "full",
      "accessories": [
        "short ponytail",
        "separate swordmage locks"
      ]
    },
    "outfit": {
      "style": "east-inspired academy haori",
      "primaryColor": "#132b68",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "east-inspired academy haori",
      "sleeves": "blue-black uniform layers",
      "lowerBody": "sword charm belt",
      "outerwear": "broken blade accessory",
      "shoes": "dark academy boots",
      "accessories": [
        "sword charm belt",
        "broken blade accessory",
        "split-toe boots"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "long-hair-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "ren_shio-supporting-v1",
      "fallbackRigId": "ren_shio-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "rowan_mint": {
    "id": "rowan_mint",
    "displayName": "Rowan Mint",
    "designIntent": "mainstream Japanese RPG academy NPC, 魔药摊主; readable academy supporting character for 薄荷糖魔药摊主. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.73,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "work apron uniform",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "work apron uniform",
      "sleeves": "rolled sleeves",
      "lowerBody": "utility belt",
      "outerwear": "魔药摊主 signature prop",
      "shoes": "dark academy boots",
      "accessories": [
        "utility belt",
        "魔药摊主 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "rowan_mint-supporting-v1",
      "fallbackRigId": "rowan_mint-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "selene_moon": {
    "id": "selene_moon",
    "displayName": "Selene Moon",
    "designIntent": "elegant Japanese RPG moon etiquette assistant; tall graceful ceremonial student with crescent cape and formal posture. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.66,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "soft moonlit violet eyes",
      "eyeColor": "#8d72ff",
      "eyeScale": 1.13,
      "browShape": "composed brows",
      "browColor": "#dce5f4",
      "noseBridge": "stylized-minimal",
      "mouthShape": "gentle ceremonial smile",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#dce5f4",
      "highlightColor": "#8d72ff",
      "style": "waist-length white-lavender hair",
      "bangs": "crescent side ornament",
      "length": "long",
      "volume": 0.9,
      "secondaryMotion": "full",
      "accessories": [
        "smooth face-framing locks",
        "low ribbon tie"
      ]
    },
    "outfit": {
      "style": "moon-phase etiquette uniform",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#8d72ff",
      "accentColor": "#8d72ff",
      "torso": "moon-phase etiquette uniform",
      "sleeves": "ivory blouse",
      "lowerBody": "lavender layered skirt",
      "outerwear": "crescent shoulder cape",
      "shoes": "light academy ankle boots",
      "accessories": [
        "lavender layered skirt",
        "crescent shoulder cape",
        "white heeled boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "long-hair-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "selene_moon-supporting-v1",
      "fallbackRigId": "selene_moon-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "sera_lumen": {
    "id": "sera_lumen",
    "displayName": "Sera Lumen",
    "designIntent": "mainstream Japanese RPG academy NPC, 巡夜员; readable academy supporting character for 光棱巡夜员. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.58,
      "headToBodyRatio": 0.19,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#b84659",
      "eyeScale": 1.13,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#7d6f95",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#7d6f95",
      "highlightColor": "#b84659",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "outdoor academy cape",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#b84659",
      "accentColor": "#b84659",
      "torso": "outdoor academy cape",
      "sleeves": "messenger pouch",
      "lowerBody": "weathered boots",
      "outerwear": "巡夜员 signature prop",
      "shoes": "light academy ankle boots",
      "accessories": [
        "weathered boots",
        "巡夜员 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "sera_lumen-supporting-v1",
      "fallbackRigId": "sera_lumen-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "silas_ink": {
    "id": "silas_ink",
    "displayName": "Silas Ink",
    "designIntent": "mainstream Japanese RPG academy NPC, 契约学生; readable academy supporting character for 墨灵契约生. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.58,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#7d56d9",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "scholar cardigan",
      "primaryColor": "#132b68",
      "secondaryColor": "#7d56d9",
      "accentColor": "#7d56d9",
      "torso": "scholar cardigan",
      "sleeves": "book charm belt",
      "lowerBody": "soft boots",
      "outerwear": "契约学生 signature prop",
      "shoes": "dark academy boots",
      "accessories": [
        "soft boots",
        "契约学生 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "silas_ink-supporting-v1",
      "fallbackRigId": "silas_ink-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "talia_moss": {
    "id": "talia_moss",
    "displayName": "Talia Moss",
    "designIntent": "soft Japanese RPG greenhouse herbalist heroine; petite herbalist with leafy apron and botanical accessories. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.57,
      "headToBodyRatio": 0.21,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "green gentle eyes",
      "eyeColor": "#79c98a",
      "eyeScale": 1.13,
      "browShape": "soft worried brows",
      "browColor": "#6b4a2f",
      "noseBridge": "stylized-minimal",
      "mouthShape": "small warm smile",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#6b4a2f",
      "highlightColor": "#6fbf82",
      "style": "wavy moss-brown hair",
      "bangs": "leaf hairpins",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "loose side braids",
        "separate curled tips"
      ]
    },
    "outfit": {
      "style": "greenhouse apron dress",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#6fbf82",
      "accentColor": "#6fbf82",
      "torso": "greenhouse apron dress",
      "sleeves": "cream blouse",
      "lowerBody": "leaf embroidered capelet",
      "outerwear": "seed pouch belt",
      "shoes": "light academy ankle boots",
      "accessories": [
        "leaf embroidered capelet",
        "seed pouch belt",
        "soft brown boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "talia_moss-supporting-v1",
      "fallbackRigId": "talia_moss-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "theo_wake": {
    "id": "theo_wake",
    "displayName": "Theo Wake",
    "designIntent": "mainstream Japanese RPG academy NPC, 梦疗志愿者; readable academy supporting character for 梦境治疗志愿者. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.7550000000000001,
      "headToBodyRatio": 0.19,
      "silhouette": "slim-male-academy",
      "shoulderWidth": 0.42,
      "torsoLength": 0.54,
      "waistWidth": 0.31,
      "hipWidth": 0.34,
      "armLength": 0.61,
      "handScale": 0.96,
      "legLength": 0.83,
      "footScale": 1
    },
    "face": {
      "eyeShape": "large readable anime eyes matching the role mood",
      "eyeColor": "#7b66ff",
      "eyeScale": 1.06,
      "browShape": "clear brows that show the personal conflict",
      "browColor": "#2a1d17",
      "noseBridge": "stylized-minimal",
      "mouthShape": "minimal stylized nose",
      "cheekTint": "#e4aa98",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#2a1d17",
      "highlightColor": "#b8a6e8",
      "style": "distinct silhouette hair matching the role",
      "bangs": "separate bangs and side locks",
      "length": "short",
      "volume": 0.78,
      "secondaryMotion": "tips",
      "accessories": [
        "one recognizable hair accessory",
        "game-ready hair chunks for later rigging"
      ]
    },
    "outfit": {
      "style": "moonstone-trim robe",
      "primaryColor": "#132b68",
      "secondaryColor": "#b8a6e8",
      "accentColor": "#b8a6e8",
      "torso": "moonstone-trim robe",
      "sleeves": "glow charm",
      "lowerBody": "soft cave-walking boots",
      "outerwear": "梦疗志愿者 signature prop",
      "shoes": "dark academy boots",
      "accessories": [
        "soft cave-walking boots",
        "梦疗志愿者 signature prop",
        "school crest detail"
      ],
      "heldItems": [
        "practice-wand"
      ]
    },
    "animation": {
      "locomotionSet": "academy-male-locomotion",
      "idleSet": "story-male-idles",
      "interactionSet": "conversation-male-calm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "cape-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "theo_wake-supporting-v1",
      "fallbackRigId": "theo_wake-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "vera_night": {
    "id": "vera_night",
    "displayName": "Vera Night",
    "designIntent": "mysterious Japanese RPG night archive heroine; quiet midnight archivist with dark cardigan robe and future-ink motifs. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.61,
      "headToBodyRatio": 0.2,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "deep violet tired eyes",
      "eyeColor": "#4f8ed9",
      "eyeScale": 1.13,
      "browShape": "soft uncertain brows",
      "browColor": "#9fc8df",
      "noseBridge": "stylized-minimal",
      "mouthShape": "small hesitant mouth",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#9fc8df",
      "highlightColor": "#8d72ff",
      "style": "long midnight-blue hair",
      "bangs": "soft side bangs",
      "length": "long",
      "volume": 0.9,
      "secondaryMotion": "full",
      "accessories": [
        "ink-black ribbon",
        "loose low tail"
      ]
    },
    "outfit": {
      "style": "dark archive cardigan robe",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#8d72ff",
      "accentColor": "#8d72ff",
      "torso": "dark archive cardigan robe",
      "sleeves": "blue-black academy dress",
      "lowerBody": "silver book chain",
      "outerwear": "midnight ledger accessory",
      "shoes": "light academy ankle boots",
      "accessories": [
        "silver book chain",
        "midnight ledger accessory",
        "soft black boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "long-hair-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "vera_night-supporting-v1",
      "fallbackRigId": "vera_night-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  },
  "yuna_spark": {
    "id": "yuna_spark",
    "displayName": "Yuna Spark",
    "designIntent": "energetic Japanese RPG lightning freshman; small lively lightning student with oversized lab jacket and spark clips. Generated from the story NPC model brief and intended to replace the in-world geometric placeholder.",
    "body": {
      "heightMeters": 1.54,
      "headToBodyRatio": 0.22,
      "silhouette": "petite-heroine",
      "shoulderWidth": 0.34,
      "torsoLength": 0.49,
      "waistWidth": 0.25,
      "hipWidth": 0.34,
      "armLength": 0.56,
      "handScale": 0.9,
      "legLength": 0.77,
      "footScale": 0.9
    },
    "face": {
      "eyeShape": "bright golden eyes",
      "eyeColor": "#f1c84d",
      "eyeScale": 1.13,
      "browShape": "eager nervous brows",
      "browColor": "#d9b84f",
      "noseBridge": "stylized-minimal",
      "mouthShape": "open excited smile",
      "cheekTint": "#d7a9be",
      "expressionSet": [
        "neutral",
        "blink",
        "smile",
        "concerned",
        "surprised"
      ]
    },
    "hair": {
      "color": "#d9b84f",
      "highlightColor": "#f1c84d",
      "style": "short fluffy yellow hair",
      "bangs": "lightning bolt side clips",
      "length": "short",
      "volume": 0.9,
      "secondaryMotion": "tips",
      "accessories": [
        "messy outward tips",
        "separate bang spikes"
      ]
    },
    "outfit": {
      "style": "yellow-accent academy lab coat",
      "primaryColor": "#eef9ff",
      "secondaryColor": "#f1c84d",
      "accentColor": "#f1c84d",
      "torso": "yellow-accent academy lab coat",
      "sleeves": "short uniform skirt or shorts",
      "lowerBody": "insulated gloves",
      "outerwear": "battery charm belt",
      "shoes": "light academy ankle boots",
      "accessories": [
        "insulated gloves",
        "battery charm belt",
        "rubber-soled boots"
      ],
      "heldItems": [
        "spellbook"
      ]
    },
    "animation": {
      "locomotionSet": "academy-female-locomotion",
      "idleSet": "story-female-idles",
      "interactionSet": "conversation-female-warm",
      "facialSet": "anime-supporting-basic",
      "secondaryMotion": [
        "hair-tip-sway",
        "skirt-sway"
      ]
    },
    "runtime": {
      "role": "supporting",
      "preferredAssetId": "yuna_spark-supporting-v1",
      "fallbackRigId": "yuna_spark-procedural-rig",
      "lodProfile": "supporting-mid",
      "maxVisibleDistanceMeters": 36
    }
  }
} as const satisfies Record<string, CharacterSpec>;

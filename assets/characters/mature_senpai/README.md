# Mature Senpai Character Asset

Current target: v7 mature senpai concept, used as an adult academy NPC.

## Current Files

- `references/concept-sheet-v7-roman-strappy-heels.png`: preferred concept.
- `references/hunyuan-multiview-v7/`: Hunyuan3D multi-view upload images.
- `character-model-brief.json`: source-of-truth model brief.
- `tools/rig_hunyuan_preview.py`: Blender batch rigging script for the current preview asset.
- `tools/build_final_v16.py`: Blender headless dedicated face-expression script that imports v15, keeps the physical runtime split, limits expression morph targets to `Face_Head`, adds facial landmark vertex groups, and removes inert non-face morph targets.
- `tools/build_final_v15.py`: Blender headless physical split script that imports v14, preserves the accepted visible likeness, and exports named skinned face, hair, torso, arm, skirt, leg, and shoe runtime meshes with copied UVs, materials, vertex groups, skin weights, and six expression shape keys.
- `tools/build_final_v14.py`: previous Blender headless clean production-preview script that keeps the `mcp-polish-v2` visible likeness, removes the failed flat expression overlay and hard strap panels, adds amplified source-mesh morphs, semantic part groups, supplemental hair/skirt secondary weights, and a real skinned choker/pendant runtime part.
- `tools/build_final_v12.py`: previous Blender headless source-preserving retopo/motion script that keeps the `mcp-polish-v2` visible likeness, adds semantic part groups, six facial morph targets, supplemental hair/skirt secondary weights, and visible strap/choker/pendant runtime parts.
- `tools/build_final_v11.py`: Blender headless mesh-anchored face audit script that keeps the v10 visible asset, records face mesh bounds/surface-profile anchors, and leaves the unreliable overlay transparent so it cannot pollute the runtime model.
- `tools/build_final_v10.py`: previous BlenderMCP conservative close-up face/material polish script that keeps the v9 hand-polish layer and adds micro iris, pupil, catchlight, eyelid, brow, mouth, and blush material overlays without large visible face-card artifacts.
- `tools/build_final_v9.py`: BlenderMCP close-up hand/material polish script that keeps the v8 retopo/partition/morph/weight/secondary-bone layer, tightens the hand pose, and replaces box-like fingers with rounded segmented fingers, soft nails, and knuckle shade planes.
- `tools/build_final_v8.py`: BlenderMCP retopo/partition/morph/weight/secondary-bone layer script that keeps the v7 likeness, adds hair-tip and skirt-tip secondary bones, writes per-part weight audits, and preserves the v7 natural arm/hand cleanup.
- `tools/build_final_v7.py`: BlenderMCP commercial-candidate script replacing the noisy source arm/hand region with more natural skinned arm/hand meshes, separate fingers, thumbs, and soft nail surfaces while preserving v6 face, morph, and secondary-motion hooks.
- `tools/build_final_v6.py`: BlenderMCP commercial-candidate script replacing the noisy source arm/hand region with clean skinned arm/hand meshes while preserving v5 face, morph, and secondary-motion hooks.
- `tools/build_final_v5.py`: BlenderMCP commercial-candidate script adding dialogue-distance face overlays on top of the v4 structured asset.
- `tools/build_final_v4.py`: BlenderMCP commercial-candidate script adding source-normal seam cleanup, six expression morphs, strap/pendant secondary bones, and visible strap/pendant detail meshes.
- `tools/build_retopo_v3.py`: BlenderMCP production-structure script that rebuilds the Hunyuan mesh into named skinned submeshes, rule-painted weights, facial morph targets, and secondary-motion hooks.
- `mature_senpai_rigged_v1.report.json`: generated rig and animation audit.
- `mature_senpai_production_v1.report.json`: disabled procedural template audit and decision record.
- `mature_senpai_commercial_v16.report.json`: active dedicated face-expression production-preview audit and runtime default decision record.
- `mature_senpai_commercial_v15.report.json`: previous physical split production-preview audit and fallback decision record.
- `mature_senpai_commercial_v14.report.json`: previous clean production-preview audit and fallback decision record.
- `mature_senpai_commercial_v12.report.json`: previous source-preserving retopo/motion audit and fallback decision record.
- `mature_senpai_commercial_v11.report.json`: mesh-anchored face audit and engineered split-part/morph reference decision record.
- `mature_senpai_commercial_v10.report.json`: previous conservative close-up face/material polish audit and fallback.
- `mature_senpai_commercial_v9.report.json`: previous close-up hand/material polish audit.
- `mature_senpai_commercial_v8.report.json`: previous retopo/rigging-layer audit and fallback.
- `mature_senpai_commercial_v7.report.json`: previous commercial-candidate audit and fallback.
- `mature_senpai_commercial_v6.report.json`: previous clean arm/hand replacement audit and fallback.
- `mature_senpai_commercial_v5.report.json`: previous dialogue-distance face overlay audit and fallback.
- `mature_senpai_commercial_v4.report.json`: previous commercial-candidate audit.
- `mature_senpai_retopo_v3.report.json`: previous automated retopo/parts/morph/weights/secondary-bone audit.
- `mature_senpai_mcp_polish_v2.report.json`: previous BlenderMCP polish audit and visual fallback.
- `mature_senpai_mcp_retouch_v1.report.json`: previous BlenderMCP retouch audit and runtime fallback.
- `source/mature_senpai.blend`: procedural Blender reference template for rigging and modular cleanup experiments.
- `source/mature_senpai_commercial_v16.blend`: active dedicated face-expression production-preview source scene.
- `source/mature_senpai_commercial_v15.blend`: previous physical split production-preview source scene.
- `source/mature_senpai_commercial_v14.blend`: previous clean production-preview source scene.
- `source/mature_senpai_commercial_v12.blend`: previous source-preserving retopo/motion source scene.
- `source/mature_senpai_commercial_v11.blend`: mesh-anchored face audit source scene.
- `source/mature_senpai_commercial_v10.blend`: previous conservative close-up face/material polish source scene.
- `source/mature_senpai_commercial_v9.blend`: previous close-up hand/material polish source scene.
- `source/mature_senpai_commercial_v8.blend`: previous retopo/rigging-layer source scene.
- `source/mature_senpai_commercial_v7.blend`: previous commercial-candidate source scene.
- `source/mature_senpai_commercial_v6.blend`: previous commercial-candidate source scene.
- `source/mature_senpai_commercial_v5.blend`: previous commercial-candidate source scene.
- `source/mature_senpai_commercial_v4.blend`: previous commercial-candidate source scene.
- `source/mature_senpai_retopo_v3.blend`: previous automated production-structure source scene.
- `source/mature_senpai_mcp_polish_v2.blend`: previous BlenderMCP-polished Hunyuan source scene.
- `source/mature_senpai_mcp_retouch_v1.blend`: BlenderMCP-retouched Hunyuan source scene.
- `candidates/registered/mature-senpai-hunyuan-v7-textured-preview/`: local 179k triangle Hunyuan audit candidate.
- `candidates/registered/mature-senpai-hunyuan-v7-web/`: local 60k triangle Hunyuan audit candidate.

Runtime export registered for preview:

- `mature_senpai_commercial_v16.glb`: active dedicated face-expression production-preview runtime default. It preserves the v15 physical runtime split, source UVs/materials/weights, 13 runtime parts, 32 armature bones, hair/skirt secondary bones, and the clean choker/pendant part while moving six expression shape keys onto `MatureSenpai_V16_Face_Head` only and adding facial landmark vertex groups for eyelids, brows, mouth, cheeks, and jaw.
- `mature_senpai_commercial_v15.glb`: previous physical split fallback with the accepted v14 visible source split into named skinned face, hair, torso, arms, skirt panels, legs, and shoe meshes. It preserves source UVs, material slots, vertex groups, skin weights, six expression shape keys, 15 secondary bones, no flat expression overlay artifacts, no hard straight strap panels, and one real skinned choker/pendant detail part.
- `mature_senpai_commercial_v14.glb`: previous clean production-preview fallback with the `mcp-polish-v2` visible body/UV/texture intact, semantic part vertex groups, six amplified body morph targets, supplemental Secondary_* hair/skirt weights, 15 secondary bones, no flat expression overlay artifacts, no hard straight strap panels, and one real skinned choker/pendant detail part.
- `mature_senpai_commercial_v12.glb`: previous source-preserving fallback with semantic part vertex groups, six facial morph targets, supplemental Secondary_* hair/skirt weights, 15 secondary bones, and three visible skinned strap/choker/pendant detail parts.
- `mature_senpai_mcp_polish_v2.glb`: visual fallback because it preserves the more natural Hunyuan v7 face, arms, body, hair, outfit proportions, and animation clips better than the earlier split-part experiments.
- `mature_senpai_commercial_v11.glb`: mesh-anchored face audit and engineered split-part/morph reference asset with 16 named skinned meshes, 6 face morph targets, 32 bones, hair-tip and skirt-tip secondary hooks, source-normal seam cleanup, 15 materials, transparent face-audit overlay materials, per-part weight audit data, and rounded segmented fingers/thumbs with soft nail and knuckle shade surfaces.
- `mature_senpai_commercial_v10.glb`: previous conservative close-up face/material polish asset with 16 named skinned meshes, 6 face morph targets, 32 bones, hair-tip and skirt-tip secondary hooks, source-normal seam cleanup, 15 materials, 8 face-detail overlay materials, per-part weight audit data, and rounded segmented fingers/thumbs with soft nail and knuckle shade surfaces.
- `mature_senpai_commercial_v9.glb`: previous close-up hand/material polish asset with 16 named skinned meshes, 6 face morph targets, 32 bones, hair-tip and skirt-tip secondary hooks, source-normal seam cleanup, dialogue-distance face overlays, per-part weight audit data, and rounded segmented fingers/thumbs with soft nail and knuckle shade surfaces.
- `mature_senpai_commercial_v8.glb`: previous retopo/partition/morph/weight/secondary-bone asset with 16 named skinned meshes, 6 face morph targets, 32 bones, hair-tip and skirt-tip secondary hooks, source-normal seam cleanup, dialogue-distance face overlays, per-part weight audit data, and v7 natural skinned arm/hand replacement meshes with separate fingers, thumbs, and nail surfaces.
- `mature_senpai_commercial_v7.glb`: previous commercial-candidate asset with 16 named skinned meshes, 6 face morph targets, 25 bones, secondary hair/skirt/strap/pendant hooks, source-normal seam cleanup, dialogue-distance face overlays, and more natural skinned arm/hand replacement meshes with separate fingers, thumbs, and nail surfaces.
- `mature_senpai_commercial_v6.glb`: previous commercial-candidate asset with clean arm/hand replacement meshes and v6 fallback status.
- `mature_senpai_commercial_v5.glb`: previous commercial-candidate asset with 15 named skinned meshes, dialogue-distance face overlays, and v5 fallback status.
- `mature_senpai_commercial_v4.glb`: previous commercial-candidate asset with 14 named skinned meshes, 6 face morph targets, 25 bones, secondary hair/skirt/strap/pendant hooks, source-normal seam cleanup, and visible strap/pendant details.
- `mature_senpai_retopo_v3.glb`: previous automated production-structure asset with 11 named skinned submeshes, `Blink`, `WarmSmile`, and `Surprised` morph targets on the face mesh, refreshed rule-painted weights, and secondary hair/skirt bones.
- `mature_senpai_mcp_retouch_v1.glb`: previous Hunyuan-based BlenderMCP retouch, retained as runtime fallback.
- `mature_senpai_rigged_v1.glb`: 60k triangle auto-rigged web preview with `idle`, `walk`, and `talk` clips.
- `mature_senpai_production_v1.glb`: disabled procedural Blender template export; useful for bone, morph, and modular-part reference, but not visually close enough to replace the Hunyuan mesh.

Local inspection exports not intended for the runtime commit:

- `mature_senpai_hunyuan_v7_web.glb`: 60k triangle static web-test source export.
- `mature_senpai_hunyuan_v7_raw.glb`: high-detail textured source export, about 1.5M triangles.
- `mature_senpai_hunyuan_v7_preview.glb`: 179k triangle preview export.

## Current Gate

The `mature_senpai_commercial_v16.glb` output is the active runtime preview.
It keeps the v15 physical split and accepted Hunyuan/BlenderMCP likeness, then
adds a dedicated face-expression pass: non-face meshes no longer carry inert
morph targets, `MatureSenpai_V16_Face_Head` owns six exported expression shape
keys, and the face mesh now includes explicit landmark vertex groups for
eyelids, brows, mouth, cheeks, and jaw. The current production hooks are 13
runtime parts, 32 armature bones, hair/skirt secondary bones, supplemental
Secondary_* weights for hair and skirt, and one clean skinned choker/pendant
detail part. The `mature_senpai_commercial_v15.glb` file remains the physical
split fallback, and the commercial v14 asset remains the source-preserving
fallback for comparison.

Remaining production blockers:

- v16 is a dedicated face-expression pass over the v15 physical split, not a
  hand-authored quad retopology:
  the runtime now has named parts, but the triangles still come from the
  accepted source mesh to preserve likeness.
- Skin weights are source weights plus generated supplemental secondary weights,
  not artist brush-painted final weights.
- Facial morphs now live only on the face mesh and use explicit facial landmark
  groups, but they are still generated deltas rather than artist-sculpted
  expression blendshapes over dedicated facial topology.
- The final topology still needs hand-authored quad retopology that preserves
  the `mcp_polish_v2` visible likeness.
- The v11 face audit layer is transparent because the Hunyuan mesh does not
  expose stable semantic facial landmarks; final face quality still needs
  actual UV/texture repaint, landmark detection, or sculpted eyelid/mouth
  topology.
- The v9/v10/v11 arm/hand meshes are more natural than v6/v8 and include rounded
  segmented fingers, but they are still generated anatomy, not final
  hand-authored arms, knuckles, fingers, and nails.
- Hair and skirt secondary motion now has tip bones, but the movement remains a
  runtime spring overlay rather than a tuned cloth/hair simulation.
- The character still needs artist retopology, texture cleanup, and final
  expression sculpting before it should be treated as final mainstream
  JRPG-quality runtime art.

The `mature_senpai_commercial_v16.glb` file is the current in-game animated
preview NPC. It keeps the better Hunyuan v7 visible source while adding runtime
morphs, face landmark groups, secondary-motion hooks, physical split parts, and
clean accessory parts, but it should not be
considered final until artist retopology, brush-painted weights, sculpted
expression blendshapes, and final material polish are complete.

## Next Production Step

1. Use the v16 dedicated face-expression asset as the visual and structural lock for the
   next manual retopo pass.
2. Build artist-authored quad topology over the preserved v16 body, hair,
   outfit, hands, and shoes.
3. Brush-paint final deformation weights over the generated source and
   supplemental weights.
4. Sculpt final expression blendshapes for blink, smile, teasing, surprised,
   and thoughtful.
5. Tune secondary-motion bones for long hair, skirt panels, straps, and pendant
   against actual in-game movement.
6. Export to `public/assets/models/mature_senpai.glb`.
7. Register `mature-senpai-supporting-v1` only after the final runtime audit
   and visual QA pass.

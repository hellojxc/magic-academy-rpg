# Mature Senpai Character Asset

Current target: v7 mature senpai concept, used as an adult academy NPC.

## Current Files

- `references/concept-sheet-v7-roman-strappy-heels.png`: preferred concept.
- `references/hunyuan-multiview-v7/`: Hunyuan3D multi-view upload images.
- `character-model-brief.json`: source-of-truth model brief.
- `tools/rig_hunyuan_preview.py`: Blender batch rigging script for the current preview asset.
- `tools/build_final_v9.py`: BlenderMCP close-up hand/material polish script that keeps the v8 retopo/partition/morph/weight/secondary-bone layer, tightens the hand pose, and replaces box-like fingers with rounded segmented fingers, soft nails, and knuckle shade planes.
- `tools/build_final_v8.py`: BlenderMCP retopo/partition/morph/weight/secondary-bone layer script that keeps the v7 likeness, adds hair-tip and skirt-tip secondary bones, writes per-part weight audits, and preserves the v7 natural arm/hand cleanup.
- `tools/build_final_v7.py`: BlenderMCP commercial-candidate script replacing the noisy source arm/hand region with more natural skinned arm/hand meshes, separate fingers, thumbs, and soft nail surfaces while preserving v6 face, morph, and secondary-motion hooks.
- `tools/build_final_v6.py`: BlenderMCP commercial-candidate script replacing the noisy source arm/hand region with clean skinned arm/hand meshes while preserving v5 face, morph, and secondary-motion hooks.
- `tools/build_final_v5.py`: BlenderMCP commercial-candidate script adding dialogue-distance face overlays on top of the v4 structured asset.
- `tools/build_final_v4.py`: BlenderMCP commercial-candidate script adding source-normal seam cleanup, six expression morphs, strap/pendant secondary bones, and visible strap/pendant detail meshes.
- `tools/build_retopo_v3.py`: BlenderMCP production-structure script that rebuilds the Hunyuan mesh into named skinned submeshes, rule-painted weights, facial morph targets, and secondary-motion hooks.
- `mature_senpai_rigged_v1.report.json`: generated rig and animation audit.
- `mature_senpai_production_v1.report.json`: disabled procedural template audit and decision record.
- `mature_senpai_commercial_v9.report.json`: active close-up hand/material polish audit.
- `mature_senpai_commercial_v8.report.json`: previous retopo/rigging-layer audit and fallback.
- `mature_senpai_commercial_v7.report.json`: previous commercial-candidate audit and fallback.
- `mature_senpai_commercial_v6.report.json`: previous clean arm/hand replacement audit and fallback.
- `mature_senpai_commercial_v5.report.json`: previous dialogue-distance face overlay audit and fallback.
- `mature_senpai_commercial_v4.report.json`: previous commercial-candidate audit.
- `mature_senpai_retopo_v3.report.json`: previous automated retopo/parts/morph/weights/secondary-bone audit.
- `mature_senpai_mcp_polish_v2.report.json`: previous BlenderMCP polish audit and visual fallback.
- `mature_senpai_mcp_retouch_v1.report.json`: previous BlenderMCP retouch audit and runtime fallback.
- `source/mature_senpai.blend`: procedural Blender reference template for rigging and modular cleanup experiments.
- `source/mature_senpai_commercial_v9.blend`: active close-up hand/material polish source scene.
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

- `mature_senpai_commercial_v9.glb`: active close-up hand/material polish asset with 16 named skinned meshes, 6 face morph targets, 32 bones, hair-tip and skirt-tip secondary hooks, source-normal seam cleanup, dialogue-distance face overlays, per-part weight audit data, and rounded segmented fingers/thumbs with soft nail and knuckle shade surfaces.
- `mature_senpai_commercial_v8.glb`: previous retopo/partition/morph/weight/secondary-bone asset with 16 named skinned meshes, 6 face morph targets, 32 bones, hair-tip and skirt-tip secondary hooks, source-normal seam cleanup, dialogue-distance face overlays, per-part weight audit data, and v7 natural skinned arm/hand replacement meshes with separate fingers, thumbs, and nail surfaces.
- `mature_senpai_commercial_v7.glb`: previous commercial-candidate asset with 16 named skinned meshes, 6 face morph targets, 25 bones, secondary hair/skirt/strap/pendant hooks, source-normal seam cleanup, dialogue-distance face overlays, and more natural skinned arm/hand replacement meshes with separate fingers, thumbs, and nail surfaces.
- `mature_senpai_commercial_v6.glb`: previous commercial-candidate asset with clean arm/hand replacement meshes and v6 fallback status.
- `mature_senpai_commercial_v5.glb`: previous commercial-candidate asset with 15 named skinned meshes, dialogue-distance face overlays, and v5 fallback status.
- `mature_senpai_commercial_v4.glb`: previous commercial-candidate asset with 14 named skinned meshes, 6 face morph targets, 25 bones, secondary hair/skirt/strap/pendant hooks, source-normal seam cleanup, and visible strap/pendant details.
- `mature_senpai_retopo_v3.glb`: previous automated production-structure asset with 11 named skinned submeshes, `Blink`, `WarmSmile`, and `Surprised` morph targets on the face mesh, refreshed rule-painted weights, and secondary hair/skirt bones.
- `mature_senpai_mcp_polish_v2.glb`: previous Hunyuan-based BlenderMCP polish, retained as visual fallback.
- `mature_senpai_mcp_retouch_v1.glb`: previous Hunyuan-based BlenderMCP retouch, retained as runtime fallback.
- `mature_senpai_rigged_v1.glb`: 60k triangle auto-rigged web preview with `idle`, `walk`, and `talk` clips.
- `mature_senpai_production_v1.glb`: disabled procedural Blender template export; useful for bone, morph, and modular-part reference, but not visually close enough to replace the Hunyuan mesh.

Local inspection exports not intended for the runtime commit:

- `mature_senpai_hunyuan_v7_web.glb`: 60k triangle static web-test source export.
- `mature_senpai_hunyuan_v7_raw.glb`: high-detail textured source export, about 1.5M triangles.
- `mature_senpai_hunyuan_v7_preview.glb`: 179k triangle preview export.

## Current Gate

The commercial v9 Hunyuan output is the active runtime preview because it keeps
the more lively AI-generated v7 likeness and v8
retopo/partition/morph/weight/secondary-bone engineering layer while improving
the most visible close-up hand issue. It includes named skinned submeshes, six
facial morph targets, explicit per-part weight profiles, source-normal seam
cleanup, dialogue-distance face overlays, visible strap/pendant details,
hair-tip and skirt-tip secondary bone hooks, rounded segmented fingers, a
tighter thumb pose, soft nail surfaces, and subtle knuckle shade planes. The
procedural Blender template has cleaner authored separation and morph hooks,
but it is too schematic to become the default visual model.

Remaining production blockers:

- The topology is split from Hunyuan triangles and UVs, not hand-drawn quad
  retopology.
- Skin weights are explicit profile weights generated by Blender Python, not
  artist brush-painted final weights.
- Facial morphs are subtle generated shape keys, not sculpted expression
  blendshapes.
- The v9 arm/hand meshes are more natural than v6/v8 and include rounded
  segmented fingers, but they are still generated anatomy, not final
  hand-authored arms, knuckles, fingers, and nails.
- Hair and skirt secondary motion now has tip bones, but the movement remains a
  runtime spring overlay rather than a tuned cloth/hair simulation.
- The character still needs artist retopology, texture cleanup, and final
  expression sculpting before it should be treated as final mainstream
  JRPG-quality runtime art.

The `mature_senpai_commercial_v9.glb` file is the current in-game animated
preview NPC. It improves close-up hand readability on top of the current
retopo/partition/morph/weight/secondary bone layer, but it should not be
considered final until artist retopology, brush-painted weights, sculpted
expression blendshapes, and final material polish are complete. The next
production pass should preserve the Hunyuan model's likeness instead of
replacing it with the procedural template's simplified silhouette.

## Next Production Step

1. Replace the automated Hunyuan-triangle split with artist-authored quad
   topology while preserving the v7 likeness.
2. Brush-paint final deformation weights over the generated rule weights.
3. Sculpt final expression blendshapes for blink, smile, teasing, surprised,
   and thoughtful.
4. Tune secondary-motion bones for long hair, skirt panels, straps, and pendant
   against actual in-game movement.
5. Export to `public/assets/models/mature_senpai.glb`.
6. Register `mature-senpai-supporting-v1` only after the final runtime audit
   and visual QA pass.

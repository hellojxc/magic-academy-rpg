PBR source textures for authored world chunks.

Generated surface families currently include `stone`, `wood`, `metal`, `organic`, `crystal`, `ground`, `bark`, `foliage`, and `grass`. `foliage` and `grass` basecolor maps include alpha for cutout leaf and blade silhouettes.

Use these suffixes per material:

- `.baseColor`
- `.normal`
- `.roughness`
- `.metallic`
- `.ao`
- `.emissive`

Runtime GLBs should reference optimized WebP or KTX2 textures after `assets:world:optimize`.

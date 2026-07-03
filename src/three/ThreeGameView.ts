import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class ThreeGameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly ssaoPass: SSAOPass | null;
  private readonly renderPixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
  private readonly lowQuality: boolean;

  constructor(private readonly container: HTMLElement) {
    this.lowQuality = new URLSearchParams(window.location.search).get('quality') === 'low';

    // 相机 — 50mm 等效视野，略偏俯视角
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 120);
    this.camera.position.set(3.6, 4.8, 6.8);
    this.camera.lookAt(0, 1.0, 0);

    // 渲染器 — 高质量设置
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.lowQuality,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(this.lowQuality ? Math.min(this.renderPixelRatio, 1) : this.renderPixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    // 色调映射后自动线性→sRGB
    this.container.append(this.renderer.domElement);

    // 后处理管线
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.lowQuality ? Math.min(this.renderPixelRatio, 1) : this.renderPixelRatio);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // SSAO — 环境光遮蔽，给角落和缝隙加阴影（低端模式关闭）
    if (this.lowQuality) {
      this.ssaoPass = null;
    } else {
      this.ssaoPass = new SSAOPass(this.scene, this.camera, 0, 0);
      this.ssaoPass.kernelRadius = 8;
      this.ssaoPass.minDistance = 0.0015;
      this.ssaoPass.maxDistance = 0.075;
      this.composer.addPass(this.ssaoPass);
    }

    // Bloom — 发光体辉光
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      this.lowQuality ? 0.24 : 0.36,   // strength — 适度，不过曝
      0.52,   // radius
      0.82    // threshold — 只有高亮物体才辉光
    );
    this.composer.addPass(this.bloomPass);

    // SMAA — 高质量抗锯齿（低端模式跳过，依赖原生 MSAA）
    if (!this.lowQuality) {
      const smaaPass = new SMAAPass();
      this.composer.addPass(smaaPass);
    }

    // Output — 色彩空间转换
    this.composer.addPass(new OutputPass());
  }

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);

    // 更新 SSAO 分辨率
    this.ssaoPass?.setSize(width, height);

    // 更新 Bloom 分辨率
    this.bloomPass.resolution.set(width, height);
  }

  render(): void {
    this.composer.render();
  }

  destroy(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}

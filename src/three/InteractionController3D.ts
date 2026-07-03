import * as THREE from 'three';

export class InteractionController3D {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly prompt: HTMLDivElement;
  private readonly interactionRange = 1.55;
  private lastPointerObject: THREE.Object3D | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: THREE.Object3D,
    private readonly target: THREE.Object3D,
    private readonly onInteract: () => void
  ) {
    this.prompt = document.createElement('div');
    this.prompt.className = 'interaction-prompt';
    this.prompt.textContent = 'E 交谈';
    this.prompt.hidden = true;
    this.container.append(this.prompt);

    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('click', this.onClick);
  }

  update(dialogueVisible: boolean): void {
    const distance = this.player.position.distanceTo(this.target.position);
    const near = distance <= this.interactionRange && !dialogueVisible;
    this.prompt.hidden = !near;
    if (near) {
      const screen = this.worldToScreen(this.target.position.clone().add(new THREE.Vector3(0, 1.15, 0)));
      this.prompt.style.left = `${screen.x}px`;
      this.prompt.style.top = `${screen.y}px`;
    }
  }

  tryInteract(): void {
    if (this.player.position.distanceTo(this.target.position) > this.interactionRange) return;
    this.onInteract();
  }

  destroy(): void {
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    this.renderer.domElement.style.cursor = 'default';
    this.prompt.remove();
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.target, true);
    this.lastPointerObject = hits.length > 0 ? this.target : null;
    this.renderer.domElement.style.cursor = this.lastPointerObject ? 'pointer' : 'default';
  };

  private readonly onClick = (): void => {
    if (this.lastPointerObject === this.target) this.tryInteract();
  };

  private worldToScreen(position: THREE.Vector3): { x: number; y: number } {
    const projected = position.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (projected.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-projected.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }
}

import * as THREE from 'three';
import type { InteractiveNPC } from './WorldTypes';

export class InteractionController3D {
  private static readonly pointerRaycastIntervalMs = 50;
  private static readonly nearestTargetIntervalMs = 120;
  private static readonly nearestTargetMoveThresholdSq = 0.08 * 0.08;
  private static readonly canvasRectRefreshIntervalMs = 250;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly promptWorldPosition = new THREE.Vector3();
  private readonly promptScreenPosition = new THREE.Vector2();
  private readonly prompt: HTMLDivElement;
  private readonly targetObjects: THREE.Object3D[];
  private readonly targetById = new Map<string, InteractiveNPC>();
  private readonly canvasRect = { left: 0, top: 0, width: 1, height: 1 };
  private readonly interactionRange = 1.55;
  private currentTarget: InteractiveNPC | null = null;
  private lastPointerTarget: InteractiveNPC | null = null;
  private cachedNearestTarget: InteractiveNPC | null = null;
  private pointerDirty = false;
  private lastPointerRaycastAt = 0;
  private lastNearestTargetAt = 0;
  private lastNearestPlayerX = Number.NaN;
  private lastNearestPlayerZ = Number.NaN;
  private lastCanvasRectAt = 0;
  private lastPromptHidden = true;
  private lastPromptText = '';
  private lastPromptTransform = '';

  constructor(
    private readonly container: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: THREE.Object3D,
    private readonly targets: readonly InteractiveNPC[],
    private readonly onInteract: (npc: InteractiveNPC) => void
  ) {
    this.targetObjects = targets.map((target) => target.object);
    for (const target of targets) this.targetById.set(target.id, target);

    this.prompt = document.createElement('div');
    this.prompt.className = 'interaction-prompt';
    this.prompt.textContent = 'E 交谈';
    this.prompt.hidden = true;
    this.prompt.style.left = '0px';
    this.prompt.style.top = '0px';
    this.prompt.style.willChange = 'transform';
    this.container.append(this.prompt);

    this.refreshCanvasRect(true);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('click', this.onClick);
    window.addEventListener('resize', this.onResize);
  }

  update(dialogueVisible: boolean): void {
    if (!dialogueVisible && this.pointerDirty) this.updatePointerTarget(false);
    this.currentTarget = dialogueVisible ? null : this.findNearestTarget(false);
    this.setPromptHidden(!this.currentTarget);
    if (this.currentTarget) {
      this.setPromptText(`E 交谈 · ${this.currentTarget.name}`);
      this.promptWorldPosition.copy(this.currentTarget.object.position);
      this.promptWorldPosition.y += 1.15;
      this.worldToScreen(this.promptWorldPosition, this.promptScreenPosition);
      this.setPromptPosition(this.promptScreenPosition.x, this.promptScreenPosition.y);
    }
  }

  tryInteract(): void {
    const target = this.currentTarget ?? this.findNearestTarget(true);
    if (!target) return;
    this.onInteract(target);
  }

  destroy(): void {
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.style.cursor = 'default';
    this.prompt.remove();
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.refreshCanvasRect(false);
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointerDirty = true;
    this.updatePointerTarget(false);
  };

  private readonly onResize = (): void => {
    this.refreshCanvasRect(true);
    this.lastPromptTransform = '';
  };

  private readonly onClick = (): void => {
    if (this.pointerDirty) this.updatePointerTarget(true);
    if (!this.lastPointerTarget) return;
    if (this.player.position.distanceToSquared(this.lastPointerTarget.object.position) > this.interactionRange * this.interactionRange) return;
    this.currentTarget = this.lastPointerTarget;
    this.onInteract(this.lastPointerTarget);
  };

  private findNearestTarget(force: boolean): InteractiveNPC | null {
    const now = performance.now();
    const movedX = this.player.position.x - this.lastNearestPlayerX;
    const movedZ = this.player.position.z - this.lastNearestPlayerZ;
    const movedSq = movedX * movedX + movedZ * movedZ;
    if (!force
      && now - this.lastNearestTargetAt < InteractionController3D.nearestTargetIntervalMs
      && movedSq < InteractionController3D.nearestTargetMoveThresholdSq
    ) {
      return this.cachedNearestTarget;
    }

    this.lastNearestTargetAt = now;
    this.lastNearestPlayerX = this.player.position.x;
    this.lastNearestPlayerZ = this.player.position.z;

    let nearest: InteractiveNPC | null = null;
    let nearestDistanceSq = this.interactionRange * this.interactionRange;
    for (const target of this.targets) {
      const distanceSq = this.player.position.distanceToSquared(target.object.position);
      if (distanceSq > nearestDistanceSq) continue;
      nearest = target;
      nearestDistanceSq = distanceSq;
    }
    this.cachedNearestTarget = nearest;
    return this.cachedNearestTarget;
  }

  private findTargetForObject(object: THREE.Object3D): InteractiveNPC | null {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const npcId = cursor.userData.npcId;
      if (typeof npcId === 'string') {
        return this.targetById.get(npcId) ?? null;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  private updatePointerTarget(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastPointerRaycastAt < InteractionController3D.pointerRaycastIntervalMs) return;
    this.lastPointerRaycastAt = now;
    this.pointerDirty = false;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.targetObjects, true);
    this.lastPointerTarget = hits.length > 0 ? this.findTargetForObject(hits[0].object) : null;
    this.renderer.domElement.style.cursor = this.lastPointerTarget ? 'pointer' : 'default';
  }

  private worldToScreen(position: THREE.Vector3, target: THREE.Vector2): void {
    const projected = position.project(this.camera);
    const rect = this.refreshCanvasRect(false);
    target.set(
      (projected.x * 0.5 + 0.5) * rect.width + rect.left,
      (-projected.y * 0.5 + 0.5) * rect.height + rect.top
    );
  }

  private refreshCanvasRect(force: boolean): typeof this.canvasRect {
    const now = performance.now();
    if (!force && now - this.lastCanvasRectAt < InteractionController3D.canvasRectRefreshIntervalMs) {
      return this.canvasRect;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.lastCanvasRectAt = now;
    this.canvasRect.left = rect.left;
    this.canvasRect.top = rect.top;
    this.canvasRect.width = rect.width || 1;
    this.canvasRect.height = rect.height || 1;
    return this.canvasRect;
  }

  private setPromptPosition(x: number, y: number): void {
    const roundedX = Math.round(x * 10) / 10;
    const roundedY = Math.round(y * 10) / 10;
    const transform = `translate3d(${roundedX}px, ${roundedY}px, 0) translate(-50%, -100%)`;
    if (transform === this.lastPromptTransform) return;
    this.lastPromptTransform = transform;
    this.prompt.style.transform = transform;
  }

  private setPromptHidden(hidden: boolean): void {
    if (hidden === this.lastPromptHidden) return;
    this.lastPromptHidden = hidden;
    this.prompt.hidden = hidden;
  }

  private setPromptText(text: string): void {
    if (text === this.lastPromptText) return;
    this.lastPromptText = text;
    this.prompt.textContent = text;
  }
}

import * as THREE from 'three';
import type { InteractiveNPC } from './WorldTypes';

export class InteractionController3D {
  private static readonly pointerRaycastIntervalMs = 50;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly promptWorldPosition = new THREE.Vector3();
  private readonly prompt: HTMLDivElement;
  private readonly targetObjects: THREE.Object3D[];
  private readonly targetById = new Map<string, InteractiveNPC>();
  private readonly interactionRange = 1.55;
  private currentTarget: InteractiveNPC | null = null;
  private lastPointerTarget: InteractiveNPC | null = null;
  private pointerDirty = false;
  private lastPointerRaycastAt = 0;

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
    this.container.append(this.prompt);

    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('click', this.onClick);
  }

  update(dialogueVisible: boolean): void {
    if (!dialogueVisible && this.pointerDirty) this.updatePointerTarget(false);
    this.currentTarget = dialogueVisible ? null : this.findNearestTarget();
    this.prompt.hidden = !this.currentTarget;
    if (this.currentTarget) {
      this.prompt.textContent = `E 交谈 · ${this.currentTarget.name}`;
      this.promptWorldPosition.copy(this.currentTarget.object.position);
      this.promptWorldPosition.y += 1.15;
      const screen = this.worldToScreen(this.promptWorldPosition);
      this.prompt.style.left = `${screen.x}px`;
      this.prompt.style.top = `${screen.y}px`;
    }
  }

  tryInteract(): void {
    const target = this.currentTarget ?? this.findNearestTarget();
    if (!target) return;
    this.onInteract(target);
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
    this.pointerDirty = true;
    this.updatePointerTarget(false);
  };

  private readonly onClick = (): void => {
    if (this.pointerDirty) this.updatePointerTarget(true);
    if (!this.lastPointerTarget) return;
    if (this.player.position.distanceTo(this.lastPointerTarget.object.position) > this.interactionRange) return;
    this.currentTarget = this.lastPointerTarget;
    this.onInteract(this.lastPointerTarget);
  };

  private findNearestTarget(): InteractiveNPC | null {
    let nearest: InteractiveNPC | null = null;
    let nearestDistanceSq = this.interactionRange * this.interactionRange;
    for (const target of this.targets) {
      const distanceSq = this.player.position.distanceToSquared(target.object.position);
      if (distanceSq > nearestDistanceSq) continue;
      nearest = target;
      nearestDistanceSq = distanceSq;
    }
    return nearest;
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

  private worldToScreen(position: THREE.Vector3): { x: number; y: number } {
    const projected = position.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (projected.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-projected.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }
}

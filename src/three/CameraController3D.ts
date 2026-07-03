import * as THREE from 'three';

export class CameraController3D {
  private readonly targetOffset = new THREE.Vector3(0, 1.12, 0);
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private yaw = Math.PI * 0.15;
  private pitch = 0.42;
  private distance = 6.5;
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Object3D,
    private readonly domElement: HTMLElement
  ) {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.update(1);
  }

  getYaw(): number {
    return this.yaw;
  }

  update(delta: number): void {
    this.lookTarget.copy(this.target.position).add(this.targetOffset);
    const horizontalDistance = Math.cos(this.pitch) * this.distance;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontalDistance,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance,
      this.lookTarget.z + Math.cos(this.yaw) * horizontalDistance
    );

    this.camera.position.lerp(this.desiredPosition, Math.min(1, delta * 6));
    this.camera.lookAt(this.lookTarget);
    // 微弱呼吸效果 — 增加生命感
    this.camera.position.y += Math.sin(performance.now() * 0.0008) * 0.015;
  }

  destroy(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) return;
    this.dragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.domElement.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    this.yaw -= deltaX * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * 0.0045, 0.22, 1.05);
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.006, 4.2, 10.5);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}

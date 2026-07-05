import * as THREE from 'three';

export class CameraController3D {
  private static readonly settleEpsilon = 0.0001;
  private static readonly settleDistanceSq = 0.000001;
  private readonly targetOffset = new THREE.Vector3(0, 1.12, 0);
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLookTarget = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private yaw = Math.PI * 0.15;
  private pitch = 0.42;
  private distance = 6.5;
  private targetYaw = this.yaw;
  private targetPitch = this.pitch;
  private targetDistance = this.distance;
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastTargetX = Number.NaN;
  private lastTargetY = Number.NaN;
  private lastTargetZ = Number.NaN;

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
    this.snap();
  }

  getYaw(): number {
    return this.yaw;
  }

  /** 立即把相机定位到目标位置，跳过平滑插值（用于初始化） */
  private snap(): void {
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetDistance = this.distance;
    this.desiredLookTarget.copy(this.target.position).add(this.targetOffset);
    this.lookTarget.copy(this.desiredLookTarget);
    const horizontalDistance = Math.cos(this.pitch) * this.distance;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontalDistance,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance,
      this.lookTarget.z + Math.cos(this.yaw) * horizontalDistance
    );
    this.camera.position.copy(this.desiredPosition);
    this.camera.lookAt(this.lookTarget);
    this.lastTargetX = this.target.position.x;
    this.lastTargetY = this.target.position.y;
    this.lastTargetZ = this.target.position.z;
  }

  update(delta: number): void {
    const targetMoved = this.target.position.x !== this.lastTargetX
      || this.target.position.y !== this.lastTargetY
      || this.target.position.z !== this.lastTargetZ;
    if (!targetMoved && this.isSettled()) return;

    this.lastTargetX = this.target.position.x;
    this.lastTargetY = this.target.position.y;
    this.lastTargetZ = this.target.position.z;

    this.yaw = CameraController3D.dampAngle(this.yaw, this.targetYaw, 18, delta);
    this.pitch += (this.targetPitch - this.pitch) * (1 - Math.exp(-18 * delta));
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-14 * delta));

    this.desiredLookTarget.copy(this.target.position).add(this.targetOffset);
    this.lookTarget.lerp(this.desiredLookTarget, 1 - Math.exp(-18 * delta));
    const horizontalDistance = Math.cos(this.pitch) * this.distance;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontalDistance,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance,
      this.lookTarget.z + Math.cos(this.yaw) * horizontalDistance
    );

    this.camera.position.lerp(this.desiredPosition, 1 - Math.exp(-14 * delta));
    this.camera.lookAt(this.lookTarget);
    this.snapIfSettled();
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

    this.targetYaw -= deltaX * 0.006;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + deltaY * 0.0045, 0.22, 1.05);
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + event.deltaY * 0.006, 4.2, 10.5);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private static dampAngle(current: number, target: number, lambda: number, delta: number): number {
    const wrapped = CameraController3D.angleDelta(current, target);
    return current + wrapped * (1 - Math.exp(-lambda * delta));
  }

  private isSettled(): boolean {
    return Math.abs(CameraController3D.angleDelta(this.yaw, this.targetYaw)) < CameraController3D.settleEpsilon
      && Math.abs(this.pitch - this.targetPitch) < CameraController3D.settleEpsilon
      && Math.abs(this.distance - this.targetDistance) < CameraController3D.settleEpsilon
      && this.lookTarget.distanceToSquared(this.desiredLookTarget) < CameraController3D.settleDistanceSq
      && this.camera.position.distanceToSquared(this.desiredPosition) < CameraController3D.settleDistanceSq;
  }

  private snapIfSettled(): void {
    if (!this.isSettled()) return;
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
    this.distance = this.targetDistance;
    this.lookTarget.copy(this.desiredLookTarget);
    this.camera.position.copy(this.desiredPosition);
    this.camera.lookAt(this.lookTarget);
  }

  private static angleDelta(current: number, target: number): number {
    return THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  }
}

import * as THREE from 'three';

export class CameraController3D {
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Object3D
  ) {}

  update(delta: number): void {
    const targetPosition = new THREE.Vector3(
      this.target.position.x * 0.18,
      6.8,
      8.8 + this.target.position.z * 0.16
    );
    this.camera.position.lerp(targetPosition, Math.min(1, delta * 2.2));
    this.camera.lookAt(this.target.position.x * 0.16, 0.66, this.target.position.z - 0.7);
  }
}

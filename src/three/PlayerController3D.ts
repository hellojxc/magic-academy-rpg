import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';

export class PlayerController3D {
  private readonly speed = 2.9;
  private readonly playerRadius = 0.32;
  private moving = false;

  constructor(
    private readonly player: THREE.Object3D,
    private readonly keys: ReadonlySet<string>,
    private readonly obstacles: readonly Obstacle[]
  ) {}

  updateMovement(delta: number, cameraYaw: number): void {
    const rightInput = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const forwardInput = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
      - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);

    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const direction = new THREE.Vector3()
      .addScaledVector(forward, forwardInput)
      .addScaledVector(right, rightInput);

    this.moving = direction.lengthSq() > 0;
    if (!this.moving) return;
    direction.normalize();

    const nextX = THREE.MathUtils.clamp(this.player.position.x + direction.x * this.speed * delta, -7.0, 7.0);
    const nextZ = THREE.MathUtils.clamp(this.player.position.z + direction.z * this.speed * delta, -4.2, 4.2);
    if (!this.collides(nextX, nextZ)) {
      this.player.position.x = nextX;
      this.player.position.z = nextZ;
    }

    this.player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  updateIdle(elapsedTime: number): void {
    this.player.position.y = Math.sin(elapsedTime * 3.1) * 0.018;
  }

  stop(): void {
    this.moving = false;
  }

  isMoving(): boolean {
    return this.moving;
  }

  private collides(x: number, z: number): boolean {
    return this.obstacles.some((obstacle) => (
      x + this.playerRadius > obstacle.minX
      && x - this.playerRadius < obstacle.maxX
      && z + this.playerRadius > obstacle.minZ
      && z - this.playerRadius < obstacle.maxZ
    ));
  }
}

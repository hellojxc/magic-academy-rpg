import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';

export class PlayerController3D {
  private readonly speed = 2.9;
  private readonly playerRadius = 0.32;

  constructor(
    private readonly player: THREE.Sprite,
    private readonly keys: ReadonlySet<string>,
    private readonly obstacles: readonly Obstacle[]
  ) {}

  updateMovement(delta: number): void {
    const direction = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) direction.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) direction.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) direction.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) direction.x += 1;

    if (direction.lengthSq() === 0) return;
    direction.normalize();

    const nextX = THREE.MathUtils.clamp(this.player.position.x + direction.x * this.speed * delta, -7.0, 7.0);
    const nextZ = THREE.MathUtils.clamp(this.player.position.z + direction.z * this.speed * delta, -4.2, 4.2);
    if (!this.collides(nextX, nextZ)) {
      this.player.position.x = nextX;
      this.player.position.z = nextZ;
    }

    if (direction.x < -0.05) this.player.scale.x = -Math.abs(this.player.scale.x);
    if (direction.x > 0.05) this.player.scale.x = Math.abs(this.player.scale.x);
  }

  updateIdle(elapsedTime: number): void {
    this.player.scale.y = 1.5 + Math.sin(elapsedTime * 3.1) * 0.025;
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

import * as THREE from 'three';
import type { Obstacle } from './WorldTypes';

export class PlayerController3D {
  private readonly speed = 2.9;
  private readonly playerRadius = 0.32;
  private readonly velocity = new THREE.Vector3();
  private readonly targetVelocity = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private moving = false;
  private visualYaw = 0;
  private movementIntent = false;

  constructor(
    private readonly player: THREE.Object3D,
    private readonly keys: ReadonlySet<string>,
    private readonly obstacles: readonly Obstacle[]
  ) {
    this.visualYaw = player.rotation.y;
  }

  updateMovement(delta: number, cameraYaw: number): void {
    const rightInput = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const forwardInput = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
      - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);

    this.forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    this.right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    this.direction.set(0, 0, 0)
      .addScaledVector(this.forward, forwardInput)
      .addScaledVector(this.right, rightInput);

    this.movementIntent = this.direction.lengthSq() > 0;
    if (this.movementIntent) this.direction.normalize();
    this.targetVelocity.copy(this.direction).multiplyScalar(this.movementIntent ? this.speed : 0);
    this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-14 * delta));
    if (!this.movementIntent && this.velocity.lengthSq() < 0.0004) this.velocity.set(0, 0, 0);

    const speedSq = this.velocity.lengthSq();
    this.moving = this.movementIntent
      ? speedSq > 0.0009
      : this.moving && speedSq > 0.0004;
    if (!this.moving) return;

    const nextX = THREE.MathUtils.clamp(this.player.position.x + this.velocity.x * delta, -25, 23);
    const nextZ = THREE.MathUtils.clamp(this.player.position.z + this.velocity.z * delta, -21, 27);
    if (!this.collides(nextX, nextZ)) {
      this.player.position.x = nextX;
      this.player.position.z = nextZ;
    } else {
      if (!this.collides(nextX, this.player.position.z)) this.player.position.x = nextX;
      if (!this.collides(this.player.position.x, nextZ)) this.player.position.z = nextZ;
    }

    const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
    this.visualYaw = PlayerController3D.dampAngle(this.visualYaw, targetYaw, 16, delta);
    this.player.rotation.y = this.visualYaw;
  }

  updateIdle(_elapsedTime: number): void {
    this.player.position.y = THREE.MathUtils.lerp(this.player.position.y, 0, 0.22);
  }

  stop(): void {
    this.moving = false;
    this.movementIntent = false;
    this.velocity.set(0, 0, 0);
    this.targetVelocity.set(0, 0, 0);
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

  private static dampAngle(current: number, target: number, lambda: number, delta: number): number {
    const wrapped = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
    return current + wrapped * (1 - Math.exp(-lambda * delta));
  }
}

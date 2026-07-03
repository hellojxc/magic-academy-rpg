export type CharacterAnimationState = 'idle' | 'walk' | 'talk';

export interface CharacterPoseWeights {
  idle: number;
  walk: number;
  talk: number;
}

export class CharacterAnimationStateMachine {
  private state: CharacterAnimationState = 'idle';
  private movementBlend = 0;
  private talkBlend = 0;

  setMoving(moving: boolean): void {
    if (this.state === 'talk') return;
    this.state = moving ? 'walk' : 'idle';
  }

  setTalking(talking: boolean): void {
    if (talking) {
      this.state = 'talk';
      return;
    }
    if (this.state === 'talk') this.state = 'idle';
  }

  update(delta: number): CharacterPoseWeights {
    const smoothing = 1 - Math.exp(-delta * 12);
    const movementTarget = this.state === 'walk' ? 1 : 0;
    const talkTarget = this.state === 'talk' ? 1 : 0;
    this.movementBlend += (movementTarget - this.movementBlend) * smoothing;
    this.talkBlend += (talkTarget - this.talkBlend) * smoothing;

    const walk = this.movementBlend * (1 - this.talkBlend);
    const talk = this.talkBlend;
    return {
      idle: Math.max(0, 1 - walk - talk),
      walk,
      talk,
    };
  }

  getState(): CharacterAnimationState {
    return this.state;
  }
}

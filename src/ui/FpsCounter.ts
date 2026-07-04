export class FpsCounter {
  private readonly root: HTMLDivElement;
  private frameId = 0;
  private lastSample = performance.now();
  private frames = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'fps-counter';
    this.root.textContent = '-- FPS';
    parent.append(this.root);

    this.frameId = window.requestAnimationFrame(this.update);
  }

  destroy(): void {
    window.cancelAnimationFrame(this.frameId);
    this.root.remove();
  }

  private readonly update = (now: number): void => {
    this.frames += 1;
    const elapsed = now - this.lastSample;
    if (elapsed >= 500) {
      const fps = Math.round((this.frames * 1000) / elapsed);
      this.root.textContent = `${fps} FPS`;
      this.root.dataset.tier = fps >= 55 ? 'good' : fps >= 35 ? 'warn' : 'bad';
      this.frames = 0;
      this.lastSample = now;
    }

    this.frameId = window.requestAnimationFrame(this.update);
  };
}

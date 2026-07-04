interface FpsStats {
  current: number;
  average: number;
  min: number;
  samples: number;
  measuredSeconds: number;
  targetFps: number;
  stable: boolean;
}

export class FpsCounter {
  private static readonly targetFps = 55;
  private static readonly maxSamples = 60;
  private readonly root: HTMLDivElement;
  private readonly samples: number[] = [];
  private frameId = 0;
  private lastSample = performance.now();
  private firstSample = this.lastSample;
  private frames = 0;
  private stats: FpsStats = {
    current: 0,
    average: 0,
    min: 0,
    samples: 0,
    measuredSeconds: 0,
    targetFps: FpsCounter.targetFps,
    stable: false,
  };

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'fps-counter';
    this.root.textContent = '-- FPS';
    parent.append(this.root);

    this.publishStats();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.frameId = window.requestAnimationFrame(this.update);
  }

  destroy(): void {
    if (this.frameId !== 0) window.cancelAnimationFrame(this.frameId);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.root.remove();
  }

  private readonly update = (now: number): void => {
    this.frames += 1;
    const elapsed = now - this.lastSample;
    if (elapsed >= 500) {
      const fps = Math.round((this.frames * 1000) / elapsed);
      this.samples.push(fps);
      if (this.samples.length > FpsCounter.maxSamples) this.samples.shift();
      const average = Math.round(this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length);
      const min = Math.min(...this.samples);
      this.stats = {
        current: fps,
        average,
        min,
        samples: this.samples.length,
        measuredSeconds: Math.round((now - this.firstSample) / 1000),
        targetFps: FpsCounter.targetFps,
        stable: average >= FpsCounter.targetFps && min >= FpsCounter.targetFps,
      };
      this.root.textContent = `${fps} FPS`;
      this.root.dataset.tier = average >= FpsCounter.targetFps ? 'good' : average >= 35 ? 'warn' : 'bad';
      this.root.dataset.current = String(fps);
      this.root.dataset.average = String(average);
      this.root.dataset.min = String(min);
      this.root.title = `avg ${average} FPS · min ${min} FPS · ${this.stats.measuredSeconds}s`;
      this.publishStats();
      this.frames = 0;
      this.lastSample = now;
    }

    this.frameId = window.requestAnimationFrame(this.update);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.frameId !== 0) {
        window.cancelAnimationFrame(this.frameId);
        this.frameId = 0;
      }
      return;
    }

    if (this.frameId !== 0) return;
    const now = performance.now();
    this.lastSample = now;
    this.firstSample = now;
    this.frames = 0;
    this.samples.length = 0;
    this.frameId = window.requestAnimationFrame(this.update);
  };

  private publishStats(): void {
    (window as unknown as { __fpsStats?: FpsStats }).__fpsStats = this.stats;
  }
}

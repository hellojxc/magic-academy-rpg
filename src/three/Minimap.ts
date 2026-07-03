import * as THREE from 'three';
import { REGIONS, getRegion, type RegionEntry } from './WorldHelpers';
import { WORLD_BOUNDS } from './WorldTypes';

/**
 * 右上角小地图指示器
 * 用 Canvas 2D 绘制，覆盖在 WebGL canvas 上层
 */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size = 160; // CSS 像素
  private readonly padding = 16;
  private playerPos = new THREE.Vector3();
  private playerYaw = 0;
  private currentRegion: RegionEntry | null = null;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = this.size * 2; // 高 DPI
    this.canvas.height = this.size * 2;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    parent.append(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Minimap: 2D context unavailable');
    this.ctx = ctx;
  }

  update(playerPos: THREE.Vector3, playerYaw: number): void {
    this.playerPos.copy(playerPos);
    this.playerYaw = playerYaw;
    this.currentRegion = getRegion(playerPos.x, playerPos.z);
    this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    const s = this.canvas.width; // 逻辑像素 (size*2)
    const pad = this.padding * 2;

    // 世界坐标范围
    const wW = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
    const wH = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
    const scale = Math.min((s - pad * 2) / wW, (s - pad * 2) / wH);
    const ox = s / 2;
    const oy = s / 2;

    // 世界→小地图坐标
    const w2m = (wx: number, wz: number) => ({
      x: ox + (wx - (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2) * scale,
      y: oy + (wz - (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2) * scale,
    });

    // 清空
    ctx.clearRect(0, 0, s, s);

    // 背景
    ctx.fillStyle = 'rgba(15, 10, 25, 0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, 12);
    ctx.fill();

    // 绘制每个区域
    for (const r of REGIONS) {
      const tl = w2m(r.bounds.minX, r.bounds.minZ);
      const br = w2m(r.bounds.maxX, r.bounds.maxZ);
      const w = br.x - tl.x;
      const h = br.y - tl.y;

      ctx.fillStyle = `#${r.color.toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = this.currentRegion?.id === r.id ? 0.85 : 0.45;
      ctx.fillRect(tl.x, tl.y, w, h);

      // 边框
      ctx.globalAlpha = 1;
      ctx.strokeStyle = this.currentRegion?.id === r.id ? '#ffe07a' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = this.currentRegion?.id === r.id ? 2 : 1;
      ctx.strokeRect(tl.x, tl.y, w, h);

      // 标签
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, (tl.x + br.x) / 2, (tl.y + br.y) / 2);
    }

    ctx.globalAlpha = 1;

    // 玩家位置点
    const p = w2m(this.playerPos.x, this.playerPos.z);
    ctx.fillStyle = '#ffe07a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // 朝向箭头
    const arrowLen = 10;
    const ax = p.x + Math.sin(this.playerYaw) * arrowLen;
    const ay = p.y - Math.cos(this.playerYaw) * arrowLen;
    ctx.strokeStyle = '#ffe07a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // 当前区域名称
    if (this.currentRegion) {
      ctx.fillStyle = 'rgba(15,10,25,0.7)';
      ctx.fillRect(0, s - 28, s, 28);
      ctx.fillStyle = '#ffe07a';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentRegion.label, s / 2, s - 14);
    }

    // 边框
    ctx.strokeStyle = 'rgba(255,224,122,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, 12);
    ctx.stroke();
  }

  destroy(): void {
    this.canvas.remove();
  }
}

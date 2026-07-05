import { DomDialogueBox } from '../ui/DomDialogueBox';
import { DialogueSystem } from '../systems/DialogueSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { GameHud } from '../ui/GameHud';
import { CombatSkillSystem } from '../systems/CombatSkillSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { AcademyWorld } from './AcademyWorld';
import { CameraController3D } from './CameraController3D';
import { InteractionController3D } from './InteractionController3D';
import { PlayerController3D } from './PlayerController3D';
import { ThreeGameView } from './ThreeGameView';
import { Minimap } from './Minimap';
import dialoguesData from '../data/dialogues.json';
import type { DialogueTree, SaveData } from '../types';
import type { AcademyWorldObjects, InteractiveNPC } from './WorldTypes';

const FRAME_DELTA_CAP_SECONDS = 0.05;
const ASYNC_SCENE_ASSET_SHADER_WARMUP_MIN_INTERVAL_MS = 900;

export class ThreeAcademyGame {
  private readonly view: ThreeGameView;
  private readonly world: AcademyWorld;
  private readonly keys = new Set<string>();
  private readonly saveSystem = SaveSystem;
  private readonly dialogueSystem: DialogueSystem;
  private readonly dialogueBox: DomDialogueBox;
  private readonly hud: GameHud;
  private readonly playerController: PlayerController3D;
  private readonly cameraController: CameraController3D;
  private readonly interactionController: InteractionController3D;
  private readonly minimap: Minimap;
  private save: SaveData;
  private animationId = 0;
  private elapsedTime = 0;
  private lastFrameTime = performance.now();
  private lastCharacterModelState = '';
  private lastDebugDatasetAt = 0;
  private lastAsyncSceneAssetShaderWarmupAt = Number.NEGATIVE_INFINITY;
  private pendingAsyncSceneAssetShaderWarmup = false;
  private asyncSceneAssetShaderWarmupScheduled = false;
  private currentNpc: InteractiveNPC | null = null;
  private frameListener: ((now: number) => void) | null = null;
  private destroyed = false;

  constructor(private readonly container: HTMLElement) {
    this.container.classList.add('three-game');

    this.view = new ThreeGameView(this.container);
    this.world = new AcademyWorld(this.view.scene, this.requestAsyncSceneAssetShaderWarmup);
    const worldObjects = this.world.build();
    this.applyShowcaseSpawn(worldObjects);

    this.save = this.saveSystem.load();
    this.dialogueSystem = new DialogueSystem(
      dialoguesData as Record<string, DialogueTree[]>,
      this.saveSystem
    );
    this.dialogueBox = new DomDialogueBox(this.container, {
      onSelectChoice: (index) => this.onSelectChoice(index),
      onAdvance: () => this.onAdvanceDialogue(),
    });
    this.hud = new GameHud(this.container);

    this.playerController = new PlayerController3D(
      worldObjects.player,
      this.keys,
      worldObjects.obstacles
    );
    this.cameraController = new CameraController3D(
      this.view.camera,
      worldObjects.player,
      this.view.renderer.domElement
    );
    this.interactionController = new InteractionController3D(
      this.container,
      this.view.renderer,
      this.view.camera,
      worldObjects.player,
      worldObjects.npcs,
      (npc) => {
        if (!this.dialogueBox.isVisible()) this.startNpcDialogue(npc);
      }
    );

    this.minimap = new Minimap(this.container);

    this.bindEvents();
    this.resize();
    this.view.warmup();
    this.updateHud();
  }

  start(): void {
    this.animate();
  }

  setFrameListener(listener: ((now: number) => void) | null): void {
    this.frameListener = listener;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animationId !== 0) window.cancelAnimationFrame(this.animationId);
    this.frameListener = null;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.interactionController.destroy();
    this.cameraController.destroy();
    this.minimap.destroy();
    this.hud.destroy();
    this.view.destroy();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private readonly animate = (): void => {
    if (document.hidden) {
      this.animationId = 0;
      return;
    }

    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, FRAME_DELTA_CAP_SECONDS);
    this.lastFrameTime = now;
    this.elapsedTime += delta;
    this.update(delta);
    this.warmupAsyncSceneAssetShadersWhenIdle(now);
    this.view.render();
    this.frameListener?.(now);
    this.animationId = window.requestAnimationFrame(this.animate);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.animationId !== 0) {
        window.cancelAnimationFrame(this.animationId);
        this.animationId = 0;
      }
      this.keys.clear();
      this.playerController.stop();
      return;
    }

    if (this.animationId !== 0) return;
    this.lastFrameTime = performance.now();
    this.animate();
  };

  private update(delta: number): void {
    const dialogueVisible = this.dialogueBox.isVisible();
    if (!dialogueVisible) {
      this.playerController.updateMovement(delta, this.cameraController.getYaw());
    } else {
      this.playerController.stop();
    }

    this.playerController.updateIdle(this.elapsedTime);
    this.world.update(this.elapsedTime, delta, this.playerController.isMoving());
    this.cameraController.update(delta);
    this.interactionController.update(dialogueVisible);
    this.minimap.update(this.world.getPlayerPosition().position, this.cameraController.getYaw());
    this.updateDebugDataset();
  }

  private readonly requestAsyncSceneAssetShaderWarmup = (): void => {
    this.pendingAsyncSceneAssetShaderWarmup = true;
  };

  private warmupAsyncSceneAssetShadersWhenIdle(now: number): void {
    if (!this.pendingAsyncSceneAssetShaderWarmup) return;
    if (this.asyncSceneAssetShaderWarmupScheduled) return;
    if (this.playerController.isMoving()) return;
    if (now - this.lastAsyncSceneAssetShaderWarmupAt < ASYNC_SCENE_ASSET_SHADER_WARMUP_MIN_INTERVAL_MS) return;

    this.asyncSceneAssetShaderWarmupScheduled = true;
    const runWarmup = (): void => {
      this.asyncSceneAssetShaderWarmupScheduled = false;
      if (this.destroyed || document.hidden) return;
      if (this.playerController.isMoving()) return;

      const warmupNow = performance.now();
      if (warmupNow - this.lastAsyncSceneAssetShaderWarmupAt < ASYNC_SCENE_ASSET_SHADER_WARMUP_MIN_INTERVAL_MS) return;
      this.pendingAsyncSceneAssetShaderWarmup = false;
      this.lastAsyncSceneAssetShaderWarmupAt = warmupNow;
      this.view.compileScene();
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runWarmup, { timeout: 1500 });
    } else {
      globalThis.setTimeout(runWarmup, 16);
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'KeyR' && event.shiftKey) {
      this.saveSystem.clear();
      this.save = this.saveSystem.load();
      this.updateHud();
      return;
    }

    if (this.dialogueBox.isVisible()) {
      if (event.code === 'Enter' || event.code === 'Space') this.dialogueBox.confirm();
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.dialogueBox.moveSelection(-1);
      if (event.code === 'ArrowDown' || event.code === 'KeyS') this.dialogueBox.moveSelection(1);
      if (event.code === 'Digit1') this.dialogueBox.selectByNumber(0);
      if (event.code === 'Digit2') this.dialogueBox.selectByNumber(1);
      if (event.code === 'Digit3') this.dialogueBox.selectByNumber(2);
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyE') {
      this.interactionController.tryInteract();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyZ') {
      this.saveSystem.cycleSkill(this.save, 'melee');
      this.updateHud();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyX') {
      this.saveSystem.cycleSkill(this.save, 'ranged');
      this.updateHud();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyC') {
      this.saveSystem.cycleSkill(this.save, 'defense');
      this.updateHud();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyV') {
      this.saveSystem.cycleEquipment(this.save, 'mainHand');
      this.updateHud();
      event.preventDefault();
      return;
    }

    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private startNpcDialogue(npc: InteractiveNPC): void {
    const tree = this.dialogueSystem.selectDialogue(npc.id, this.save);
    if (!tree) return;
    this.currentNpc = npc;
    this.updateHud();

    const state = this.dialogueSystem.startDialogue(tree);
    if (state.phase === 'page') {
      this.dialogueBox.show(state.page.speaker, state.page.text, state.page.choices);
    }
  }

  private onSelectChoice(index: number): void {
    const npc = this.currentNpc;
    if (!npc) return;
    const result = this.dialogueSystem.selectChoice(index, this.save, npc.id);
    if (!result.response) return;
    this.dialogueBox.showResponse(npc.name, result.response);
    this.updateHud();
  }

  private onAdvanceDialogue(): void {
    const tree = this.dialogueSystem.getCurrentTree();
    this.dialogueSystem.advance();
    const state = this.dialogueSystem.getState();

    if (state.phase === 'ended') {
      if (tree?.completesEvent) this.saveSystem.markEventComplete(this.save, tree.completesEvent);
      this.dialogueBox.hide();
      this.currentNpc = null;
      this.updateHud();
      return;
    }

    if (state.phase === 'page') {
      this.dialogueBox.show(state.page.speaker, state.page.text, state.page.choices);
    }
  }

  private updateHud(): void {
    this.hud.update(this.save, this.currentNpc ?? undefined);
  }

  private applyShowcaseSpawn(worldObjects: AcademyWorldObjects): void {
    const showcase = new URLSearchParams(window.location.search).get('showcase');
    if (!showcase) return;
    if (showcase === 'equipment') {
      worldObjects.player.position.set(17.0, 0, 34.2);
      worldObjects.player.rotation.y = Math.PI;
      return;
    }

    const npc = worldObjects.npcs.find((entry) => entry.id === showcase);
    if (!npc) return;
    worldObjects.player.position.set(
      npc.object.position.x - 0.75,
      0,
      npc.object.position.z + 1.05
    );
    worldObjects.player.rotation.y = Math.PI * 0.82;
  }

  private readonly resize = (): void => {
    this.view.resize();
  };

  private updateDebugDataset(): void {
    const now = performance.now();
    if (now - this.lastDebugDatasetAt < 250) return;
    this.lastDebugDatasetAt = now;
    const serialized = this.world.getCharacterModelStatesString();
    if (serialized === this.lastCharacterModelState) return;
    this.lastCharacterModelState = serialized;
    this.container.dataset.characterModels = serialized;
  }

  getDebugState(): {
    characters: Record<'player' | 'lyra', string>;
    npcCount: number;
    playerPosition: { x: number; y: number; z: number };
    progression: {
      coverage: { attributes: number; melee: number; ranged: number; defense: number; items: number };
      activeSkills: Record<'melee' | 'ranged' | 'defense', string>;
      equipped: string[];
    };
  } {
    const { x, y, z } = this.world.getPlayerPosition().position;
    return {
      characters: this.world.getCharacterModelStates(),
      npcCount: this.world.getInteractiveNpcCount(),
      playerPosition: { x, y, z },
      progression: {
        coverage: CombatSkillSystem.getCoverage(),
        activeSkills: {
          melee: CombatSkillSystem.getActiveSkill(this.save.skillLoadout, 'melee').label,
          ranged: CombatSkillSystem.getActiveSkill(this.save.skillLoadout, 'ranged').label,
          defense: CombatSkillSystem.getActiveSkill(this.save.skillLoadout, 'defense').label,
        },
        equipped: InventorySystem.getEquippedItems(this.save.inventory).map((item) => item.label),
      },
    };
  }
}

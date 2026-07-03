import { DomDialogueBox } from '../ui/DomDialogueBox';
import { DialogueSystem } from '../systems/DialogueSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { GameHud } from '../ui/GameHud';
import { AcademyWorld } from './AcademyWorld';
import { CameraController3D } from './CameraController3D';
import { InteractionController3D } from './InteractionController3D';
import { PlayerController3D } from './PlayerController3D';
import { ThreeGameView } from './ThreeGameView';
import { Minimap } from './Minimap';
import dialoguesData from '../data/dialogues.json';
import type { DialogueTree, SaveData } from '../types';
import type { AcademyWorldObjects } from './WorldTypes';

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

  constructor(private readonly container: HTMLElement) {
    this.container.classList.add('three-game');

    this.view = new ThreeGameView(this.container);
    this.world = new AcademyWorld(this.view.scene);
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
      worldObjects.lyra,
      () => {
        if (!this.dialogueBox.isVisible()) this.startLyraDialogue();
      }
    );

    this.minimap = new Minimap(this.container);

    this.bindEvents();
    this.resize();
    this.updateHud();
  }

  start(): void {
    this.animate();
  }

  destroy(): void {
    window.cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
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
  }

  private readonly animate = (): void => {
    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.033);
    this.lastFrameTime = now;
    this.elapsedTime += delta;
    this.update(delta);
    this.view.render();
    this.animationId = window.requestAnimationFrame(this.animate);
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

    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private startLyraDialogue(): void {
    const tree = this.dialogueSystem.selectDialogue('lyra', this.save);
    if (!tree) return;

    const state = this.dialogueSystem.startDialogue(tree);
    if (state.phase === 'page') {
      this.dialogueBox.show(state.page.speaker, state.page.text, state.page.choices);
    }
  }

  private onSelectChoice(index: number): void {
    const result = this.dialogueSystem.selectChoice(index, this.save);
    if (!result.response) return;
    this.dialogueBox.showResponse('Lyra', result.response);
    this.updateHud();
  }

  private onAdvanceDialogue(): void {
    const tree = this.dialogueSystem.getCurrentTree();
    this.dialogueSystem.advance();
    const state = this.dialogueSystem.getState();

    if (state.phase === 'ended') {
      if (tree?.completesEvent) this.saveSystem.markEventComplete(this.save, tree.completesEvent);
      this.dialogueBox.hide();
      this.updateHud();
      return;
    }

    if (state.phase === 'page') {
      this.dialogueBox.show(state.page.speaker, state.page.text, state.page.choices);
    }
  }

  private updateHud(): void {
    this.hud.update(this.save);
  }

  private applyShowcaseSpawn(worldObjects: AcademyWorldObjects): void {
    if (new URLSearchParams(window.location.search).get('showcase') !== 'lyra') return;
    worldObjects.player.position.set(
      worldObjects.lyra.position.x - 0.75,
      0,
      worldObjects.lyra.position.z + 1.05
    );
    worldObjects.player.rotation.y = Math.PI * 0.82;
  }

  private readonly resize = (): void => {
    this.view.resize();
  };

  private updateDebugDataset(): void {
    const serialized = this.world.getCharacterModelStatesString();
    if (serialized === this.lastCharacterModelState) return;
    this.lastCharacterModelState = serialized;
    this.container.dataset.characterModels = serialized;
  }

  getDebugState(): {
    characters: Record<'player' | 'lyra', string>;
    playerPosition: { x: number; y: number; z: number };
  } {
    const { x, y, z } = this.world.getPlayerPosition().position;
    return {
      characters: this.world.getCharacterModelStates(),
      playerPosition: { x, y, z },
    };
  }
}

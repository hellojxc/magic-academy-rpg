import type { DialogueChoice } from '../types';

interface DomDialogueBoxCallbacks {
  onSelectChoice: (index: number) => void;
  onAdvance: () => void;
}

export class DomDialogueBox {
  private readonly root: HTMLDivElement;
  private readonly portrait: HTMLImageElement;
  private readonly name: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly choices: HTMLDivElement;
  private readonly callbacks: DomDialogueBoxCallbacks;
  private choiceButtons: HTMLButtonElement[] = [];
  private selectedIndex = 0;
  private fullText = '';
  private displayedChars = 0;
  private typeTimer: number | null = null;
  private pendingChoices: DialogueChoice[] | null = null;
  private typing = false;

  constructor(parent: HTMLElement, callbacks: DomDialogueBoxCallbacks) {
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'dialogue-box';
    this.root.hidden = true;

    const portraitFrame = document.createElement('div');
    portraitFrame.className = 'dialogue-portrait-frame';

    this.portrait = document.createElement('img');
    this.portrait.className = 'dialogue-portrait';
    this.portrait.alt = '';
    portraitFrame.append(this.portrait);

    const content = document.createElement('div');
    content.className = 'dialogue-content';

    this.name = document.createElement('div');
    this.name.className = 'dialogue-name';

    this.body = document.createElement('div');
    this.body.className = 'dialogue-body';

    this.choices = document.createElement('div');
    this.choices.className = 'dialogue-choices';

    content.append(this.name, this.body, this.choices);
    this.root.append(portraitFrame, content);
    parent.append(this.root);
  }

  show(speaker: string, text: string, choices?: DialogueChoice[]): void {
    this.root.hidden = false;
    this.name.textContent = speaker;
    this.portrait.src = speaker.toLowerCase().includes('lyra')
      ? '/assets/portraits/lyra-3d.png'
      : '/assets/portraits/player-3d.png';

    this.fullText = text;
    this.displayedChars = 0;
    this.body.textContent = '';
    this.pendingChoices = choices?.length ? choices : null;
    this.selectedIndex = 0;
    this.clearChoices();
    this.startTypewriter();
  }

  showResponse(speaker: string, text: string): void {
    this.show(speaker, text);
  }

  hide(): void {
    this.root.hidden = true;
    this.stopTypewriter();
    this.clearChoices();
  }

  isVisible(): boolean {
    return !this.root.hidden;
  }

  confirm(): void {
    if (this.typing) {
      this.skipTyping();
      return;
    }

    if (this.choiceButtons.length > 0) {
      this.callbacks.onSelectChoice(this.selectedIndex);
      return;
    }

    this.callbacks.onAdvance();
  }

  moveSelection(delta: number): void {
    if (this.typing) {
      this.skipTyping();
      return;
    }

    if (this.choiceButtons.length === 0) return;
    this.selectedIndex = Math.max(0, Math.min(this.choiceButtons.length - 1, this.selectedIndex + delta));
    this.updateSelection();
  }

  selectByNumber(index: number): void {
    if (this.typing) return;
    if (index < 0 || index >= this.choiceButtons.length) return;
    this.selectedIndex = index;
    this.updateSelection();
    this.callbacks.onSelectChoice(index);
  }

  private startTypewriter(): void {
    this.stopTypewriter();
    this.typing = true;
    this.typeTimer = window.setInterval(() => {
      if (this.displayedChars >= this.fullText.length) {
        this.onTypingComplete();
        return;
      }

      this.displayedChars += 1;
      this.body.textContent = this.fullText.slice(0, this.displayedChars);
    }, 18);
  }

  private stopTypewriter(): void {
    if (this.typeTimer !== null) {
      window.clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
    this.typing = false;
  }

  private skipTyping(): void {
    this.stopTypewriter();
    this.body.textContent = this.fullText;
    this.displayedChars = this.fullText.length;
    this.onTypingComplete();
  }

  private onTypingComplete(): void {
    this.stopTypewriter();
    if (this.pendingChoices) {
      this.renderChoices(this.pendingChoices);
      this.pendingChoices = null;
    }
  }

  private renderChoices(choices: DialogueChoice[]): void {
    this.clearChoices();
    this.choiceButtons = choices.map((choice, index) => {
      const button = document.createElement('button');
      button.className = 'dialogue-choice';
      button.type = 'button';
      button.textContent = `[${index + 1}] ${choice.text}`;
      button.addEventListener('click', () => {
        this.selectedIndex = index;
        this.updateSelection();
        this.callbacks.onSelectChoice(index);
      });
      this.choices.append(button);
      return button;
    });
    this.updateSelection();
  }

  private clearChoices(): void {
    this.choices.replaceChildren();
    this.choiceButtons = [];
  }

  private updateSelection(): void {
    this.choiceButtons.forEach((button, index) => {
      button.classList.toggle('is-selected', index === this.selectedIndex);
    });
  }
}

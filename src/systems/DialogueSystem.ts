// src/systems/DialogueSystem.ts
// 对话系统：管理对话树、选页、选项执行、好感度变更。

import type { DialogueTree, DialoguePage, DialogueChoice, SaveData } from '../types';
import type { SaveSystem } from './SaveSystem';

type SaveSystemType = typeof SaveSystem;

/** 对话状态 */
export type DialogueState =
  | { phase: 'page'; page: DialoguePage; tree: DialogueTree }
  | { phase: 'choice_response'; choice: DialogueChoice; tree: DialogueTree }
  | { phase: 'ended' };

export class DialogueSystem {
  /** 全部对话数据：npcId -> DialogueTree[] */
  private dialogueData: Record<string, DialogueTree[]>;

  /** 当前对话树 */
  private currentTree: DialogueTree | null = null;
  /** 当前页 ID（用 pages 数组 index 或 nextPage 引用） */
  private currentPage: DialoguePage | null = null;
  /** 当前状态 */
  private state: DialogueState = { phase: 'ended' };

  constructor(
    dialogueData: Record<string, DialogueTree[]>,
    private saveSystem: SaveSystemType
  ) {
    this.dialogueData = dialogueData;
  }

  /**
   * 根据存档状态，选择一个 NPC 应该触发的对话树。
   * 优先级：event > proximity > repeat
   */
  selectDialogue(npcId: string, save: SaveData): DialogueTree | null {
    const trees = this.dialogueData[npcId];
    if (!trees || trees.length === 0) return null;

    // 1. 检查事件触发（满足好感度 + 前置事件）
    for (const tree of trees) {
      if (tree.trigger !== 'event') continue;
      if (tree.requiredEvent && !save.completedEvents.includes(tree.requiredEvent)) continue;
      if (tree.minAffection !== undefined && save.affection < tree.minAffection) continue;
      if (tree.maxAffection !== undefined && save.affection > tree.maxAffection) continue;
      // 尚未完成此事件
      if (tree.completesEvent && save.completedEvents.includes(tree.completesEvent)) continue;
      return tree;
    }

    // 2. 检查首次接近触发
    for (const tree of trees) {
      if (tree.trigger !== 'proximity') continue;
      if (tree.minAffection !== undefined && save.affection < tree.minAffection) continue;
      if (tree.maxAffection !== undefined && save.affection > tree.maxAffection) continue;
      if (tree.completesEvent && save.completedEvents.includes(tree.completesEvent)) continue;
      return tree;
    }

    // 3. 重复对话（按好感度分层）
    for (const tree of trees) {
      if (tree.trigger !== 'repeat') continue;
      if (tree.minAffection !== undefined && save.affection < tree.minAffection) continue;
      if (tree.maxAffection !== undefined && save.affection > tree.maxAffection) continue;
      return tree;
    }

    return null;
  }

  /** 开始对话 */
  startDialogue(tree: DialogueTree): DialogueState {
    this.currentTree = tree;
    this.currentPage = tree.pages[0] ?? null;
    if (this.currentPage) {
      this.state = { phase: 'page', page: this.currentPage, tree };
    } else {
      this.state = { phase: 'ended' };
    }
    return this.state;
  }

  /** 当前状态 */
  getState(): DialogueState {
    return this.state;
  }

  /**
   * 推进对话（按空格/Enter）。
   * 如果当前页有 choices，则不推进（等待玩家选选项）。
   * 如果有 nextPage，跳转到对应页。
   * 否则结束对话。
   */
  advance(): DialogueState {
    if (this.state.phase === 'ended') return this.state;

    if (this.state.phase === 'choice_response') {
      // 选择回复后，按任意键继续 → 结束对话
      const { tree } = this.state;
      this.endDialogue();
      // 标记事件完成（由外部调用者处理）
      if (tree.completesEvent) {
        // handled by caller via getCurrentTree()
      }
      return this.state;
    }

    if (this.state.phase === 'page') {
      const { page, tree } = this.state;

      // 有选项时不允许空格推进
      if (page.choices && page.choices.length > 0) {
        return this.state;
      }

      // 无 nextPage → 推进到 pages 数组的下一页
      const currentIdx = tree.pages.indexOf(page);
      if (currentIdx >= 0 && currentIdx < tree.pages.length - 1) {
        const nextPg = tree.pages[currentIdx + 1];
        this.currentPage = nextPg;
        this.state = { phase: 'page', page: nextPg, tree };
        return this.state;
      }

      // 已是最后一页 → 结束
      this.endDialogue();
    }

    return this.state;
  }

  /**
   * 玩家选择了一个选项。
   * 返回选项的 response 文本，并更新好感度。
   */
  selectChoice(choiceIndex: number, save: SaveData): { response: string; affectionChange: number; newAffection: number } {
    if (this.state.phase !== 'page' || !this.state.page.choices) {
      return { response: '', affectionChange: 0, newAffection: save.affection };
    }

    const choice = this.state.page.choices[choiceIndex];
    if (!choice) {
      return { response: '', affectionChange: 0, newAffection: save.affection };
    }

    // 更新好感度
    const newAffection = this.saveSystem.updateAffection(save, choice.affectionChange);

    // 进入回复阶段
    this.state = { phase: 'choice_response', choice, tree: this.state.tree };

    return {
      response: choice.response,
      affectionChange: choice.affectionChange,
      newAffection,
    };
  }

  /** 结束对话 */
  endDialogue(): void {
    // 保存 tree 引用供调用者在 endDialogue 后检查
    // 注意：currentTree 在此处被清空
    this.currentTree = null;
    this.currentPage = null;
    this.state = { phase: 'ended' };
  }

  /** 获取当前对话树（用于场景检查 completesEvent） */
  getCurrentTree(): DialogueTree | null {
    return this.currentTree;
  }
}

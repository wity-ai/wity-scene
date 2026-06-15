/**
 * @file history/HistoryManager.js
 * Undo/redo via an open Command interface.
 *
 * A Command is any object with:
 *   apply()   — execute the mutation (called once on commit)
 *   revert()  — reverse the mutation
 *   label?    — human-readable description ("Move text", "Change color")
 *
 * The manager doesn't know what commands do — it only manages the stack.
 * Build custom commands for any mutation type without touching this file.
 */

/**
 * @typedef {Object} Command
 * @property {() => void}    apply   - Execute the mutation
 * @property {() => void}    revert  - Reverse the mutation
 * @property {string}       [label]  - Human-readable description
 */

export class HistoryManager {
  /**
   * @param {{ limit?: number }} [options]
   */
  constructor({ limit = 100 } = {}) {
    this._limit = limit;
    /** @type {Command[]} */
    this._undoStack = [];
    /** @type {Command[]} */
    this._redoStack = [];
  }

  // ─── Core API ──────────────────────────────────────────────────────────────

  /**
   * Apply a command and push it onto the undo stack.
   * Clears the redo stack (branching history is not supported).
   * @param {Command} command
   */
  commit(command) {
    command.apply();
    this._undoStack.push(command);
    this._redoStack = [];
    if (this._undoStack.length > this._limit) {
      this._undoStack.shift();
    }
  }

  /**
   * Undo the last committed command.
   * @returns {Command | null} The command that was undone, or null if stack empty
   */
  undo() {
    const command = this._undoStack.pop();
    if (!command) return null;
    command.revert();
    this._redoStack.push(command);
    return command;
  }

  /**
   * Redo the last undone command.
   * @returns {Command | null} The command that was re-applied, or null if empty
   */
  redo() {
    const command = this._redoStack.pop();
    if (!command) return null;
    command.apply();
    this._undoStack.push(command);
    return command;
  }

  /**
   * Group multiple commands into a single undoable unit.
   * All commands in the batch are applied in order and undone in reverse.
   * @param {Command[]} commands
   * @param {string}   [label]
   */
  commitBatch(commands, label) {
    this.commit({
      label,
      apply:  () => commands.forEach((c) => c.apply()),
      revert: () => [...commands].reverse().forEach((c) => c.revert()),
    });
  }

  /**
   * Clear both stacks. Useful when loading a new document.
   */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
  }

  // ─── State reads ───────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} */
  get canRedo() {
    return this._redoStack.length > 0;
  }

  /** @returns {string | null} */
  get undoLabel() {
    return this._undoStack.at(-1)?.label ?? null;
  }

  /** @returns {string | null} */
  get redoLabel() {
    return this._redoStack.at(-1)?.label ?? null;
  }

  /** @returns {number} */
  get undoDepth() {
    return this._undoStack.length;
  }

  /** @returns {number} */
  get redoDepth() {
    return this._redoStack.length;
  }
}

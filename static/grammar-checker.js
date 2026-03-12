/**
 * Spell Checker for CodeMirror 6
 * Uses Nspell (Hunspell-compatible) with proper CM6 integration.
 * Right-click any word in the editor to see spelling suggestions.
 */

class SpellChecker {
  static speller = null;
  static loaded = false;
  static loading = false;

  static async loadDictionary() {
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          if (window.nspell) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/nspell@3/index.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        }),
        new Promise((resolve, reject) => {
          if (window.dictionaryEn) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/dictionary-en@3/index.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        })
      ]);
      if (window.nspell && window.dictionaryEn) {
        this.speller = new window.nspell(window.dictionaryEn);
        this.loaded = true;
      }
    } catch (err) {
      console.error("Spell checker: failed to load dictionary", err);
    } finally {
      this.loading = false;
    }
  }

  static isCorrect(word) {
    if (!this.speller) return true;
    // Skip very short words, numbers, paths, URLs
    if (word.length < 2) return true;
    if (/^\d+$/.test(word)) return true;
    if (/[\/\\:@#]/.test(word)) return true;
    return this.speller.correct(word);
  }

  static suggest(word) {
    if (!this.speller) return [];
    return this.speller.suggest(word).slice(0, 7);
  }

  /**
   * Get the word boundaries at a given document position using CM6 API
   */
  static getWordAt(view, pos) {
    const state = view.state;
    const line = state.doc.lineAt(pos);
    const lineText = line.text;
    const col = pos - line.from;

    // Walk backward to find word start
    let start = col;
    while (start > 0 && /[\w']/.test(lineText[start - 1])) start--;

    // Walk forward to find word end
    let end = col;
    while (end < lineText.length && /[\w']/.test(lineText[end])) end++;

    const word = lineText.slice(start, end).replace(/^'+|'+$/g, ""); // trim apostrophes from edges
    if (!word) return null;

    return {
      word,
      from: line.from + start,
      to: line.from + end,
    };
  }

  /**
   * Replace a word range in the editor using CM6 dispatch
   */
  static replaceWord(view, from, to, replacement) {
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + replacement.length },
    });
    view.focus();
  }

  /**
   * Show the spell suggestion context menu
   */
  static showMenu(x, y, word, from, to, suggestions, view) {
    this.hideMenu();

    const menu = document.createElement("div");
    menu.id = "spell-context-menu";
    menu.className = "spell-context-menu";

    if (suggestions.length === 0) {
      menu.innerHTML = '<div class="spell-no-suggestions">No suggestions</div>';
    } else {
      suggestions.forEach(s => {
        const item = document.createElement("div");
        item.className = "spell-suggestion";
        item.textContent = s;
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.replaceWord(view, from, to, s);
          this.hideMenu();
        });
        menu.appendChild(item);
      });
    }

    // "Add to dictionary" option
    const sep = document.createElement("div");
    sep.className = "spell-separator";
    menu.appendChild(sep);

    const addBtn = document.createElement("div");
    addBtn.className = "spell-suggestion spell-add-word";
    addBtn.textContent = `Add "${word}" to dictionary`;
    addBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.speller) this.speller.add(word);
      this.hideMenu();
    });
    menu.appendChild(addBtn);

    document.body.appendChild(menu);

    // Position, keeping it on screen
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    menu.style.left = Math.min(x, vw - rect.width - 8) + "px";
    menu.style.top = Math.min(y, vh - rect.height - 8) + "px";
    menu.style.display = "block";

    // Close on any click outside
    setTimeout(() => {
      document.addEventListener("mousedown", this._closeHandler = () => this.hideMenu(), { once: true });
    }, 0);
  }

  static hideMenu() {
    const menu = document.getElementById("spell-context-menu");
    if (menu) menu.remove();
    if (this._closeHandler) {
      document.removeEventListener("mousedown", this._closeHandler);
      this._closeHandler = null;
    }
  }

  /**
   * Main contextmenu handler — wired to the editor
   */
  static handleContextMenu(e) {
    const view = window._editorView;
    if (!view) return;

    // Only handle right-clicks inside the CM editor content
    const cmContent = view.dom.querySelector(".cm-content");
    if (!cmContent || !cmContent.contains(e.target)) return;

    // Dictionary not loaded yet — skip silently
    if (!this.speller) return;

    // Get document position from click coordinates
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos == null) return;

    // Get the word at that position
    const wordInfo = this.getWordAt(view, pos);
    if (!wordInfo || !wordInfo.word) return;

    // Check spelling
    if (this.isCorrect(wordInfo.word)) return;

    // Misspelled — prevent default and show suggestions
    e.preventDefault();
    const suggestions = this.suggest(wordInfo.word);
    this.showMenu(e.clientX, e.clientY, wordInfo.word, wordInfo.from, wordInfo.to, suggestions, view);
  }

  static setup() {
    document.addEventListener("contextmenu", (e) => this.handleContextMenu(e));

    // Load dictionary in background
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => this.loadDictionary());
    } else {
      setTimeout(() => this.loadDictionary(), 800);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => SpellChecker.setup());
} else {
  SpellChecker.setup();
}

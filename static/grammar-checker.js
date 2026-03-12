/**
 * Full Dictionary Spell Checker
 * Uses Nspell (Hunspell-compatible) for comprehensive spell-checking
 */

class FullDictionaryChecker {
  static async init() {
    await this.loadSpellChecker();
    this.setupContextMenu();
  }

  static async loadSpellChecker() {
    try {
      // Load Nspell library
      const nspellScript = document.createElement("script");
      nspellScript.src = "https://cdn.jsdelivr.net/npm/nspell@3/index.js";
      document.head.appendChild(nspellScript);

      // Load English dictionary
      const dictScript = document.createElement("script");
      dictScript.src = "https://cdn.jsdelivr.net/npm/dictionary-en@3/index.js";
      document.head.appendChild(dictScript);

      // Wait for libraries to load
      await new Promise(resolve => {
        setTimeout(resolve, 2000);
      });

      if (window.nspell && window.dictionaryEn) {
        this.speller = new window.nspell(window.dictionaryEn);
      }
    } catch (err) {
      console.error("Failed to load spell checker:", err);
    }
  }

  static setupContextMenu() {
    document.addEventListener("contextmenu", (e) => {
      const editor = document.querySelector(".cm-editor");
      if (!editor || !editor.contains(e.target)) return;

      const word = this.getSelectedWord();
      if (!word || this.isCorrect(word)) return;

      e.preventDefault();
      const suggestions = this.getSuggestions(word);
      this.showContextMenu(e.clientX, e.clientY, word, suggestions);
    });
  }

  static getSelectedWord() {
    const selection = window.getSelection();
    return selection.toString().trim() || null;
  }

  static isCorrect(word) {
    if (!this.speller) return true;
    return this.speller.correct(word);
  }

  static getSuggestions(word) {
    if (!this.speller) return [];
    return this.speller.suggest(word).slice(0, 5);
  }

  static showContextMenu(x, y, word, suggestions) {
    let menu = document.getElementById("spell-context-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "spell-context-menu";
      menu.className = "spell-context-menu";
      document.body.appendChild(menu);
    }

    menu.innerHTML = suggestions.map(suggestion => `
      <div class="spell-suggestion" data-suggestion="${suggestion}">
        ${suggestion}
      </div>
    `).join("");

    if (suggestions.length === 0) {
      menu.innerHTML = '<div class="spell-no-suggestions">No suggestions</div>';
    }

    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.display = "block";

    document.querySelectorAll(".spell-suggestion").forEach(item => {
      item.addEventListener("click", () => {
        this.replaceWord(word, item.dataset.suggestion);
        menu.style.display = "none";
      });
    });

    document.addEventListener("click", () => {
      menu.style.display = "none";
    }, { once: true });
  }

  static replaceWord(oldWord, newWord) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.toString() === oldWord) {
      range.deleteContents();
      range.insertNode(document.createTextNode(newWord));
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    FullDictionaryChecker.init();
  });
} else {
  FullDictionaryChecker.init();
}


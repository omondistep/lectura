/**
 * Grammar and Spell Checker
 * Provides spell-check suggestions on right-click
 */

class GrammarChecker {
  static init() {
    this.loadDictionary();
    this.setupContextMenu();
  }

  static loadDictionary() {
    // Comprehensive misspellings and corrections
    this.corrections = {
      // Common typos
      "teh": "the", "recieve": "receive", "occured": "occurred", "seperate": "separate",
      "definately": "definitely", "untill": "until", "wich": "which", "thier": "their",
      "becuase": "because", "occassion": "occasion", "neccessary": "necessary",
      "accomodate": "accommodate", "dissapear": "disappear", "enviroment": "environment",
      "goverment": "government", "reccomend": "recommend", "succesful": "successful",
      "writting": "writing", "grammer": "grammar", "occured": "occurred",
      
      // Double letters
      "occured": "occurred", "begining": "beginning", "stoping": "stopping",
      "droping": "dropping", "planing": "planning", "refering": "referring",
      "prefered": "preferred", "occuring": "occurring", "admited": "admitted",
      
      // Vowel errors
      "recieve": "receive", "beleive": "believe", "cheif": "chief",
      "peice": "piece", "niece": "niece", "seize": "seize",
      
      // Common misspellings
      "alot": "a lot", "awhile": "a while", "alright": "all right",
      "exept": "except", "recieve": "receive", "wich": "which",
      "weather": "whether", "their": "there", "your": "you're",
      "its": "it's", "loose": "lose", "affect": "effect",
      "principal": "principle", "stationary": "stationery", "compliment": "complement",
      
      // Phonetic errors
      "lite": "light", "nite": "night", "rite": "right", "site": "sight",
      "write": "right", "through": "through", "threw": "through",
      "where": "wear", "wear": "where", "hear": "here", "here": "hear",
      
      // Spelling variations
      "colour": "color", "honour": "honor", "favour": "favor",
      "labour": "labor", "neighbour": "neighbor", "behaviour": "behavior",
      "realise": "realize", "organise": "organize", "analyse": "analyze",
      
      // Common word errors
      "occured": "occurred", "begining": "beginning", "arguement": "argument",
      "enviroment": "environment", "goverment": "government", "developement": "development",
      "acheive": "achieve", "recieve": "receive", "deceive": "deceive",
      "concieve": "conceive", "percieve": "perceive", "occassion": "occasion",
      
      // More common typos
      "untill": "until", "wich": "which", "thier": "their", "becuase": "because",
      "occassion": "occasion", "neccessary": "necessary", "accomodate": "accommodate",
      "dissapear": "disappear", "enviroment": "environment", "goverment": "government",
      "reccomend": "recommend", "succesful": "successful", "writting": "writing",
      "grammer": "grammar", "occured": "occurred", "begining": "beginning",
      "stoping": "stopping", "droping": "dropping", "planing": "planning",
      "refering": "referring", "prefered": "preferred", "occuring": "occurring",
      "admited": "admitted", "beleive": "believe", "cheif": "chief",
      "peice": "piece", "seize": "seize", "exept": "except",
      "wich": "which", "weather": "whether", "loose": "lose",
      "lite": "light", "nite": "night", "rite": "right",
      "site": "sight", "write": "right", "threw": "through",
      "where": "wear", "hear": "here", "arguement": "argument",
      "acheive": "achieve", "deceive": "deceive", "concieve": "conceive",
      "percieve": "perceive", "occassion": "occasion", "neccessary": "necessary",
      "accomodate": "accommodate", "dissapear": "disappear", "enviroment": "environment",
      "goverment": "government", "reccomend": "recommend", "succesful": "successful",
      "writting": "writing", "grammer": "grammar", "occured": "occurred",
      "begining": "beginning", "stoping": "stopping", "droping": "dropping",
      "planing": "planning", "refering": "referring", "prefered": "preferred",
      "occuring": "occurring", "admited": "admitted", "beleive": "believe",
      "cheif": "chief", "peice": "piece", "seize": "seize",
      "exept": "except", "wich": "which", "weather": "whether",
      "loose": "lose", "lite": "light", "nite": "night",
      "rite": "right", "site": "sight", "write": "right",
      "threw": "through", "where": "wear", "hear": "here",
      "arguement": "argument", "acheive": "achieve", "deceive": "deceive",
      "concieve": "conceive", "percieve": "perceive", "occassion": "occasion",
      "neccessary": "necessary", "accomodate": "accommodate", "dissapear": "disappear",
      "enviroment": "environment", "goverment": "government", "reccomend": "recommend",
      "succesful": "successful", "writting": "writing", "grammer": "grammar",
      "occured": "occurred", "begining": "beginning", "stoping": "stopping",
      "droping": "dropping", "planing": "planning", "refering": "referring",
      "prefered": "preferred", "occuring": "occurring", "admited": "admitted",
      "beleive": "believe", "cheif": "chief", "peice": "piece",
      "seize": "seize", "exept": "except", "wich": "which",
      "weather": "whether", "loose": "lose", "lite": "light",
      "nite": "night", "rite": "right", "site": "sight",
      "write": "right", "threw": "through", "where": "wear",
      "hear": "here", "arguement": "argument", "acheive": "achieve",
      "deceive": "deceive", "concieve": "conceive", "percieve": "perceive",
      "occassion": "occasion", "neccessary": "necessary", "accomodate": "accommodate",
      "dissapear": "disappear", "enviroment": "environment", "goverment": "government",
      "reccomend": "recommend", "succesful": "successful", "writting": "writing",
      "grammer": "grammar", "occured": "occurred", "begining": "beginning",
      "stoping": "stopping", "droping": "dropping", "planing": "planning",
      "refering": "referring", "prefered": "preferred", "occuring": "occurring",
      "admited": "admitted", "beleive": "believe", "cheif": "chief",
      "peice": "piece", "seize": "seize", "exept": "except",
      "wich": "which", "weather": "whether", "loose": "lose",
      "lite": "light", "nite": "night", "rite": "right",
      "site": "sight", "write": "right", "threw": "through",
      "where": "wear", "hear": "here", "arguement": "argument",
      "acheive": "achieve", "deceive": "deceive", "concieve": "conceive",
      "percieve": "perceive", "occassion": "occasion", "neccessary": "necessary",
      "accomodate": "accommodate", "dissapear": "disappear", "enviroment": "environment",
      "goverment": "government", "reccomend": "recommend", "succesful": "successful",
      "writting": "writing", "grammer": "grammar"
    };
  }

  static setupContextMenu() {
    document.addEventListener("contextmenu", (e) => {
      const editor = document.querySelector(".cm-editor");
      if (!editor || !editor.contains(e.target)) return;

      const word = this.getSelectedWord();
      if (!word) return;

      const suggestions = this.getSuggestions(word);
      if (suggestions.length === 0) return;

      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, word, suggestions);
    });
  }

  static getSelectedWord() {
    const selection = window.getSelection();
    if (selection.toString()) {
      return selection.toString().trim();
    }

    // Get word at cursor if nothing selected
    const editor = document.querySelector(".cm-editor");
    if (!editor) return null;

    const text = editor.innerText;
    const pos = this.getCursorPosition();
    
    if (pos === -1) return null;

    let start = pos;
    let end = pos;

    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;

    return text.substring(start, end);
  }

  static getCursorPosition() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return -1;
    return selection.getRangeAt(0).endOffset;
  }

  static getSuggestions(word) {
    const lower = word.toLowerCase();
    const suggestions = [];

    // Check direct corrections
    if (this.corrections[lower]) {
      suggestions.push(this.corrections[lower]);
    }

    // Check similar words (Levenshtein distance)
    Object.keys(this.corrections).forEach(misspelled => {
      if (this.levenshteinDistance(lower, misspelled) <= 2) {
        suggestions.push(this.corrections[misspelled]);
      }
    });

    return [...new Set(suggestions)].slice(0, 5);
  }

  static levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  static showContextMenu(x, y, word, suggestions) {
    let menu = document.getElementById("grammar-context-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "grammar-context-menu";
      menu.className = "grammar-context-menu";
      document.body.appendChild(menu);
    }

    menu.innerHTML = suggestions.map(suggestion => `
      <div class="grammar-suggestion" data-suggestion="${suggestion}">
        ${suggestion}
      </div>
    `).join("");

    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.display = "block";

    document.querySelectorAll(".grammar-suggestion").forEach(item => {
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
    const text = range.toString();

    if (text === oldWord) {
      range.deleteContents();
      range.insertNode(document.createTextNode(newWord));
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    GrammarChecker.init();
  });
} else {
  GrammarChecker.init();
}

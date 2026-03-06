// ═══════════════════════════════════════════════════════════════════════════════
// Lectura Editor — Typora-inspired Markdown editor
// ═══════════════════════════════════════════════════════════════════════════════

import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, historyKeymap, history, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { vim, Vim } from "@replit/codemirror-vim";
import { GraphCanvas } from "./graph-canvas.js";

// ── markdown-it ────────────────────────────────────────────────────────────────
const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str, lang) {
    return `<pre><code class="language-${lang || ''}">${md.utils.escapeHtml(str)}</code></pre>`;
  }
});

// Checkbox support
md.core.ruler.after("inline", "checkbox", (state) => {
  for (const blockToken of state.tokens) {
    if (blockToken.type !== "inline" || !blockToken.children) continue;
    const out = [];
    let i = 0;
    while (i < blockToken.children.length) {
      const t = blockToken.children[i];
      if (t.type === "text" && /^\[([ xX])\]/.test(t.content)) {
        const checked = t.content[1].toLowerCase() === "x";
        const tok = new state.Token("html_inline", "", 0);
        tok.content = `<input type="checkbox" disabled ${checked ? "checked" : ""}>`;
        out.push(tok);
        const rest = t.content.slice(3);
        if (rest) {
          const s = new state.Token("text", "", 0);
          s.content = rest;
          out.push(s);
        }
      } else if (t.type === "text" && t.content.includes("[")) {
        const parts = [];
        let s = t.content;
        const re = /\[([ xX])\]/g;
        let last = 0, m;
        while ((m = re.exec(s)) !== null) {
          if (m.index > last) {
            const before = new state.Token("text", "", 0);
            before.content = s.slice(last, m.index);
            parts.push(before);
          }
          const checked = m[1].toLowerCase() === "x";
          const tok = new state.Token("html_inline", "", 0);
          tok.content = `<input type="checkbox" disabled ${checked ? "checked" : ""}>`;
          parts.push(tok);
          last = m.index + m[0].length;
        }
        if (last < s.length) {
          const rest = Object.assign({}, t);
          rest.content = s.slice(last);
          parts.push(rest);
        }
        out.push(...parts);
      } else {
        out.push(t);
      }
      i++;
    }
    blockToken.children = out;
  }
});

// Highlight support (==text==)
md.core.ruler.after("inline", "highlight", (state) => {
  for (const blockToken of state.tokens) {
    if (blockToken.type !== "inline" || !blockToken.children) continue;
    const out = [];
    let i = 0;
    while (i < blockToken.children.length) {
      const t = blockToken.children[i];
      if (t.type === "text" && t.content.includes("==")) {
        const parts = [];
        let s = t.content;
        const re = /==(.*?)==/g;
        let last = 0, m;
        while ((m = re.exec(s)) !== null) {
          if (m.index > last) {
            const before = new state.Token("text", "", 0);
            before.content = s.slice(last, m.index);
            parts.push(before);
          }
          const tok = new state.Token("html_inline", "", 0);
          tok.content = `<mark>${md.utils.escapeHtml(m[1])}</mark>`;
          parts.push(tok);
          last = m.index + m[0].length;
        }
        if (last < s.length) {
          const rest = Object.assign({}, t);
          rest.content = s.slice(last);
          parts.push(rest);
        }
        out.push(...parts);
      } else {
        out.push(t);
      }
      i++;
    }
    blockToken.children = out;
  }
});

// :::qa flashcard support
function preprocessFlashcards(content) {
  return content.replace(
    /:::qa\n([\s\S]*?)\n:::\n([\s\S]*?)\n:::/g,
    (_, question, answer) => {
      const q = question.trim().replace(/"/g, "&quot;");
      const a = answer.trim().replace(/"/g, "&quot;");
      return `<div class="flashcard" data-answer="${a}"><div class="flashcard-front">${q}</div><div class="flashcard-back">${a}</div><button class="flashcard-flip">Show answer</button></div>`;
    }
  );
}

// ── Lazy load Mermaid ──────────────────────────────────────────────────────────
let mermaidInitialized = false;
let mermaidLoading = false;
let mermaidIdCounter = 0;

async function initMermaid() {
  if (mermaidLoading) return;
  if (window.mermaid && !mermaidInitialized) {
    try {
      const theme = (typeof currentTheme !== "undefined" && ["dark","midnight","void","ember","cobalt","coral","ocean","sunset","nord","drake","ursine","lapis"].includes(currentTheme)) ? "dark" : "default";
      mermaid.initialize({ startOnLoad: false, theme, securityLevel: "loose" });
    } catch (e) { console.warn("Mermaid init:", e); }
    mermaidInitialized = true;
  } else if (!window.mermaid && !mermaidLoading) {
    mermaidLoading = true;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    script.onload = () => { mermaidLoading = false; initMermaid(); };
    document.head.appendChild(script);
  }
}

const markdownLang = markdown();

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════
let currentFile = "untitled.md";
let currentFolder = "";
let isDirty = false;
let autoSaveTimer = null;
const AUTOSAVE_DELAY = 2000;
let sidebarMode = "files";
let filesViewMode = "tree"; // tree or list

// ── theme compartment ──────────────────────────────────────────────────────────
const themeCompartment = new Compartment();

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function getContent() { return view.state.doc.toString(); }

function setContent(text) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  isDirty = false;
  updateDirtyBadge();
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("status-msg");
  el.textContent = msg;
  el.style.color = isError ? "var(--red)" : "var(--accent-2)";
  setTimeout(() => { el.textContent = "Ready"; el.style.color = ""; }, 3000);
}

function updateWordCount() {
  const text = getContent().trim();
  const words = text ? text.split(/\s+/).length : 0;
  document.getElementById("word-count").textContent = `${words} word${words !== 1 ? "s" : ""}`;
}

function updateReadingTime() {
  const text = getContent().trim();
  const words = text ? text.split(/\s+/).length : 0;
  const minutes = Math.ceil(words / 200);
  const el = document.getElementById("reading-time");
  if (el) el.textContent = `~${minutes} min read`;
}

function updateDocStatus() {
  const el = document.getElementById("doc-status");
  if (!el) return;
  if (isDirty) {
    el.textContent = "● Draft";
    el.className = "doc-status draft";
    el.title = "Unsaved changes";
  } else if (currentFile === "untitled.md") {
    el.textContent = "● New";
    el.className = "doc-status new";
    el.title = "New document";
  } else {
    el.textContent = "● Saved";
    el.className = "doc-status saved";
    el.title = "Saved locally";
  }
}

function updateDirtyBadge() {
  const badge = document.getElementById("autosave-badge");
  if (badge) badge.classList.toggle("hidden", !isDirty);
}

function markDirty() {
  isDirty = true;
  updateDirtyBadge();
  scheduleHistorySave();
  
  // Update Git status when file changes
  if (typeof updateGitStatus === 'function' && githubUser) {
    updateGitStatus();
  }
  
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (isDirty) {
      await saveFile(true);
    }
  }, AUTOSAVE_DELAY);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════════════
let previewDebounceTimer = null;
const PREVIEW_DEBOUNCE_DELAY = 150;

function renderPreview() {
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(doRenderPreview, PREVIEW_DEBOUNCE_DELAY);
}

function doRenderPreview() {
  const content = getContent();
  const processed = preprocessFlashcards(content);
  const html = md.render(processed);
  
  const previewEl = document.getElementById("preview");
  const oldScrollTop = previewEl.scrollTop;
  previewEl.innerHTML = html;
  
  // Restore scroll position after content update
  previewEl.scrollTop = oldScrollTop;

  // Wire flashcard buttons
  previewEl.querySelectorAll(".flashcard-flip").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".flashcard");
      card.classList.toggle("flipped");
      btn.textContent = card.classList.contains("flipped") ? "Hide answer" : "Show answer";
    });
  });

  renderLatex(previewEl);
  
  // Render diagrams asynchronously
  (async () => {
    await renderMermaidDiagrams(previewEl);
    renderEconGraphs(previewEl);
    renderGraphBlocks(previewEl);
  })();
  
  updateWordCount();
  updateReadingTime();
  updateDocStatus();

  // Update outline if in outline mode
  if (sidebarMode === "outline") {
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(updateOutline, 300);
  }
}

function goToPage(pageNum) {
  if (pageNum < 1 || pageNum > totalPages) return;
  currentPage = pageNum;
  
  const previewEl = document.getElementById("preview");
  const pageHeight = 1100;
  previewEl.scrollTop = (currentPage - 1) * pageHeight;
  
  updatePaginationUI();
}

// Pagination event listeners
document.getElementById('prev-page')?.addEventListener('click', () => goToPage(currentPage - 1));
document.getElementById('next-page')?.addEventListener('click', () => goToPage(currentPage + 1));

// Keyboard navigation for pages
document.addEventListener('keydown', (e) => {
  const previewPane = document.getElementById('preview-pane');
  if (!previewPane || previewPane.classList.contains('hidden-pane')) return;
  
  // Only handle arrow keys when not in editor
  if (document.activeElement.closest('.cm-editor')) return;
  
  if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    goToPage(currentPage - 1);
  } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    goToPage(currentPage + 1);
  }
});

// Update current page on scroll
let scrollTimeout;
document.getElementById('preview')?.addEventListener('scroll', (e) => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const scrollTop = e.target.scrollTop;
    const pageHeight = 1100;
    const newPage = Math.floor(scrollTop / pageHeight) + 1;
    if (newPage !== currentPage && newPage <= totalPages) {
      currentPage = newPage;
      updatePaginationUI();
    }
  }, 100);
});

function renderLatex(container) {
  if (!window.katex) return;
  container.innerHTML = container.innerHTML.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
    try { return `<div class="math-display">${katex.renderToString(math.trim(), { throwOnError: false, displayMode: true })}</div>`; }
    catch (e) { return match; }
  });
  container.innerHTML = container.innerHTML.replace(/\$([^\$\n]+)\$/g, (match, math) => {
    try { return katex.renderToString(math, { throwOnError: false, displayMode: false }); }
    catch (e) { return match; }
  });
}

async function renderMermaidDiagrams(container) {
  if (!window.mermaid) return;
  await initMermaid();
  const codeBlocks = container.querySelectorAll("pre code.language-mermaid");
  for (const codeBlock of codeBlocks) {
    const pre = codeBlock.parentElement;
    try {
      const id = "mermaid-" + (mermaidIdCounter++);
      const { svg } = await mermaid.render(id, codeBlock.textContent);
      const div = document.createElement("div");
      div.className = "mermaid-diagram";
      div.innerHTML = svg;
      pre.replaceWith(div);
    } catch (e) { console.error("Mermaid:", e); }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ECONOMIC GRAPHS
// ═══════════════════════════════════════════════════════════════════════════════
const ECON_PRESETS = {
  "supply-demand": `title: Supply and Demand\nxlabel: Quantity\nylabel: Price\nxmax: 10\nymax: 10\ncurve: Demand, [(0,9),(3,7),(5,5),(7,3),(10,1)], solid, #3b82f6\ncurve: Supply, [(0,1),(3,3),(5,5),(7,7),(10,9)], solid, #ef4444\npoint: Equilibrium, (5,5)\nhline: 5, dotted, #6b7280\nvline: 5, dotted, #6b7280`,
  "ppf": `title: Production Possibility Frontier\nxlabel: Good X\nylabel: Good Y\nxmax: 10\nymax: 10\ncurve: PPF, [(0,10),(2,9.8),(4,9.2),(6,8),(8,6),(9,3.5),(10,0)], solid, #10b981\ncurve: Unattainable, [(0,10),(2,10),(4,10),(6,10),(8,10),(10,10)], dotted, #ef4444\npoint: Efficient, (6,8)\npoint: Inefficient, (4,5)`,
  "cost": `title: Cost Curves\nxlabel: Quantity\nylabel: Cost\nxmax: 10\nymax: 14\ncurve: MC, [(1,10),(2,7),(3,5),(4,4),(5,4),(6,5),(7,7),(8,10),(9,13)], solid, #ef4444\ncurve: ATC, [(1,13),(2,10),(3,8),(4,6.5),(5,6),(6,6.2),(7,6.8),(8,7.8),(9,9)], solid, #3b82f6\ncurve: AVC, [(1,7),(2,5),(3,4),(4,3.5),(5,3.8),(6,4.5),(7,5.5),(8,7),(9,8.5)], solid, #10b981`,
};
const ECON_COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4","#f97316"];

function parseEconDSL(src) {
  const trimmed = src.trim();
  if (ECON_PRESETS[trimmed]) src = ECON_PRESETS[trimmed];
  const lines = src.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const cfg = { title: "", xlabel: "X", ylabel: "Y", xmax: 10, ymax: 10, curves: [], points: [], vlines: [], hlines: [], arrows: [] };
  let colorIdx = 0;
  for (const line of lines) {
    const [key, ...rest] = line.split(":").map(s => s.trim());
    const val = rest.join(":").trim();
    if (key === "title") { cfg.title = val; continue; }
    if (key === "xlabel") { cfg.xlabel = val; continue; }
    if (key === "ylabel") { cfg.ylabel = val; continue; }
    if (key === "xmax") { cfg.xmax = parseFloat(val) || 10; continue; }
    if (key === "ymax") { cfg.ymax = parseFloat(val) || 10; continue; }
    if (key === "curve") {
      const label = val.split(",")[0].trim();
      const coordStr = val.slice(val.indexOf("["), val.indexOf("]") + 1);
      const style = val.includes("dotted") ? "dotted" : val.includes("dashed") ? "dashed" : "solid";
      const colorMatch = val.match(/#[0-9a-fA-F]{3,6}/);
      const color = colorMatch ? colorMatch[0] : ECON_COLORS[colorIdx++ % ECON_COLORS.length];
      const points = [...coordStr.matchAll(/\(([0-9.]+),([0-9.]+)\)/g)].map(m => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }));
      if (points.length) cfg.curves.push({ label, points, style, color });
      continue;
    }
    if (key === "point") {
      const m = val.match(/^(.+),\s*\(([0-9.]+),([0-9.]+)\)/);
      if (m) cfg.points.push({ label: m[1].trim(), x: parseFloat(m[2]), y: parseFloat(m[3]) });
      continue;
    }
    if (key === "vline") {
      const parts = val.split(",").map(s => s.trim());
      const colorMatch = val.match(/#[0-9a-fA-F]{3,6}/);
      cfg.vlines.push({ x: parseFloat(parts[0]), style: parts[1] || "dotted", color: colorMatch ? colorMatch[0] : "#6b7280" });
      continue;
    }
    if (key === "hline") {
      const parts = val.split(",").map(s => s.trim());
      const colorMatch = val.match(/#[0-9a-fA-F]{3,6}/);
      cfg.hlines.push({ y: parseFloat(parts[0]), style: parts[1] || "dotted", color: colorMatch ? colorMatch[0] : "#6b7280" });
      continue;
    }
  }
  return cfg;
}

function buildEconDashPattern(style) {
  if (style === "dotted") return [2, 4];
  if (style === "dashed") return [8, 4];
  return [];
}

function renderEconGraphs(container) {
  if (!window.Chart) return;
  container.querySelectorAll("pre code.language-econ").forEach(codeEl => {
    const pre = codeEl.parentElement;
    const cfg = parseEconDSL(codeEl.textContent);
    const wrapper = document.createElement("div");
    wrapper.className = "econ-chart-wrapper";
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    pre.replaceWith(wrapper);

    const datasets = cfg.curves.map(curve => ({
      label: curve.label, data: curve.points, borderColor: curve.color,
      backgroundColor: "transparent", borderWidth: 2.5,
      borderDash: buildEconDashPattern(curve.style), pointRadius: 0, tension: 0.4, parsing: false,
    }));
    cfg.vlines.forEach(vl => datasets.push({
      label: `_vline_${vl.x}`, data: [{ x: vl.x, y: 0 }, { x: vl.x, y: cfg.ymax }],
      borderColor: vl.color, borderWidth: 1.5, borderDash: buildEconDashPattern(vl.style), pointRadius: 0, tension: 0, parsing: false,
    }));
    cfg.hlines.forEach(hl => datasets.push({
      label: `_hline_${hl.y}`, data: [{ x: 0, y: hl.y }, { x: cfg.xmax, y: hl.y }],
      borderColor: hl.color, borderWidth: 1.5, borderDash: buildEconDashPattern(hl.style), pointRadius: 0, tension: 0, parsing: false,
    }));
    if (cfg.points.length) datasets.push({
      label: cfg.points.map(p => p.label).join(", "), data: cfg.points.map(p => ({ x: p.x, y: p.y })),
      type: "scatter", borderColor: "#f59e0b", backgroundColor: "#f59e0b", pointRadius: 6, parsing: false,
    });

    new Chart(canvas, {
      type: "line", data: { datasets },
      options: {
        responsive: true, animation: false,
        plugins: {
          title: { display: !!cfg.title, text: cfg.title, color: "#e6edf3", font: { size: 14, weight: "600" } },
          legend: { labels: { color: "#8b949e", filter: item => !item.text.startsWith("_"), boxWidth: 20 } },
          tooltip: { callbacks: { label: ctx => ctx.dataset.label.startsWith("_") ? null : `${ctx.dataset.label}: (${ctx.parsed.x}, ${ctx.parsed.y})` } },
        },
        scales: {
          x: { type: "linear", min: 0, max: cfg.xmax, title: { display: true, text: cfg.xlabel, color: "#8b949e" }, grid: { color: "#21262d" }, ticks: { color: "#8b949e" } },
          y: { type: "linear", min: 0, max: cfg.ymax, title: { display: true, text: cfg.ylabel, color: "#8b949e" }, grid: { color: "#21262d" }, ticks: { color: "#8b949e" } },
        },
      },
    });
  });
}

// ── Graph blocks in preview ──────────────────────────────────────────────────
function renderGraphBlocks(container) {
  [...container.querySelectorAll("pre code.language-graph")].forEach((codeEl, blockIndex) => {
    const pre = codeEl.parentElement;
    let data;
    try { data = JSON.parse(codeEl.textContent.trim()); } catch (_) { return; }
    const w = data.w || 600, h = data.h || 450;
    const wrapper = document.createElement("div");
    wrapper.className = "graph-block-wrapper";
    wrapper.title = "Double-click to edit";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", "100%");
    svg.style.maxWidth = w + "px";
    svg.style.background = "#1a1a2e";
    svg.style.borderRadius = "6px";
    svg.style.cursor = "pointer";
    const gc = new GraphCanvas(svg, { width: w, height: h });
    gc.fromJSON(data);
    wrapper.appendChild(svg);
    pre.replaceWith(wrapper);

    wrapper.addEventListener("dblclick", () => {
      const content = getContent();
      const re = /```graph\n([\s\S]*?)```/g;
      let match, idx = 0;
      while ((match = re.exec(content))) {
        if (idx === blockIndex) {
          try { openGraphCanvas(JSON.parse(match[1].trim()), match.index, match[0].length); }
          catch (_) { openGraphCanvas(data); }
          return;
        }
        idx++;
      }
      openGraphCanvas(data);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR INSERT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function wrapSelection(before, after = before) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length }
  });
  view.focus();
}

function insertAtLineStart(prefix) {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  const changes = [];
  for (let ln = startLine.number; ln <= endLine.number; ln++) {
    const line = view.state.doc.line(ln);
    if (line.text.startsWith(prefix)) {
      changes.push({ from: line.from, to: line.from + prefix.length, insert: "" });
    } else {
      let actualPrefix = prefix;
      if (prefix === "1. " && ln > startLine.number) actualPrefix = `${ln - startLine.number + 1}. `;
      changes.push({ from: line.from, insert: actualPrefix });
    }
  }
  view.dispatch({ changes });
  view.focus();
}

function insertSnippet(text) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const insert = (line.text.trim() === "" ? "" : "\n") + text + "\n";
  view.dispatch({ changes: { from: line.to, insert } });
  view.focus();
}

function insertBlock(text) {
  const cursor = view.state.selection.main.head;
  const line = view.state.doc.lineAt(cursor);
  const insert = line.text.trim() === "" ? text + "\n" : "\n" + text + "\n";
  view.dispatch({ changes: { from: line.to, insert } });
  view.focus();
}

function removeLineStart(pattern) {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  const changes = [];
  for (let ln = startLine.number; ln <= endLine.number; ln++) {
    const line = view.state.doc.line(ln);
    const match = line.text.match(pattern);
    if (match) changes.push({ from: line.from, to: line.from + match[0].length, insert: "" });
  }
  if (changes.length) view.dispatch({ changes });
  view.focus();
}

function saveAs() {
  const name = prompt("Save as:", currentFile);
  if (!name) return;
  currentFile = name.endsWith(".md") ? name : name + ".md";
  document.getElementById("filename-input").value = currentFile.split("/").pop();
  saveFile();
}

function clearFormat() {
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  let text = view.state.sliceDoc(from, to);
  text = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/~~(.+?)~~/g, "$1").replace(/==(.+?)==/g, "$1");
  text = text.replace(/`(.+?)`/g, "$1").replace(/<u>(.+?)<\/u>/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  view.dispatch({ changes: { from, to, insert: text } });
  view.focus();
}

function increaseHeading() {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const match = line.text.match(/^(#{1,6})\s/);
  if (match) {
    if (match[1].length < 6) view.dispatch({ changes: { from: line.from, to: line.from + match[1].length, insert: match[1] + "#" } });
  } else {
    view.dispatch({ changes: { from: line.from, insert: "# " } });
  }
  view.focus();
}

function decreaseHeading() {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const match = line.text.match(/^(#{1,6})\s/);
  if (match) {
    if (match[1].length === 1) view.dispatch({ changes: { from: line.from, to: line.from + 2, insert: "" } });
    else view.dispatch({ changes: { from: line.from, to: line.from + match[1].length, insert: match[1].slice(1) } });
  }
  view.focus();
}

function selectLine() {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({ selection: { anchor: line.from, head: line.to } });
  view.focus();
}

function selectWord() {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const offset = pos - line.from;
  const text = line.text;
  let start = offset, end = offset;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  while (end < text.length && /\w/.test(text[end])) end++;
  view.dispatch({ selection: { anchor: line.from + start, head: line.from + end } });
  view.focus();
}

function deleteWord() {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const offset = pos - line.from;
  const text = line.text;
  let start = offset, end = offset;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  while (end < text.length && /\w/.test(text[end])) end++;
  if (start !== end) view.dispatch({ changes: { from: line.from + start, to: line.from + end, insert: "" } });
  view.focus();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS MAP
// ═══════════════════════════════════════════════════════════════════════════════
const ACTIONS = {
  bold: () => wrapSelection("**"),
  italic: () => wrapSelection("*"),
  code: () => wrapSelection("`"),
  link: () => wrapSelection("[", "](url)"),
  image: () => document.getElementById("image-input").click(),
  h1: () => insertAtLineStart("# "),
  h2: () => insertAtLineStart("## "),
  h3: () => insertAtLineStart("### "),
  h4: () => insertAtLineStart("#### "),
  h5: () => insertAtLineStart("##### "),
  h6: () => insertAtLineStart("###### "),
  paragraph: () => removeLineStart(/^#{1,6}\s+/),
  ul: () => insertAtLineStart("- "),
  ol: () => insertAtLineStart("1. "),
  task: () => insertAtLineStart("- [ ] "),
  blockquote: () => insertAtLineStart("> "),
  codeblock: () => insertSnippet("```\n\n```"),
  mathblock: () => insertSnippet("$$\n\n$$"),
  highlight: () => wrapSelection("=="),
  strikethrough: () => wrapSelection("~~"),
  underline: () => wrapSelection("<u>", "</u>"),
  superscript: () => wrapSelection("<sup>", "</sup>"),
  subscript: () => wrapSelection("<sub>", "</sub>"),
  hr: () => insertBlock("\n---\n"),
  toc: () => insertBlock("\n[TOC]\n"),
  "increase-heading": () => increaseHeading(),
  "decrease-heading": () => decreaseHeading(),
  table: () => openTableModal(),
  diagram: () => openDiagramModal(),
  flashcard: () => insertSnippet(":::qa\nQuestion goes here\n:::\nAnswer goes here\n:::"),
  graph: () => openGraphCanvas(),
  cut: () => {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to);
    if (text) {
      navigator.clipboard.writeText(text);
      view.dispatch({ changes: { from, to, insert: "" } });
    }
  },
  copy: () => {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to);
    if (text) navigator.clipboard.writeText(text);
  },
  paste: async () => {
    try {
      const text = await navigator.clipboard.readText();
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text } });
    } catch {}
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VIM MODE
// ═══════════════════════════════════════════════════════════════════════════════
const vimCompartment = new Compartment();
let vimEnabled = localStorage.getItem("sc-vim") !== "false";

const vimIndicator = document.getElementById("vim-mode-indicator");
function updateVimIndicator(modeName) {
  if (!vimEnabled || !modeName) { vimIndicator.classList.add("hidden"); return; }
  vimIndicator.classList.remove("hidden");
  vimIndicator.className = "vim-mode vim-" + modeName.toLowerCase().replace(/[^a-z]/g, "");
  vimIndicator.textContent = modeName.toUpperCase();
}
updateVimIndicator(vimEnabled ? "normal" : "");

function registerVimCommands() {
  Vim.defineEx("write", "w", () => saveFile());
  Vim.defineEx("wq", "", () => saveFile());
  Vim.defineEx("xit", "x", () => saveFile());
  Vim.defineEx("quit", "q", () => {
    if (isDirty) setStatus("Unsaved changes — use :w first", true);
    else setStatus("Nothing to close");
  });
  Vim.defineEx("help", "", () => {
    document.getElementById("help-panel").classList.add("open");
  });
  Vim.defineEx("set", "", (cm, params) => {
    const arg = (params.args || []).join(" ");
    if (arg === "vim") { enableVim(); return; }
    if (arg === "novim") { disableVim(); return; }
    Vim.handleEx(cm, `set ${arg}`);
  });

  // :e [filename] — open a file by name, or prompt if no arg
  Vim.defineEx("edit", "e", (cm, params) => {
    const arg = (params.args || []).join(" ").trim();
    if (arg) {
      const name = arg.endsWith(".md") ? arg : arg + ".md";
      openFile(name);
    } else {
      document.getElementById("search-input").focus();
    }
  });

  // :new — create a new file
  Vim.defineEx("new", "", () => {
    document.getElementById("btn-new").click();
  });

  // :saveas [filename] — save with a new name
  Vim.defineEx("saveas", "sav", (cm, params) => {
    const arg = (params.args || []).join(" ").trim();
    if (arg) {
      const name = arg.endsWith(".md") ? arg : arg + ".md";
      currentFile = name;
      document.getElementById("filename-input").value = name;
      saveFile();
    } else {
      saveAs();
    }
  });

  // :bn / :bnext — open next file in sidebar
  Vim.defineEx("bnext", "bn", () => {
    navigateFiles(1);
  });

  // :bp / :bprev — open previous file in sidebar
  Vim.defineEx("bprevious", "bp", () => {
    navigateFiles(-1);
  });

  // :files — switch to files sidebar tab
  Vim.defineEx("files", "", () => {
    switchSidebarMode("files");
    if (!document.getElementById("sidebar").classList.contains("collapsed")) return;
    toggleSidebar();
  });

  // :outline — switch to outline sidebar tab
  Vim.defineEx("outline", "", () => {
    switchSidebarMode("outline");
    if (document.getElementById("sidebar").classList.contains("collapsed")) toggleSidebar();
  });

  // :preview — toggle preview pane
  Vim.defineEx("preview", "", () => {
    togglePreview();
  });

  // :theme [name] — switch theme
  Vim.defineEx("theme", "", (cm, params) => {
    const name = (params.args || []).join(" ").trim();
    if (name) {
      applyTheme(name);
      setStatus(`Theme: ${name}`);
    } else {
      setStatus("Usage: :theme <name>");
    }
  });

  // :noh — clear search highlights
  Vim.defineEx("nohlsearch", "noh", () => {
    setStatus("");
  });
}

// Navigate to next/previous file in the file list
function navigateFiles(direction) {
  const fileItems = [...document.querySelectorAll("li.tree-file")];
  if (!fileItems.length) { setStatus("No files in sidebar", true); return; }
  const paths = fileItems.map(li => li.dataset.filePath);
  const idx = paths.indexOf(currentFile);
  let next = idx + direction;
  if (next < 0) next = paths.length - 1;
  if (next >= paths.length) next = 0;
  openFile(paths[next]);
}

function enableVim() {
  vimEnabled = true;
  localStorage.setItem("sc-vim", "true");
  view.dispatch({ effects: vimCompartment.reconfigure(vim()) });
  updateVimIndicator("normal");
  startVimPolling();
  setStatus("Vim mode enabled");
}

function disableVim() {
  vimEnabled = false;
  localStorage.setItem("sc-vim", "false");
  view.dispatch({ effects: vimCompartment.reconfigure([]) });
  updateVimIndicator("");
  stopVimPolling();
  setStatus("Vim mode disabled");
}

function toggleVim() {
  if (vimEnabled) disableVim(); else enableVim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOCORRECT
// ═══════════════════════════════════════════════════════════════════════════════
const AUTOCORRECT_MAP = {
  "teh":"the","hte":"the","adn":"and","nad":"and","recieve":"receive",
  "beleive":"believe","freind":"friend","wierd":"weird","occured":"occurred",
  "seperate":"separate","definately":"definitely","goverment":"government",
  "accomodate":"accommodate","untill":"until","doesnt":"doesn't",
  "didnt":"didn't","youre":"you're","theyre":"they're","ive":"I've",
  "im":"I'm","ill":"I'll","wont":"won't","dont":"don't","cant":"can't",
  "isnt":"isn't","wasnt":"wasn't","wouldnt":"wouldn't","couldnt":"couldn't",
  "shouldnt":"shouldn't","havent":"haven't","hasnt":"hasn't",
};

const autocorrectPlugin = EditorView.inputHandler.of((view, from, to, text) => {
  if (!/^[\s.,!?;:]$/.test(text)) return false;
  const doc = view.state.doc;
  const lineStart = doc.lineAt(from).from;
  const textBefore = doc.sliceString(lineStart, from);
  const wordMatch = textBefore.match(/([a-zA-Z']+)$/);
  if (!wordMatch) return false;
  const word = wordMatch[1];
  const correction = AUTOCORRECT_MAP[word.toLowerCase()];
  if (!correction) return false;
  const corrected = word[0] === word[0].toUpperCase() ? correction[0].toUpperCase() + correction.slice(1) : correction;
  if (corrected === word) return false;
  const wordStart = from - word.length;
  view.dispatch({ changes: { from: wordStart, to: from, insert: corrected }, userEvent: "autocorrect" });
  view.dispatch({ changes: { from: wordStart + corrected.length, to: wordStart + corrected.length, insert: text }, userEvent: "input" });
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORD PREDICTION
// ═══════════════════════════════════════════════════════════════════════════════
const COMMON_WORDS = [
  "about","above","after","again","against","also","although","always","another","any",
  "because","been","before","being","between","both","business","called","could","different",
  "does","doing","during","each","even","every","example","find","first","following",
  "found","from","general","give","given","good","government","great","group","have",
  "here","high","however","human","important","including","information","interest","into",
  "just","keep","know","large","last","later","leave","less","life","like","likely",
  "little","long","look","made","make","many","might","more","most","much","must",
  "national","need","never","next","nothing","number","often","once","only","order",
  "other","over","part","people","place","point","possible","present","problem","provide",
  "public","really","right","same","school","should","show","since","small","social",
  "something","sometimes","state","still","such","system","take","than","that","their",
  "then","there","therefore","these","they","thing","think","this","those","though",
  "through","time","today","together","under","until","using","very","want","well",
  "were","what","when","where","whether","which","while","will","within","without",
  "work","world","would","write","year","your",
].map(w => ({ label: w, type: "text" }));

function wordCompletionSource(context) {
  const word = context.matchBefore(/[a-zA-Z]{2,}/);
  if (!word) return null;
  if (!context.explicit && word.text.length < 2) return null;
  const prefix = word.text.toLowerCase();
  const docWords = [...new Set(context.state.doc.toString().match(/[a-zA-Z]{3,}/g) || [])]
    .filter(w => w.toLowerCase() !== prefix).map(w => ({ label: w, type: "text" }));
  const allWords = [...COMMON_WORDS, ...docWords];
  const seen = new Set();
  const options = allWords.filter(({ label }) => {
    const l = label.toLowerCase();
    if (l === prefix || !l.startsWith(prefix) || seen.has(l)) return false;
    seen.add(l);
    return true;
  }).slice(0, 8);
  if (!options.length) return null;
  return { from: word.from, options, validFor: /^[a-zA-Z]*$/ };
}

const wordPrediction = autocompletion({
  override: [wordCompletionSource],
  activateOnTyping: true,
  maxRenderedOptions: 8,
  defaultKeymap: true,
});

// ═══════════════════════════════════════════════════════════════════════════════
// CODEMIRROR SETUP
// ═══════════════════════════════════════════════════════════════════════════════
const updateListener = EditorView.updateListener.of(update => {
  if (update.docChanged) {
    renderPreview();
    markDirty();
    // Detect /graph command
    const pos = update.state.selection.main.head;
    const line = update.state.doc.lineAt(pos);
    if (line.text.trim() === "/graph") {
      update.view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
      setTimeout(() => openGraphCanvas(), 50);
    }
  }
});

const customKeymap = keymap.of([
  { key: "Ctrl-0", run: () => { ACTIONS.paragraph(); return true; } },
  { key: "Ctrl-1", run: () => { ACTIONS.h1(); return true; } },
  { key: "Ctrl-2", run: () => { ACTIONS.h2(); return true; } },
  { key: "Ctrl-3", run: () => { ACTIONS.h3(); return true; } },
  { key: "Ctrl-4", run: () => { ACTIONS.h4(); return true; } },
  { key: "Ctrl-5", run: () => { ACTIONS.h5(); return true; } },
  { key: "Ctrl-6", run: () => { ACTIONS.h6(); return true; } },
  { key: "Ctrl-Shift-q", run: () => { ACTIONS.blockquote(); return true; } },
  { key: "Ctrl-Shift-c", run: () => { ACTIONS.codeblock(); return true; } },
  { key: "Ctrl-Shift-m", run: () => { ACTIONS.mathblock(); return true; } },
  { key: "Ctrl-Shift-k", run: () => { ACTIONS.codeblock(); return true; } },
  { key: "Ctrl-b", run: () => { ACTIONS.bold(); return true; } },
  { key: "Ctrl-i", run: () => { ACTIONS.italic(); return true; } },
  { key: "Ctrl-u", run: () => { ACTIONS.underline(); return true; } },
  { key: "Ctrl-e", run: () => { ACTIONS.code(); return true; } },
  { key: "Ctrl-Shift-h", run: () => { ACTIONS.highlight(); return true; } },
  { key: "Ctrl-k", run: () => { ACTIONS.link(); return true; } },
  { key: "Ctrl-Shift-i", run: () => { ACTIONS.image(); return true; } },
  { key: "Ctrl-Shift-8", run: () => { ACTIONS.ul(); return true; } },
  { key: "Ctrl-Shift-7", run: () => { ACTIONS.ol(); return true; } },
  { key: "Ctrl-Shift-x", run: () => { ACTIONS.task(); return true; } },
  { key: "Ctrl-t", run: () => { ACTIONS.table(); return true; } },
  { key: "Ctrl-s", run: () => { saveFile(); return true; } },
  { key: "Ctrl-o", run: () => { document.getElementById("file-input").click(); return true; } },
  { key: "Ctrl-Alt-v", run: () => { toggleVim(); return true; } },
  { key: "Ctrl-n", run: () => { document.getElementById("btn-new").click(); return true; } },
  { key: "Ctrl-p", run: () => { document.getElementById("search-input").focus(); return true; } },
  { key: "Ctrl-Shift-s", run: () => { saveAs(); return true; } },
  { key: "Ctrl-w", run: () => { setContent(""); currentFile = "untitled.md"; document.getElementById("filename-input").value = "untitled.md"; return true; } },
  { key: "Alt-Shift-5", run: () => { wrapSelection("~~"); return true; } },
  { key: "Ctrl-\\", run: () => { clearFormat(); return true; } },
  { key: "Ctrl-Shift-l", run: () => { toggleSidebar(); return true; } },
  { key: "Ctrl-/", run: () => { togglePreview(); return true; } },
  { key: "F7", run: () => { togglePreview(); return true; } },
  { key: "F8", run: () => { toggleFocusMode(); return true; } },
  { key: "F9", run: () => { toggleTypewriter(); return true; } },
  { key: "Ctrl-=", run: () => { increaseHeading(); return true; } },
  { key: "Ctrl--", run: () => { decreaseHeading(); return true; } },
  { key: "Ctrl-Shift-[", run: () => { ACTIONS.ol(); return true; } },
  { key: "Ctrl-Shift-]", run: () => { ACTIONS.ul(); return true; } },
  { key: "Ctrl-l", run: () => { selectLine(); return true; } },
  { key: "Ctrl-d", run: () => { selectWord(); return true; } },
  { key: "Ctrl-Shift-d", run: () => { deleteWord(); return true; } },
  { key: "Ctrl-,", run: () => { openSettings(); return true; } },
]);

const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      vimCompartment.of(vimEnabled ? vim() : []),
      history(),
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      markdown(),
      themeCompartment.of(oneDark),
      wordPrediction,
      autocorrectPlugin,
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab, ...completionKeymap]),
      customKeymap,
      updateListener,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on", autocapitalize: "on" }),
    ],
  }),
  parent: document.getElementById("cm-editor"),
});

registerVimCommands();

// Synchronized scrolling between editor and preview
let isScrollingSynced = true;
const editorScroller = view.scrollDOM;
const previewEl = document.getElementById("preview");

function syncEditorToPreview() {
  if (!isScrollingSynced) return;
  isScrollingSynced = false;
  
  const editorMaxScroll = Math.max(0, editorScroller.scrollHeight - editorScroller.clientHeight);
  const previewMaxScroll = Math.max(0, previewEl.scrollHeight - previewEl.clientHeight);
  
  if (editorMaxScroll > 0 && previewMaxScroll > 0) {
    const editorScrollRatio = editorScroller.scrollTop / editorMaxScroll;
    previewEl.scrollTop = editorScrollRatio * previewMaxScroll;
  }
  
  requestAnimationFrame(() => { isScrollingSynced = true; });
}

function syncPreviewToEditor() {
  if (!isScrollingSynced) return;
  isScrollingSynced = false;
  
  const editorMaxScroll = Math.max(0, editorScroller.scrollHeight - editorScroller.clientHeight);
  const previewMaxScroll = Math.max(0, previewEl.scrollHeight - previewEl.clientHeight);
  
  if (editorMaxScroll > 0 && previewMaxScroll > 0) {
    const previewScrollRatio = previewEl.scrollTop / previewMaxScroll;
    editorScroller.scrollTop = previewScrollRatio * editorMaxScroll;
  }
  
  requestAnimationFrame(() => { isScrollingSynced = true; });
}

editorScroller.addEventListener("scroll", syncEditorToPreview);
previewEl.addEventListener("scroll", syncPreviewToEditor);

// Focus editor on load and activate INSERT if Vim enabled
setTimeout(() => {
  view.focus();
  if (vimEnabled) {
    try {
      Vim.handleKey(view.contentDOM, 'i');
    } catch (e) {}
  }
  updateSidebarWidth();
}, 100);

// Vim mode polling — only poll when vim is enabled
let lastVimMode = "normal";
let vimPollId = null;

function pollVimMode() {
  if (!vimEnabled) { vimPollId = null; return; }
  let mode = "normal";
  try {
    const panel = view.dom.querySelector(".cm-vim-panel");
    if (panel) {
      const txt = panel.textContent.trim();
      if (txt.includes("INSERT")) mode = "insert";
      else if (txt.includes("VISUAL")) mode = "visual";
      else if (txt.includes("REPLACE")) mode = "replace";
      else if (txt.includes("COMMAND")) mode = "command";
    } else {
      const cmVim = view.cm;
      if (cmVim?.state?.vim) {
        const vs = cmVim.state.vim;
        if (vs.insertMode) mode = "insert";
        else if (vs.visualMode) mode = "visual";
        else if (vs.replaceMode) mode = "replace";
      }
    }
  } catch (_) {}
  if (mode !== lastVimMode) { lastVimMode = mode; updateVimIndicator(mode); }
  vimPollId = requestAnimationFrame(pollVimMode);
}

function startVimPolling() {
  if (vimPollId == null) vimPollId = requestAnimationFrame(pollVimMode);
}

function stopVimPolling() {
  if (vimPollId != null) { cancelAnimationFrame(vimPollId); vimPollId = null; }
}

if (vimEnabled) startVimPolling();

doRenderPreview();

// ═══════════════════════════════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════════════════════════════
const lightCmTheme = EditorView.theme({}, { dark: false });

const themeConfig = {
  dark: { cmTheme: oneDark, label: "Dark" },
  light: { cmTheme: lightCmTheme, label: "Light" },
  // Dark inline themes
  midnight: { cmTheme: oneDark, label: "Midnight" },
  void: { cmTheme: oneDark, label: "Void" },
  ember: { cmTheme: oneDark, label: "Ember" },
  cobalt: { cmTheme: oneDark, label: "Cobalt" },
  coral: { cmTheme: oneDark, label: "Coral" },
  ocean: { cmTheme: oneDark, label: "Ocean" },
  sunset: { cmTheme: oneDark, label: "Sunset" },
  // Light inline themes
  arctic: { cmTheme: lightCmTheme, label: "Arctic" },
  sakura: { cmTheme: lightCmTheme, label: "Sakura" },
  mocha: { cmTheme: lightCmTheme, label: "Mocha" },
  seniva: { cmTheme: lightCmTheme, label: "Seniva" },
  lavender: { cmTheme: lightCmTheme, label: "Lavender" },
  // External CSS themes (loaded dynamically)
  github: { cmTheme: lightCmTheme, label: "GitHub" },
  nord: { cmTheme: oneDark, label: "Nord" },
  drake: { cmTheme: oneDark, label: "Drake" },
  pie: { cmTheme: lightCmTheme, label: "Pie" },
  ursine: { cmTheme: oneDark, label: "Ursine" },
  lapis: { cmTheme: oneDark, label: "Lapis" },
  vue: { cmTheme: lightCmTheme, label: "Vue" },
};

let currentTheme = "dark";
let loadedThemes = {}; // Store dynamically loaded themes

// Themes that have CSS files
const themesWithCSS = ['github', 'nord', 'drake', 'pie', 'ursine', 'lapis', 'vue'];

// Apply theme - handles both built-in and loaded themes
async function applyTheme(themeName) {
  // Check if it's a built-in theme first
  if (themeConfig[themeName]) {
    currentTheme = themeName;
    localStorage.setItem("sc-theme", themeName);
    
    // Check if this theme has a CSS file
    if (themesWithCSS.includes(themeName)) {
      // Load the theme CSS
      let link = document.getElementById('loaded-theme-css');
      if (!link) {
        link = document.createElement('link');
        link.id = 'loaded-theme-css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `/static/themes/${themeName}.css`;
      
      // Determine if dark or light based on theme name patterns
      const isDark = themeName.toLowerCase().includes('dark') ||
                     ['nord', 'midnight', 'void', 'ember', 'cobalt', 'coral', 'ocean', 'sunset', 'drake', 'ursine', 'lapis'].includes(themeName.toLowerCase());
      const themeAttr = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute("data-theme", themeAttr);
    } else {
      // It's a built-in theme without CSS file (uses inline styles)
      document.documentElement.setAttribute("data-theme", themeName);
      // Remove any loaded theme CSS
      const loadedThemeLink = document.getElementById('loaded-theme-css');
      if (loadedThemeLink) loadedThemeLink.remove();
    }
    
    // Apply appropriate CodeMirror theme
    view.dispatch({ effects: themeCompartment.reconfigure(themeConfig[themeName].cmTheme) });
  } else if (loadedThemes[themeName]) {
    // It's a loaded external theme
    currentTheme = themeName;
    localStorage.setItem("sc-theme", themeName);
    
    // Load the theme CSS
    let link = document.getElementById('loaded-theme-css');
    if (!link) {
      link = document.createElement('link');
      link.id = 'loaded-theme-css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `/static/themes/${themeName}.css`;
    
    // Determine if dark or light based on theme name patterns
    const isDark = themeName.toLowerCase().includes('dark');
    const themeAttr = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute("data-theme", themeAttr);
    
    // Apply appropriate CodeMirror theme
    const cmTheme = isDark ? oneDark : lightCmTheme;
    view.dispatch({ effects: themeCompartment.reconfigure(cmTheme) });
  }
  
  // Update checkmark in menu
  document.querySelectorAll(".theme-option").forEach(btn => {
    btn.classList.toggle("active-theme", btn.dataset.theme === themeName);
  });
}

// Load themes from the themes folder and add to menu
async function loadExternalThemes() {
  try {
    const res = await fetch('/themes');
    const data = await res.json();
    console.log('Loaded themes:', data.themes);
    if (!data.themes || data.themes.length === 0) return;
    
    const themeMenu = document.getElementById('theme-menu');
    console.log('Theme menu found:', !!themeMenu);
    if (!themeMenu) return;
    
    // Add separator before external themes
    const sep = document.createElement('div');
    sep.className = 'menu-sep';
    sep.id = 'external-themes-sep';
    themeMenu.appendChild(sep);
    
    for (const theme of data.themes) {
      // Skip if already added (built-in theme)
      if (themeConfig[theme.id]) {
        console.log('Skipping built-in theme:', theme.id);
        continue;
      }
      
      console.log('Adding external theme:', theme.id);
      loadedThemes[theme.id] = theme;
      
      const btn = document.createElement('button');
      btn.className = 'theme-option';
      btn.dataset.theme = theme.id;
      btn.textContent = theme.name;
      btn.addEventListener('click', () => {
        applyTheme(theme.id);
        closeAllMenus();
      });
      themeMenu.appendChild(btn);
    }
  } catch (e) {
    console.warn('Failed to load external themes:', e);
  }
}

// Theme selection from menu
document.querySelectorAll(".theme-option").forEach(btn => {
  btn.addEventListener("click", () => {
    applyTheme(btn.dataset.theme);
    closeAllMenus();
  });
});

// Load external themes from themes folder
loadExternalThemes();

const savedTheme = localStorage.getItem("sc-theme") || "light";
applyTheme(savedTheme);

// ═══════════════════════════════════════════════════════════════════════════════
// MENU BAR DROPDOWN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
let activeMenu = null;

document.querySelectorAll(".menu-dropdown").forEach(dropdown => {
  const trigger = dropdown.querySelector(".menu-trigger");
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = dropdown.classList.contains("open");
    closeAllMenus();
    if (!wasOpen) {
      dropdown.classList.add("open");
      activeMenu = dropdown;
    }
  });
  trigger.addEventListener("mouseenter", () => {
    if (activeMenu && activeMenu !== dropdown) {
      closeAllMenus();
      dropdown.classList.add("open");
      activeMenu = dropdown;
    }
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-dropdown")) closeAllMenus();
});

function closeAllMenus() {
  document.querySelectorAll(".menu-dropdown.open").forEach(d => d.classList.remove("open"));
  activeMenu = null;
}

// Wire menu panel action buttons
document.querySelectorAll(".menu-panel button[data-action]").forEach(btn => {
  btn.addEventListener("click", () => {
    closeAllMenus();
    // Ensure editor has focus before executing action
    view.focus();
    if (ACTIONS[btn.dataset.action]) ACTIONS[btn.dataset.action]();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════
let expandedFolders = new Set();

function loadExpandedFolders() {
  try {
    const saved = localStorage.getItem("sc-expanded-folders");
    if (saved) expandedFolders = new Set(JSON.parse(saved));
  } catch (e) {}
}

function saveExpandedFolders() {
  try { localStorage.setItem("sc-expanded-folders", JSON.stringify([...expandedFolders])); }
  catch (e) {}
}

loadExpandedFolders();

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("collapsed");
  document.body.classList.toggle("sidebar-collapsed", sidebar.classList.contains("collapsed"));
  updateSidebarWidth();
}


document.getElementById("btn-sidebar").addEventListener("click", toggleSidebar);
document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => { closeAllMenus(); toggleSidebar(); });
document.getElementById("btn-refresh-files").addEventListener("click", loadFileList);

// ── Sidebar mode switching ───────────────────────────────────────────────────
document.querySelectorAll(".sidebar-tab[data-mode]").forEach(tab => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    if (mode === sidebarMode) return;
    switchSidebarMode(mode);
  });
});

function switchSidebarMode(mode) {
  sidebarMode = mode;
  document.querySelectorAll(".sidebar-tab[data-mode]").forEach(t => {
    t.classList.toggle("active", t.dataset.mode === mode);
  });
  
  // Handle files mode with sub-views (tree/list)
  document.querySelectorAll(".sidebar-content").forEach(panel => {
    const panelMode = panel.dataset.for;
    if (mode === "files") {
      // For files mode, show tree or list based on filesViewMode
      panel.style.display = (panelMode === "tree" || panelMode === "list") && panelMode === filesViewMode ? "" : "none";
    } else {
      // For other modes, match directly
      panel.style.display = panelMode === mode ? "" : "none";
    }
  });
  
  // Update bottom controls visibility
  const isFilesMode = mode === "files";
  const isOutlineMode = mode === "outline";
  const isCloudMode = mode === "git" || mode === "gdrive";
  
  document.querySelectorAll(".bottom-controls-group").forEach(group => {
    if (group.dataset.for === "outline") {
      group.style.display = isOutlineMode ? "flex" : "none";
    } else if (group.dataset.for === "files") {
      group.style.display = isFilesMode ? "flex" : "none";
    }
  });
  
  // Hide bottom controls for cloud modes
  const bottomControls = document.getElementById("sidebar-bottom-controls");
  if (bottomControls) {
    bottomControls.style.display = isCloudMode ? "none" : "";
  }
  
  // Update view toggle icon
  updateViewToggleIcon();
  
  // Update search check mark in context menu
  updateSearchCheckMark();
  
  if (mode === "files" && filesViewMode === "list") populateFileList();
  if (mode === "outline") updateOutline();
  if (mode === "gdrive") checkGdriveStatus();
}

function updateViewToggleIcon() {
  const treeIcon = document.querySelector(".view-icon-tree");
  const listIcon = document.querySelector(".view-icon-list");
  if (!treeIcon || !listIcon) return;
  
  if (filesViewMode === "tree") {
    treeIcon.style.display = "";
    listIcon.style.display = "none";
  } else if (filesViewMode === "list") {
    treeIcon.style.display = "none";
    listIcon.style.display = "";
  }
}

// ── File list (flat mode) ────────────────────────────────────────────────────
async function populateFileList() {
  const res = await fetch("/files");
  const { files } = await res.json();
  const ul = document.getElementById("file-list-flat");
  ul.innerHTML = "";
  if (!files.length) {
    const li = document.createElement("li");
    li.className = "no-results";
    li.textContent = "No files";
    ul.appendChild(li);
    return;
  }
  // files may be objects {path, preview} or strings — normalize
  const paths = files.map(f => typeof f === "string" ? f : f.path);
  paths.sort(getSortComparator());
  paths.forEach(filePath => {
    const li = document.createElement("li");
    const fileName = filePath.split("/").pop();
    const folder = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";
    const nameEl = document.createElement("div");
    nameEl.className = "flat-file-name";
    nameEl.textContent = fileName.replace(/\.md$/, "");
    li.appendChild(nameEl);
    if (folder) {
      const pathEl = document.createElement("div");
      pathEl.className = "flat-file-path";
      pathEl.textContent = folder;
      li.appendChild(pathEl);
    }
    li.addEventListener("click", () => openFile(filePath));
    ul.appendChild(li);
  });
}

// ─��� Outline mode ─────────────────────────────────────────────────────────────
let outlineTimer = null;

function updateOutline() {
  const ol = document.getElementById("outline-list");
  const empty = document.getElementById("outline-empty");
  ol.innerHTML = "";
  const content = getContent();
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({ level: match[1].length, text: match[2].trim(), offset: match.index });
  }
  if (!headings.length) {
    ol.style.display = "none";
    empty.style.display = "";
    return;
  }
  ol.style.display = "";
  empty.style.display = "none";
  headings.forEach(h => {
    const li = document.createElement("li");
    li.className = `outline-h${h.level}`;
    li.textContent = h.text;
    li.title = h.text;
    li.addEventListener("click", () => {
      // Scroll in editor
      const line = view.state.doc.lineAt(h.offset);
      view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      view.focus();
      
      // Also scroll in preview if visible
      const previewPane = document.getElementById("preview-pane");
      if (previewPane && !previewPane.classList.contains("hidden-pane")) {
        const preview = document.getElementById("preview");
        const headings = preview.querySelectorAll("h1, h2, h3, h4, h5, h6");
        const targetHeading = Array.from(headings).find(el => el.textContent.trim() === h.text);
        if (targetHeading) {
          targetHeading.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      
      ol.querySelectorAll("li").forEach(el => el.classList.remove("outline-active"));
      li.classList.add("outline-active");
    });
    ol.appendChild(li);
  });
}

// ── File tree loading ────────────────────────────────────────────────────────
let _loadFileListTimer = null;
let _loadFileListPromiseResolvers = [];

async function loadFileList() {
  // Debounce: collapse rapid successive calls into a single fetch
  return new Promise((resolve) => {
    _loadFileListPromiseResolvers.push(resolve);
    if (_loadFileListTimer) clearTimeout(_loadFileListTimer);
    _loadFileListTimer = setTimeout(async () => {
      _loadFileListTimer = null;
      const resolvers = _loadFileListPromiseResolvers.splice(0);
      try {
        const res = await fetch("/files");
        const { files, folders } = await res.json();
        const ul = document.getElementById("file-list");
        ul.innerHTML = "";
        
        // Add root folder header
        const rootFolderName = document.getElementById("workspace-name")?.textContent || "Files";
        const rootHeader = document.createElement("li");
        rootHeader.className = "root-folder-header";
        rootHeader.innerHTML = `<span class="folder-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 012.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 00-.5.5V6h12v-.5a.5.5 0 00-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V7z"/></svg></span><span class="folder-name">${rootFolderName}</span>`;
        ul.appendChild(rootHeader);
        
        const tree = buildTree(folders, files);
        renderTree(tree, ul);
      } finally {
        resolvers.forEach(r => r());
      }
    }, 150);
  });
}

function buildTree(folders, files) {
  const tree = { children: {}, files: [] };
  folders.forEach(folderPath => {
    const parts = folderPath.replace(/\/$/, "").split("/");
    let current = tree;
    parts.forEach((part, index) => {
      if (!current.children[part]) {
        current.children[part] = { children: {}, files: [], path: parts.slice(0, index + 1).join("/") };
      }
      current = current.children[part];
    });
  });
  files.forEach(file => {
    const filePath = typeof file === 'string' ? file : file.path;
    const preview = typeof file === 'object' ? file.preview : '';
    const parts = filePath.split("/");
    const fileName = parts.pop();
    let current = tree;
    parts.forEach(part => {
      if (!current.children[part]) current.children[part] = { children: {}, files: [], path: part };
      current = current.children[part];
    });
    current.files.push({ name: fileName, path: filePath, preview: preview });
  });
  return tree;
}

function naturalSort(a, b) {
  const ax = [], bx = [];
  a.replace(/(\d+)|(\D+)/g, (_, n, s) => ax.push([n || 0, s || '']));
  b.replace(/(\d+)|(\D+)/g, (_, n, s) => bx.push([n || 0, s || '']));
  while (ax.length && bx.length) {
    const an = ax.shift(), bn = bx.shift();
    const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (nn) return nn;
  }
  return ax.length - bx.length;
}

function renderTree(node, container) {
  Object.keys(node.children).sort(getSortComparator()).forEach(folderName => {
    const folderNode = node.children[folderName];
    const folderPath = folderNode.path || folderName;
    const isExpanded = expandedFolders.has(folderPath);

    const li = document.createElement("li");
    li.className = "tree-folder";
    li.dataset.folderPath = folderPath;

    const header = document.createElement("div");
    header.className = "folder-header";

    const arrow = document.createElement("span");
    arrow.className = "folder-arrow" + (isExpanded ? " expanded" : "");
    arrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1.5l5 5-5 5V1.5z"/></svg>';

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.innerHTML = isExpanded 
      ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M.54 3.87L.5 3a2 2 0 012-2h3.672a2 2 0 011.414.586l.828.828A2 2 0 009.828 3h3.982a2 2 0 011.992 2.181L15.546 8H14.54L14.8 5.181A1 1 0 0013.81 4H9.828a1 1 0 01-.707-.293L8.293 2.879A1 1 0 007.586 2.586L6.758 1.758A1 1 0 006.172 1.5H2.5a1 1 0 00-1 1l.04.87z"/><path d="M0 8a2 2 0 012-2h12a2 2 0 012 2v5a2 2 0 01-2 2H2a2 2 0 01-2-2V8z"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 012.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 00-.5.5V6h12v-.5a.5.5 0 00-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V7z"/></svg>';


    const nameSpan = document.createElement("span");
    nameSpan.className = "folder-name";
    nameSpan.textContent = folderName;

    header.appendChild(arrow);
    header.appendChild(icon);
    header.appendChild(nameSpan);
    header.addEventListener("click", () => {
      toggleFolderExpand(folderPath);
      // Update bottom to show folder name
      const fileNameEl = document.getElementById("bottom-folder-name");
      if (fileNameEl) {
        fileNameEl.textContent = folderName;
      }
    });
    li.appendChild(header);

    header.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      contextMenuTarget = folderPath;
      contextMenuIsFolder = true;
      showContextMenu(e.clientX, e.clientY, "folder");
    });

    header.addEventListener("dragover", (e) => {
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      header.classList.add("drag-over");
    });
    header.addEventListener("dragleave", (e) => {
      if (!header.contains(e.relatedTarget)) header.classList.remove("drag-over");
    });
    header.addEventListener("drop", async (e) => {
      e.preventDefault(); e.stopPropagation();
      header.classList.remove("drag-over");
      const src = e.dataTransfer.getData("text/plain");
      if (src) {
        const fileName = src.split("/").pop();
        const dst = `${folderPath}/${fileName}`;
        if (src !== dst) await moveFile(src, dst);
      }
    });

    container.appendChild(li);

    if (isExpanded) {
      const childUl = document.createElement("ul");
      childUl.className = "tree-children";
      li.appendChild(childUl);
      renderTree(folderNode, childUl);
    }
  });

  node.files.sort(getFileSortComparator()).forEach(file => {
    const li = document.createElement("li");
    li.className = "tree-file";
    if (file.path === currentFile) li.classList.add("active-file");
    li.dataset.filePath = file.path;
    li.draggable = true;

    const fileContent = document.createElement("div");
    fileContent.className = "file-content";
    
    const fileIcon = document.createElement("span");
    fileIcon.className = "file-icon";
    fileIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.707A1 1 0 0013.707 4L10 .293A1 1 0 009.293 0H4zm0 1h5v3.5A1.5 1.5 0 0010.5 6H13v8a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm6.5 0v3a.5.5 0 00.5.5h3l-3.5-3.5z"/></svg>';
    fileContent.appendChild(fileIcon);
    
    const span = document.createElement("span");
    span.className = "file-name";
    span.textContent = file.name;
    fileContent.appendChild(span);
    
    if (file.preview) {
      const preview = document.createElement("div");
      preview.className = "file-preview";
      preview.textContent = file.preview;
      fileContent.appendChild(preview);
    }
    
    li.appendChild(fileContent);

    li.addEventListener("click", () => openFile(file.path));
    
    // Double-click to rename
    li.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const displayName = file.name.replace(/\.md$/, "");
      const newName = prompt("Rename file:", displayName);
      if (!newName || newName === displayName) return;
      
      // Use the rename logic from context menu
      (async () => {
        const r = await fetch(`/files/${encodeURIComponent(file.path)}`);
        if (!r.ok) { setStatus("Failed to read file", true); return; }
        const { content } = await r.json();
        const parent = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";
        const finalName = newName.endsWith(".md") ? newName : newName + ".md";
        const newFull = parent ? `${parent}/${finalName}` : finalName;
        
        const createRes = await fetch(`/files/${encodeURIComponent(newFull)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
        });
        
        if (!createRes.ok) { setStatus("Failed to create renamed file", true); return; }
        
        await fetch(`/files/${encodeURIComponent(file.path)}`, { method: "DELETE" });
        
        if (currentFile === file.path) {
          currentFile = newFull;
          document.getElementById("filename-input").value = finalName;
        }
        
        await loadFileList();
        setStatus(`Renamed to "${finalName}"`);
      })();
    });
    
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", file.path);
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      contextMenuTarget = file.path;
      contextMenuIsFolder = false;
      showContextMenu(e.clientX, e.clientY, "file");
    });

    container.appendChild(li);
  });
}

function toggleFolderExpand(folderPath) {
  if (expandedFolders.has(folderPath)) expandedFolders.delete(folderPath);
  else expandedFolders.add(folderPath);
  saveExpandedFolders();
  loadFileList();
}

function revealInSidebar(filePath) {
  const parts = filePath.split("/");
  parts.pop();
  if (!parts.length) return;
  let accumulated = "";
  let needsRefresh = false;
  parts.forEach(part => {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    if (!expandedFolders.has(accumulated)) {
      expandedFolders.add(accumulated);
      needsRefresh = true;
    }
  });
  if (needsRefresh) { saveExpandedFolders(); loadFileList(); }
  setTimeout(() => {
    const fileEl = document.querySelector(`[data-file-path="${filePath}"]`);
    if (fileEl) {
      fileEl.classList.add("highlighted");
      fileEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => fileEl.classList.remove("highlighted"), 2000);
    }
  }, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function openFile(name) {
  const res = await fetch(`/files/${encodeURIComponent(name)}`);
  if (!res.ok) { setStatus("Could not open file", true); return; }
  const { content } = await res.json();
  currentFile = name;
  document.getElementById("filename-input").value = name;
  setContent(content);
  const displayPath = workspaceName ? `${workspaceName}/${name}` : name;
  setStatus(`Opened ${displayPath}`);
  revealInSidebar(name);
  
  // Update bottom file name
  updateBottomFileName();
  
  // Add to recent files
  const recent = JSON.parse(localStorage.getItem("lectura-recent-files") || "[]");
  const filtered = recent.filter(f => f !== name);
  filtered.unshift(name);
  localStorage.setItem("lectura-recent-files", JSON.stringify(filtered.slice(0, 20)));
  
  // Mark active in tree
  document.querySelectorAll("li.tree-file").forEach(el => {
    el.classList.toggle("active-file", el.dataset.filePath === currentFile);
  });
}

async function saveFile(silent = false) {
  const name = document.getElementById("filename-input").value.trim() || "untitled.md";
  let newFileName = name.endsWith(".md") ? name : name + ".md";
  if (!newFileName.includes("/") && currentFile.includes("/")) {
    const folder = currentFile.substring(0, currentFile.lastIndexOf("/"));
    newFileName = `${folder}/${newFileName}`;
  } else if (currentFolder && !newFileName.includes("/")) {
    newFileName = `${currentFolder}/${newFileName}`;
  }
  if (currentFile !== newFileName && currentFile !== "untitled.md" && !currentFile.includes("/untitled.md")) {
    await fetch(`/files/${encodeURIComponent(currentFile)}`, { method: "DELETE" });
  }
  currentFile = newFileName;
  document.getElementById("filename-input").value = newFileName.split("/").pop();
  const res = await fetch(`/files/${encodeURIComponent(currentFile)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: getContent() }),
  });
  if (res.ok) {
    isDirty = false;
    updateDirtyBadge();
    if (!silent) {
      const displayPath = workspaceName ? `${workspaceName}/${currentFile}` : currentFile;
      setStatus(`Saved ${displayPath}`);
    }
    loadFileList();
  } else {
    setStatus("Save failed", true);
  }
}

async function deleteFile(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  await fetch(`/files/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (currentFile === name) {
    setContent("");
    document.getElementById("filename-input").value = "untitled.md";
    currentFile = "untitled.md";
  }
  loadFileList();
  setStatus(`Deleted ${name}`);
}

async function moveFile(sourcePath, newPath) {
  try {
    const res = await fetch(`/files/${encodeURIComponent(sourcePath)}`);
    if (!res.ok) { setStatus("Failed to read file", true); return; }
    const { content } = await res.json();
    const saveRes = await fetch(`/files/${encodeURIComponent(newPath)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!saveRes.ok) { setStatus("Failed to create file at new location", true); return; }
    const delRes = await fetch(`/files/${encodeURIComponent(sourcePath)}`, { method: "DELETE" });
    if (!delRes.ok) { setStatus("Failed to delete original file", true); return; }
    if (currentFile === sourcePath) {
      currentFile = newPath;
      document.getElementById("filename-input").value = newPath.split("/").pop();
    }
    await loadFileList();
    setStatus(`Moved to ${newPath}`);
  } catch (e) { setStatus("Move failed: " + e.message, true); }
}

// ── New file button ──────────────────────────────────────────────────────────
document.getElementById("btn-new").addEventListener("click", async () => {
  closeAllMenus();
  
  // Use native file dialog in Electron (like Typora)
  if (window.electronAPI?.createNewFileDialog) {
    const folder = currentFolder || workspacePath || "";
    const defaultPath = folder ? `${folder}/untitled.md` : "untitled.md";
    const filePath = await window.electronAPI.createNewFileDialog(defaultPath);
    
    if (filePath) {
      // Create empty file on disk
      const r = await fetch(`/files/${encodeURIComponent(filePath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" })
      });
      
      if (r.ok) {
        currentFile = filePath;
        const fileName = filePath.split("/").pop();
        document.getElementById("filename-input").value = fileName;
        setContent("");
        updateBottomFileName();
        await loadFileList();
        setStatus(`Created ${fileName}`);
      } else {
        setStatus("Failed to create file", true);
      }
    }
    return;
  }
  
  // Fallback for web mode
  const folder = currentFolder || "";
  let counter = 1;
  let fileName = "untitled.md";
  let fullPath = folder ? `${folder}/${fileName}` : fileName;
  
  const res = await fetch("/files");
  const { files } = await res.json();
  while (files.includes(fullPath)) {
    fileName = `untitled-${counter}.md`;
    fullPath = folder ? `${folder}/${fileName}` : fileName;
    counter++;
  }
  
  const r = await fetch(`/files/${encodeURIComponent(fullPath)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "" })
  });
  
  if (r.ok) {
    currentFile = fullPath;
    document.getElementById("filename-input").value = fileName;
    setContent("");
    isDirty = false;
    updateDirtyBadge();
    updateBottomFileName();
    switchToEditorView();
    await loadFileList();
    revealInSidebar(fullPath);
    setStatus(`Created ${fileName}`);
    setTimeout(() => {
      const input = document.getElementById("filename-input");
      input.select();
      view.focus();
    }, 100);
  } else {
    setStatus("Failed to create file", true);
  }
});

document.getElementById("btn-save")?.addEventListener("click", () => { closeAllMenus(); saveFile(); });

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════���═══════════════════════════════════════════════════════
const contextMenu = document.getElementById("context-menu");
let contextMenuTarget = null;
let contextMenuIsFolder = false;
let clipboardOperation = null; // For copy/cut/paste operations

function handleSidebarContextMenu(e) {
  e.preventDefault();
  const li = e.target.closest("li");
  if (li) {
    contextMenuIsFolder = li.classList.contains("tree-folder");
    contextMenuTarget = contextMenuIsFolder ? li.dataset.folderPath : li.dataset.filePath;
    showContextMenu(e.clientX, e.clientY, contextMenuIsFolder ? "folder" : "file");
  } else {
    contextMenuTarget = null;
    contextMenuIsFolder = false;
    showContextMenu(e.clientX, e.clientY, "empty");
  }
}
document.getElementById("file-list").addEventListener("contextmenu", handleSidebarContextMenu);
document.querySelector('.sidebar-content[data-for="tree"]').addEventListener("contextmenu", (e) => {
  if (e.target.closest("#file-list")) return; // already handled by file-list listener
  handleSidebarContextMenu(e);
});
document.querySelector('.sidebar-content[data-for="list"]')?.addEventListener("contextmenu", (e) => {
  if (e.target.closest("#file-list-flat")) return;
  handleSidebarContextMenu(e);
});

function showContextMenu(x, y, context) {
  const menuEmpty = document.getElementById("menu-empty");
  const menuFile = document.getElementById("menu-file");
  const menuFolder = document.getElementById("menu-folder");
  menuEmpty.style.display = "none";
  menuFile.style.display = "none";
  if (menuFolder) menuFolder.style.display = "none";
  
  const currentMode = document.querySelector(".sidebar-tab.active")?.dataset.mode;
  const isSearchMode = currentMode === "search";
  
  if (context === "empty") {
    menuEmpty.style.display = "block";
    const listBtn = menuEmpty.querySelector('[data-action="view-list"] .ctx-check');
    const treeBtn = menuEmpty.querySelector('[data-action="view-tree"] .ctx-check');
    const searchBtn = menuEmpty.querySelector('[data-action="search"] .ctx-check');
    if (listBtn) listBtn.textContent = filesViewMode === "list" ? "✓" : "";
    if (treeBtn) treeBtn.textContent = filesViewMode === "tree" ? "✓" : "";
    if (searchBtn) searchBtn.textContent = isSearchMode ? "✓" : "";
  }
  else if (context === "folder" && menuFolder) {
    menuFolder.style.display = "block";
    const listBtn = menuFolder.querySelector('[data-action="view-list"] .ctx-check');
    const treeBtn = menuFolder.querySelector('[data-action="view-tree"] .ctx-check');
    const searchBtn = menuFolder.querySelector('[data-action="search"] .ctx-check');
    if (listBtn) listBtn.textContent = filesViewMode === "list" ? "✓" : "";
    if (treeBtn) treeBtn.textContent = filesViewMode === "tree" ? "✓" : "";
    if (searchBtn) searchBtn.textContent = isSearchMode ? "✓" : "";
  }
  else {
    menuFile.style.display = "block";
    const listBtn = menuFile.querySelector('[data-action="view-list"] .ctx-check');
    const treeBtn = menuFile.querySelector('[data-action="view-tree"] .ctx-check');
    const searchBtn = menuFile.querySelector('[data-action="search"] .ctx-check');
    if (listBtn) listBtn.textContent = filesViewMode === "list" ? "✓" : "";
    if (treeBtn) treeBtn.textContent = filesViewMode === "tree" ? "✓" : "";
    if (searchBtn) searchBtn.textContent = isSearchMode ? "✓" : "";
  }
  contextMenu.classList.remove("hidden");
  const rect = contextMenu.getBoundingClientRect();
  let posX = x, posY = y;
  if (x + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
  if (y + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 10;
  contextMenu.style.left = `${posX}px`;
  contextMenu.style.top = `${posY}px`;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#context-menu")) contextMenu.classList.add("hidden");
});

contextMenu.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  contextMenu.classList.add("hidden");
  const target = contextMenuTarget;
  const isFolder = contextMenuIsFolder;

  async function createFolder(parentPath, suggestedName = "New Folder") {
    // Use native folder dialog in Electron
    if (window.electronAPI?.createNewFolderDialog) {
      // Build the default path: if parentPath is relative, prepend workspace
      let defaultPath = parentPath || "";
      if (defaultPath && workspacePath && !defaultPath.startsWith("/")) {
        defaultPath = workspacePath + "/" + defaultPath;
      } else if (!defaultPath) {
        defaultPath = workspacePath || "";
      }
      const folderPath = await window.electronAPI.createNewFolderDialog(defaultPath);

      if (folderPath) {
        // Convert absolute path to relative path within workspace
        let relativePath = folderPath;
        if (workspacePath && folderPath.startsWith(workspacePath)) {
          relativePath = folderPath.substring(workspacePath.length).replace(/^\//, "");
        }

        if (!relativePath) {
          setStatus("Folder must be inside the workspace", true);
          return;
        }

        // Tell backend to ensure the folder exists
        const r = await fetch(`/folders/${encodeURIComponent(relativePath)}`, { method: "POST" });
        if (r.ok) {
          const folderName = relativePath.split("/").pop();
          expandedFolders.add(relativePath);
          saveExpandedFolders();
          await loadFileList();
          setStatus(`Created folder "${folderName}"`);
        } else {
          setStatus("Failed to create folder", true);
        }
      }
      return;
    }
    
    // Fallback for web mode
    const name = prompt("Folder name:", suggestedName);
    if (!name) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    const r = await fetch(`/folders/${encodeURIComponent(fullPath)}`, { method: "POST" });
    if (r.ok) { loadFileList(); setStatus(`Created folder "${name}"`); }
    else setStatus("Failed to create folder", true);
  }

  switch (action) {
    case "new-file":
    case "new-folder-from-file": {
      if (action === "new-folder-from-file") {
        const parent = target ? target.substring(0, target.lastIndexOf("/")) : "";
        createFolderInline(parent);
        break;
      }

      // Inline file creation in sidebar (like the + button)
      const folder = target && isFolder ? target : (target ? target.substring(0, target.lastIndexOf("/")) : (currentFolder || ""));
      const res = await fetch("/files");
      const { files } = await res.json();
      let counter = 1;
      let fileName = "untitled.md";
      let fullPath = folder ? `${folder}/${fileName}` : fileName;
      const fileList = files.map(f => typeof f === 'string' ? f : f.path);
      while (fileList.includes(fullPath)) {
        fileName = `untitled-${counter}.md`;
        fullPath = folder ? `${folder}/${fileName}` : fileName;
        counter++;
      }

      const r = await fetch(`/files/${encodeURIComponent(fullPath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" })
      });

      if (r.ok) {
        currentFile = fullPath;
        setContent("");
        isDirty = false;
        updateDirtyBadge();
        updateBottomFileName();
        if (folder) {
          expandedFolders.add(folder);
          saveExpandedFolders();
        }
        await loadFileList();

        // Find the file in sidebar and make it editable
        setTimeout(() => {
          const fileEl = document.querySelector(`li.tree-file[data-file-path="${fullPath}"]`);
          if (fileEl) {
            fileEl.scrollIntoView({ behavior: "smooth", block: "center" });
            const nameSpan = fileEl.querySelector(".file-name");
            if (nameSpan) {
              makeFileNameEditable(fileEl, fullPath, fileName);
            }
          }
        }, 100);
      } else {
        setStatus("Failed to create file", true);
      }
      break;
    }
    case "new-file-in-folder": {
      if (!target) break;
      const folder = target.replace(/\/$/, "");

      const res = await fetch("/files");
      const { files } = await res.json();
      const fileList2 = files.map(f => typeof f === 'string' ? f : f.path);
      let counter = 1;
      let fileName = "untitled.md";
      let fullPath = `${folder}/${fileName}`;
      while (fileList2.includes(fullPath)) {
        fileName = `untitled-${counter}.md`;
        fullPath = `${folder}/${fileName}`;
        counter++;
      }

      const r = await fetch(`/files/${encodeURIComponent(fullPath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" })
      });

      if (r.ok) {
        currentFile = fullPath;
        setContent("");
        isDirty = false;
        updateDirtyBadge();
        updateBottomFileName();
        expandedFolders.add(folder);
        saveExpandedFolders();
        await loadFileList();

        setTimeout(() => {
          const fileEl = document.querySelector(`li.tree-file[data-file-path="${fullPath}"]`);
          if (fileEl) {
            fileEl.scrollIntoView({ behavior: "smooth", block: "center" });
            const nameSpan = fileEl.querySelector(".file-name");
            if (nameSpan) {
              makeFileNameEditable(fileEl, fullPath, fileName);
            }
          }
        }, 100);
      } else {
        setStatus("Failed to create file", true);
      }
      break;
    }
    case "new-folder":
    case "new-subfolder": {
      const parent = isFolder && target ? target.replace(/\/$/, "") : "";
      createFolderInline(parent);
      break;
    }
    case "open": {
      if (isFolder) { /* expand folder */ toggleFolderExpand(target); }
      else openFile(target);
      break;
    }
    case "rename": {
      if (isFolder) {
        const old = target.replace(/\/$/, "");
        const newLeaf = prompt("Rename folder:", old.split("/").pop());
        if (!newLeaf || newLeaf === old.split("/").pop()) break;
        const parent = old.includes("/") ? old.substring(0, old.lastIndexOf("/")) : "";
        const newFull = parent ? `${parent}/${newLeaf}` : newLeaf;
        const r = await fetch(`/folders/${encodeURIComponent(old)}?new_name=${encodeURIComponent(newFull)}`, { method: "PUT" });
        if (r.ok) { 
          await loadFileList(); 
          setStatus(`Renamed to "${newLeaf}"`); 
        } else {
          setStatus("Rename failed", true);
        }
      } else {
        const displayName = target.split("/").pop().replace(/\.md$/, "");
        const newLeaf = prompt("Rename note:", displayName);
        if (!newLeaf || newLeaf === displayName) break;
        const r = await fetch(`/files/${encodeURIComponent(target)}`);
        if (!r.ok) { 
          setStatus("Failed to read file", true); 
          break; 
        }
        const { content } = await r.json();
        const parent = target.includes("/") ? target.substring(0, target.lastIndexOf("/")) : "";
        const finalName = newLeaf.endsWith(".md") ? newLeaf : newLeaf + ".md";
        const newFull = parent ? `${parent}/${finalName}` : finalName;
        
        const createRes = await fetch(`/files/${encodeURIComponent(newFull)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
        });
        
        if (!createRes.ok) {
          setStatus("Failed to create renamed file", true);
          break;
        }
        
        await fetch(`/files/${encodeURIComponent(target)}`, { method: "DELETE" });
        
        if (currentFile === target) {
          currentFile = newFull;
          document.getElementById("filename-input").value = finalName;
        }
        
        await loadFileList();
        setStatus(`Renamed to "${finalName}"`);
      }
      break;
    }
    case "duplicate": {
      if (!target) break;
      const r = await fetch(`/files/${encodeURIComponent(target)}`);
      if (!r.ok) break;
      const { content } = await r.json();
      const parent = target.substring(0, target.lastIndexOf("/"));
      const base = target.split("/").pop().replace(/\.md$/, "");
      let copyName, newFull, counter = 0;
      do {
        counter++;
        copyName = counter === 1 ? `${base} copy.md` : `${base} copy ${counter}.md`;
        newFull = parent ? `${parent}/${copyName}` : copyName;
      } while ((await fetch(`/files/${encodeURIComponent(newFull)}`)).ok);
      await fetch(`/files/${encodeURIComponent(newFull)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
      });
      loadFileList();
      setStatus(`Duplicated as "${copyName}"`);
      break;
    }
    case "move": {
      if (!target) break;
      if (isFolder) {
        setStatus("Folder move not yet implemented", true);
        break;
      }
      const dest = prompt("Move to folder (blank for root):", "");
      if (dest === null) break;
      const fileName = target.split("/").pop();
      const newPath = dest.trim() ? `${dest.trim()}/${fileName}` : fileName;
      if (target !== newPath) await moveFile(target, newPath);
      break;
    }
    case "copy-path": {
      const pathTarget = target || currentFile;
      if (!pathTarget) { setStatus("No file selected"); break; }
      const fullCopyPath = workspacePath ? `${workspacePath}/${pathTarget}` : `notes/${pathTarget}`;
      try { await navigator.clipboard.writeText(fullCopyPath); setStatus("Path copied"); }
      catch { prompt("Copy path:", fullCopyPath); }
      break;
    }
    case "reveal": {
      const revealTarget = target || currentFile;
      if (!revealTarget) { setStatus("No file selected"); break; }
      const res = await fetch(`/reveal/${encodeURIComponent(revealTarget)}`, { method: "POST" });
      if (res.ok) {
        setStatus("Opened in file manager");
      } else {
        setStatus("Could not open file manager", true);
      }
      break;
    }
    case "refresh": {
      await loadFileList();
      setStatus("File list refreshed");
      break;
    }
    case "open-in-new-window": {
      if (window.electronAPI?.openInNewWindow) {
        const filePath = target || currentFile;
        if (filePath) {
          const fullPath = workspacePath ? `${workspacePath}/${filePath}` : filePath;
          window.electronAPI.openInNewWindow(fullPath);
          setStatus("Opened in new window");
        }
      } else if (target || currentFile) {
        const filePath = target || currentFile;
        window.open(`${window.location.origin}?file=${encodeURIComponent(filePath)}`, "_blank");
      }
      break;
    }
    case "search": {
      switchSidebarMode("search");
      setTimeout(() => {
        triggerSearchPanel();
      }, 100);
      break;
    }
    case "view-list": {
      if (filesViewMode !== "list") {
        filesViewMode = "list";
        populateFileList();
        document.querySelectorAll(".sidebar-content").forEach(panel => {
          if (panel.dataset.for === "tree" || panel.dataset.for === "list") {
            panel.style.display = panel.dataset.for === filesViewMode ? "" : "none";
          }
        });
        updateViewToggleIcon();
      }
      break;
    }
    case "view-tree": {
      if (filesViewMode !== "tree") {
        filesViewMode = "tree";
        document.querySelectorAll(".sidebar-content").forEach(panel => {
          if (panel.dataset.for === "tree" || panel.dataset.for === "list") {
            panel.style.display = panel.dataset.for === filesViewMode ? "" : "none";
          }
        });
        updateViewToggleIcon();
      }
      break;
    }
    case "copy": {
      if (!target) break;
      clipboardOperation = { operation: 'copy', path: target, isFolder: isFolder };
      setStatus(isFolder ? "Folder copied" : "File copied");
      break;
    }
    case "cut": {
      if (!target) break;
      clipboardOperation = { operation: 'cut', path: target, isFolder: isFolder };
      setStatus(isFolder ? "Folder cut" : "File cut");
      break;
    }
    case "paste": {
      if (!clipboardOperation) break;
      const { operation, path: srcPath, isFolder: srcIsFolder } = clipboardOperation;
      const destFolder = isFolder && target ? target : (target ? target.substring(0, target.lastIndexOf("/")) : "");
      const srcName = srcPath.split("/").pop().replace(/\/$/, "");
      const destPath = destFolder ? `${destFolder}/${srcName}` : srcName;
      
      try {
        if (srcIsFolder) {
          setStatus("Folder copy/move not yet implemented", true);
          break;
        }
        
        if (operation === 'copy') {
          const r = await fetch(`/files/${encodeURIComponent(srcPath)}`);
          if (r.ok) {
            const { content } = await r.json();
            const createRes = await fetch(`/files/${encodeURIComponent(destPath)}`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
            });
            if (createRes.ok) {
              setStatus(`Copied to "${destPath}"`);
              loadFileList();
            } else {
              setStatus("Failed to copy file", true);
            }
          } else {
            setStatus("Failed to read source file", true);
          }
        } else if (operation === 'cut') {
          if (srcPath !== destPath) {
            await moveFile(srcPath, destPath);
          }
        }
      } catch (e) {
        setStatus("Paste failed: " + e.message, true);
      }
      clipboardOperation = null;
      break;
    }
    case "delete": {
      if (isFolder) {
        const leaf = target.replace(/\/$/, "").split("/").pop();
        if (!confirm(`Delete folder "${leaf}" and all contents?`)) break;
        const r = await fetch(`/files/${encodeURIComponent(target)}`, { method: "DELETE" });
        if (r.ok) { loadFileList(); setStatus(`Deleted "${leaf}"`); }
      } else {
        const leaf = target.split("/").pop();
        if (!confirm(`Delete "${leaf}"?`)) break;
        await fetch(`/files/${encodeURIComponent(target)}`, { method: "DELETE" });
        if (currentFile === target) {
          setContent(""); currentFile = "untitled.md";
          document.getElementById("filename-input").value = "untitled.md";
        }
        loadFileList();
        setStatus(`Deleted "${leaf}"`);
      }
      break;
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
let searchDebounce = null;
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.classList.add("hidden");
    searchResults.innerHTML = "";
    return;
  }
  searchDebounce = setTimeout(async () => {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
    const { results } = await res.json();
    searchResults.innerHTML = "";
    searchResults.classList.remove("hidden");
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "no-results";
      li.textContent = "No results";
      searchResults.appendChild(li);
      return;
    }
    results.forEach(({ name, snippet }) => {
      const li = document.createElement("li");
      const title = document.createElement("div");
      title.className = "sr-title";
      title.textContent = name;
      const snip = document.createElement("div");
      snip.className = "sr-snippet";
      snip.textContent = snippet;
      li.appendChild(title);
      li.appendChild(snip);
      li.addEventListener("click", () => {
        openFile(name);
        searchInput.value = "";
        searchResults.classList.add("hidden");
      });
      searchResults.appendChild(li);
    });
  }, 250);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH PANEL (sidebar search mode)
// ═══════════════════════════════════════════════════════════════════════════════
let searchPanelDebounce = null;
const searchPanelInput = document.getElementById("search-panel-input");
const searchPanelResults = document.getElementById("search-panel-results");
const searchPanelEmpty = document.getElementById("search-panel-empty");

searchPanelInput?.addEventListener("input", () => {
  clearTimeout(searchPanelDebounce);
  const q = searchPanelInput.value.trim();
  if (!q) {
    searchPanelResults.innerHTML = "";
    searchPanelEmpty.style.display = "none";
    return;
  }
  searchPanelDebounce = setTimeout(async () => {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
    const { results } = await res.json();
    searchPanelResults.innerHTML = "";
    
    if (!results.length) {
      searchPanelEmpty.style.display = "block";
      return;
    }
    
    searchPanelEmpty.style.display = "none";
    results.forEach(({ name, snippet }) => {
      const li = document.createElement("li");
      
      const fileDiv = document.createElement("div");
      fileDiv.className = "search-result-file";
      fileDiv.textContent = name;
      
      const snippetDiv = document.createElement("div");
      snippetDiv.className = "search-result-snippet";
      // Highlight the search term in snippet
      const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const highlighted = snippet.replace(regex, '<span class="search-result-match">$1</span>');
      snippetDiv.innerHTML = highlighted;
      
      li.appendChild(fileDiv);
      li.appendChild(snippetDiv);
      li.addEventListener("click", () => openFile(name));
      searchPanelResults.appendChild(li);
    });
  }, 300);
});

// Trigger search panel to load all files initially
function triggerSearchPanel() {
  if (!searchPanelInput) return;
  const q = searchPanelInput.value.trim();
  if (q) {
    // If there's already a search term, trigger search
    searchPanelInput.dispatchEvent(new Event('input'));
  } else {
    // Load all files by searching for empty string or common character
    searchPanelInput.value = " ";
    searchPanelInput.dispatchEvent(new Event('input'));
    setTimeout(() => {
      searchPanelInput.value = "";
      searchPanelInput.focus();
    }, 100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
document.getElementById("btn-import")?.addEventListener("click", () => { closeAllMenus(); document.getElementById("file-input").click(); });
document.getElementById("btn-open-file")?.addEventListener("click", () => { closeAllMenus(); document.getElementById("file-input").click(); });

document.getElementById("file-input").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  setStatus(`Importing ${file.name}…`);
  const res = await fetch("/import", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus(err.detail || "Import failed", true);
    return;
  }
  const { content } = await res.json();
  
  const stem = file.name.replace(/\.[^.]+$/, "");
  const fileName = stem + ".md";
  const folder = currentFolder || "";
  const fullPath = folder ? `${folder}/${fileName}` : fileName;
  
  // Save the imported content
  const saveRes = await fetch(`/files/${encodeURIComponent(fullPath)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  
  if (saveRes.ok) {
    currentFile = fullPath;
    document.getElementById("filename-input").value = fileName;
    setContent(content);
    await loadFileList();
    setStatus(`Imported ${file.name}`);
  } else {
    setStatus("Failed to save imported file", true);
  }
  e.target.value = "";
});

document.getElementById("image-input").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/upload/image", { method: "POST", body: form });
  if (!res.ok) { setStatus("Image upload failed", true); return; }
  const { url } = await res.json();
  insertBlock(`![${file.name.replace(/\.[^.]+$/, "")}](${url})`);
  setStatus(`Image inserted`);
  e.target.value = "";
});

document.getElementById("btn-dl-md")?.addEventListener("click", async () => {
  closeAllMenus();
  await saveFile(true);
  const a = document.createElement("a");
  a.href = `/download/md/${encodeURIComponent(currentFile)}`;
  a.download = currentFile;
  a.click();
});

document.getElementById("btn-export-html")?.addEventListener("click", async () => {
  closeAllMenus();
  setStatus("Exporting HTML…");
  const html = document.getElementById("preview").innerHTML;
  const res = await fetch(`/export/html/${encodeURIComponent(currentFile)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) { setStatus("HTML export failed", true); return; }
  downloadBlob(await res.blob(), currentFile.replace(/\.md$/, ".html"));
  setStatus("HTML exported");
});

document.getElementById("btn-export-pdf")?.addEventListener("click", async () => {
  closeAllMenus();
  setStatus("Exporting PDF…");
  const html = document.getElementById("preview").innerHTML;
  const res = await fetch(`/export/pdf/${encodeURIComponent(currentFile)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if ((err.detail || "").includes("501")) { 
      setStatus("PDF export not available, opening print dialog…");
      printPreview(); 
      return; 
    }
    setStatus(err.detail || "PDF export failed", true);
    return;
  }
  downloadBlob(await res.blob(), currentFile.replace(/\.md$/, ".pdf"));
  setStatus("PDF exported");
});

document.getElementById("btn-print")?.addEventListener("click", () => { closeAllMenus(); printPreview(); });

function printPreview() {
  const html = document.getElementById("preview").innerHTML;
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Georgia,serif;max-width:800px;margin:2rem auto;line-height:1.6}pre{background:#f4f4f4;padding:1rem;border-radius:4px}code{background:#f4f4f4;padding:.2em .4em;border-radius:3px}blockquote{border-left:4px solid #ccc;margin:0;padding-left:1rem;color:#555}img{max-width:100%}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("btn-save-as")?.addEventListener("click", () => { closeAllMenus(); saveAs(); });

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function buildTableGrid(rows, cols) {
  const grid = document.getElementById("table-grid");
  grid.style.gridTemplateColumns = `repeat(${cols}, 36px)`;
  grid.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "tbl-cell" + (r === 0 ? " tbl-header" : "");
      grid.appendChild(cell);
    }
  }
}

function openTableModal() {
  document.getElementById("table-overlay").classList.remove("hidden");
  buildTableGrid(parseInt(document.getElementById("tbl-rows").value) || 3, parseInt(document.getElementById("tbl-cols").value) || 3);
}

["tbl-rows", "tbl-cols"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    buildTableGrid(parseInt(document.getElementById("tbl-rows").value) || 1, parseInt(document.getElementById("tbl-cols").value) || 1);
  });
});

document.getElementById("btn-cancel-table").addEventListener("click", () => document.getElementById("table-overlay").classList.add("hidden"));

document.getElementById("btn-insert-table").addEventListener("click", () => {
  const rows = Math.max(1, parseInt(document.getElementById("tbl-rows").value) || 3);
  const cols = Math.max(1, parseInt(document.getElementById("tbl-cols").value) || 3);
  const colWidth = 15;
  const pad = (text) => text.padEnd(colWidth, " ");
  const header = "| " + Array(cols).fill("Header").map((h, i) => pad(`${h} ${i + 1}`)).join(" | ") + " |";
  const sep = "| " + Array(cols).fill("-".repeat(colWidth)).join(" | ") + " |";
  const row = "| " + Array(cols).fill(pad("Cell")).join(" | ") + " |";
  const dataRows = Array(rows - 1).fill(row);
  insertSnippet([header, sep, ...dataRows].join("\n"));
  document.getElementById("table-overlay").classList.add("hidden");
});

document.getElementById("table-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("table-overlay")) document.getElementById("table-overlay").classList.add("hidden");
});

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const DIAGRAM_SNIPPETS = {
  "econ-supply-demand": "```econ\nsupply-demand\n```",
  "econ-ppf": "```econ\nppf\n```",
  "econ-cost": "```econ\ncost\n```",
  "econ-custom": "```econ\ntitle: My Graph\nxlabel: Quantity\nylabel: Price\nxmax: 10\nymax: 10\ncurve: Demand, [(0,9),(5,5),(10,1)], solid, #3b82f6\ncurve: Supply, [(0,1),(5,5),(10,9)], solid, #ef4444\npoint: Equilibrium, (5,5)\n```",
  flowchart: "```mermaid\nflowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Do something]\n    B -->|No| D[Something else]\n    C --> E[End]\n    D --> E\n```",
  sequence: "```mermaid\nsequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello!\n    B-->>A: Hi!\n```",
  gantt: "```mermaid\ngantt\n    title Plan\n    dateFormat YYYY-MM-DD\n    section Phase 1\n    Task A :a1, 2024-01-01, 7d\n    Task B :after a1, 5d\n```",
  pie: "```mermaid\npie title Distribution\n    \"A\" : 40\n    \"B\" : 35\n    \"C\" : 25\n```",
  er: "```mermaid\nerDiagram\n    STUDENT ||--o{ ENROLLMENT : enrolls\n    COURSE ||--o{ ENROLLMENT : includes\n```",
  mindmap: "```mermaid\nmindmap\n  root((Topic))\n    Branch 1\n      Detail\n    Branch 2\n```",
};

function openDiagramModal() {
  document.getElementById("diagram-overlay").classList.remove("hidden");
}

document.getElementById("diagram-overlay").querySelectorAll(".diagram-type").forEach(btn => {
  btn.addEventListener("click", () => {
    insertSnippet(DIAGRAM_SNIPPETS[btn.dataset.type] || "");
    document.getElementById("diagram-overlay").classList.add("hidden");
  });
});

document.getElementById("btn-cancel-diagram").addEventListener("click", () => document.getElementById("diagram-overlay").classList.add("hidden"));
document.getElementById("diagram-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("diagram-overlay")) document.getElementById("diagram-overlay").classList.add("hidden");
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
let graphCanvasInstance = null;
let graphEditInfo = null;

function openGraphCanvas(existingData = null, editOffset = null, editLength = null) {
  const overlay = document.getElementById("graph-overlay");
  overlay.classList.remove("hidden");
  const svgEl = document.getElementById("graph-svg");
  svgEl.innerHTML = "";
  graphCanvasInstance = new GraphCanvas(svgEl);
  graphEditInfo = editOffset !== null ? { offset: editOffset, length: editLength } : null;
  if (existingData) graphCanvasInstance.fromJSON(existingData);
  document.getElementById("gc-title").value = graphCanvasInstance.title || "";
  document.getElementById("gc-x-label").value = graphCanvasInstance.xLabel || "";
  document.getElementById("gc-y-label").value = graphCanvasInstance.yLabel || "";
  document.querySelectorAll("#graph-toolbar .gc-tool").forEach(b => {
    b.classList.toggle("active", b.dataset.tool === graphCanvasInstance.tool);
  });
}

function closeGraphCanvas() {
  document.getElementById("graph-overlay").classList.add("hidden");
  graphCanvasInstance = null;
  graphEditInfo = null;
}

document.querySelectorAll("#graph-toolbar .gc-tool").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!graphCanvasInstance) return;
    const clickedTool = btn.dataset.tool;
    // Toggle: clicking the active tool deselects it (returns to select mode)
    if (graphCanvasInstance.tool === clickedTool && clickedTool !== "select") {
      graphCanvasInstance.tool = "select";
    } else {
      graphCanvasInstance.tool = clickedTool;
    }
    document.querySelectorAll("#graph-toolbar .gc-tool").forEach(b => {
      b.classList.toggle("active", b.dataset.tool === graphCanvasInstance.tool);
    });
  });
});

document.getElementById("gc-grid").addEventListener("change", e => { if (graphCanvasInstance) { graphCanvasInstance.showGrid = e.target.checked; graphCanvasInstance.render(); } });
document.getElementById("gc-snap").addEventListener("change", e => { if (graphCanvasInstance) graphCanvasInstance.snapToGrid = e.target.checked; });
document.getElementById("gc-color").addEventListener("input", e => { if (graphCanvasInstance) graphCanvasInstance.strokeColor = e.target.value; });
document.getElementById("gc-width").addEventListener("change", e => { if (graphCanvasInstance) graphCanvasInstance.strokeWidth = parseFloat(e.target.value); });
document.getElementById("gc-title").addEventListener("input", e => { if (graphCanvasInstance) { graphCanvasInstance.title = e.target.value; graphCanvasInstance.render(); } });
document.getElementById("gc-x-label").addEventListener("input", e => { if (graphCanvasInstance) { graphCanvasInstance.xLabel = e.target.value; graphCanvasInstance.render(); } });
document.getElementById("gc-y-label").addEventListener("input", e => { if (graphCanvasInstance) { graphCanvasInstance.yLabel = e.target.value; graphCanvasInstance.render(); } });
document.getElementById("gc-undo").addEventListener("click", () => graphCanvasInstance?.undo());
document.getElementById("gc-redo").addEventListener("click", () => graphCanvasInstance?.redo());
document.getElementById("gc-delete").addEventListener("click", () => graphCanvasInstance?.deleteSelected());
document.getElementById("gc-clear").addEventListener("click", () => { if (graphCanvasInstance && confirm("Clear all?")) graphCanvasInstance.clear(); });

document.getElementById("graph-overlay").addEventListener("keydown", e => {
  if (!graphCanvasInstance) return;
  const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
  if (e.key === "Escape") {
    if (inInput) { e.target.blur(); e.preventDefault(); return; }
    if (graphCanvasInstance._curvePoints?.length > 0) graphCanvasInstance.cancelCurve();
    else closeGraphCanvas();
    e.preventDefault();
    return;
  }
  if (inInput) return;
  if (e.key === "Delete" || e.key === "Backspace") { graphCanvasInstance.deleteSelected(); e.preventDefault(); }
  if (e.ctrlKey && e.key === "z") { graphCanvasInstance.undo(); e.preventDefault(); }
  if (e.ctrlKey && e.key === "y") { graphCanvasInstance.redo(); e.preventDefault(); }
  const step = e.shiftKey ? graphCanvasInstance.gridSize : (graphCanvasInstance.snapToGrid ? graphCanvasInstance.gridSize : 5);
  if (e.key === "ArrowLeft") { graphCanvasInstance.nudge(-step, 0); e.preventDefault(); }
  if (e.key === "ArrowRight") { graphCanvasInstance.nudge(step, 0); e.preventDefault(); }
  if (e.key === "ArrowUp") { graphCanvasInstance.nudge(0, -step); e.preventDefault(); }
  if (e.key === "ArrowDown") { graphCanvasInstance.nudge(0, step); e.preventDefault(); }
  if (e.ctrlKey && e.key === "c") { graphCanvasInstance.copySelected(); e.preventDefault(); }
  if (e.ctrlKey && e.key === "v") { graphCanvasInstance.paste(); e.preventDefault(); }
  if (e.ctrlKey && e.key === "d") { graphCanvasInstance.duplicateSelected(); e.preventDefault(); }
});

document.getElementById("gc-cancel").addEventListener("click", closeGraphCanvas);
document.getElementById("graph-overlay").addEventListener("click", e => { if (e.target === document.getElementById("graph-overlay")) closeGraphCanvas(); });

document.getElementById("gc-save").addEventListener("click", () => {
  if (!graphCanvasInstance) return;
  const json = graphCanvasInstance.toJSON();
  const mdSnippet = "```graph\n" + JSON.stringify(json) + "\n```";
  if (graphEditInfo) {
    view.dispatch({ changes: { from: graphEditInfo.offset, to: graphEditInfo.offset + graphEditInfo.length, insert: mdSnippet } });
  } else {
    insertSnippet(mdSnippet);
  }
  closeGraphCanvas();
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR CONTEXT MENU
// ═══════════════════════════════════════════════════════════════════════════════
const editorCtxMenu = document.getElementById("editor-ctx-menu");

document.getElementById("cm-editor").addEventListener("contextmenu", e => {
  e.preventDefault();
  editorCtxMenu.classList.remove("hidden");
  let x = e.clientX, y = e.clientY;
  editorCtxMenu.style.left = "-9999px";
  editorCtxMenu.style.top = "-9999px";
  const rect = editorCtxMenu.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  editorCtxMenu.style.left = `${x}px`;
  editorCtxMenu.style.top = `${y}px`;
});

document.addEventListener("click", e => {
  if (!e.target.closest("#editor-ctx-menu")) editorCtxMenu.classList.add("hidden");
});

editorCtxMenu.addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  editorCtxMenu.classList.add("hidden");
  if (ACTIONS[btn.dataset.action]) ACTIONS[btn.dataset.action]();
});

// Toggle search panel from context menu
document.getElementById("ctx-toggle-search")?.addEventListener("click", () => {
  editorCtxMenu.classList.add("hidden");
  const currentMode = document.querySelector(".sidebar-tab.active")?.dataset.mode;
  const searchCheck = document.getElementById("ctx-search-check");
  
  if (currentMode === "search") {
    // Switch back to outline
    switchSidebarMode("outline");
    searchCheck.style.display = "none";
  } else {
    // Switch to search
    switchSidebarMode("search");
    searchCheck.style.display = "inline";
    setTimeout(() => triggerSearchPanel(), 100);
  }
});

// Update check mark when sidebar mode changes
function updateSearchCheckMark() {
  const currentMode = document.querySelector(".sidebar-tab.active")?.dataset.mode;
  const searchCheck = document.getElementById("ctx-search-check");
  if (searchCheck) {
    searchCheck.style.display = currentMode === "search" ? "inline" : "none";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLISH
// ═══════════════════════════════════════════════════════════════════════════════
document.getElementById("btn-publish")?.addEventListener("click", () => {
  closeAllMenus();
  document.getElementById("publish-overlay").classList.remove("hidden");
});
document.getElementById("btn-cancel-publish")?.addEventListener("click", () => document.getElementById("publish-overlay").classList.add("hidden"));
document.getElementById("btn-confirm-publish")?.addEventListener("click", async () => {
  document.getElementById("publish-overlay").classList.add("hidden");
  setStatus("Publishing…");
  const res = await fetch("/publish", { method: "POST" });
  const data = await res.json();
  if (res.ok) {
    let msg = `Published ${data.published} notes`;
    if (data.results?.github) msg += ` • GitHub: ${data.results.github}`;
    if (data.results?.gdrive) msg += ` • Drive: ${data.results.gdrive}`;
    setStatus(msg);
  } else {
    setStatus(data.detail || "Publish failed", true);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
async function openSettings() {
  closeAllMenus();
  
  // Load preferences from localStorage
  const prefs = JSON.parse(localStorage.getItem("lectura-prefs") || "{}");
  
  // Files
  document.getElementById("cfg-on-launch").value = prefs.onLaunch || "new";
  document.getElementById("cfg-record-recent").checked = prefs.recordRecent !== false;
  
  // Editor
  document.getElementById("cfg-indent").value = prefs.indent || "auto";
  document.getElementById("cfg-autopair-brackets").checked = prefs.autopairBrackets !== false;
  document.getElementById("cfg-autopair-markdown").checked = prefs.autopairMarkdown !== false;
  document.getElementById("cfg-line-ending").value = prefs.lineEnding || "lf";
  document.getElementById("cfg-spell-check").value = prefs.spellCheck || "auto";
  
  // Export
  document.getElementById("cfg-export-folder").value = prefs.exportFolder || "auto";
  document.getElementById("cfg-pandoc-path").value = prefs.pandocPath || "auto";
  
  // Appearance
  document.getElementById("cfg-theme").value = currentTheme;
  document.getElementById("cfg-font-size").value = prefs.fontSize || "auto";

  document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("btn-settings")?.addEventListener("click", () => openSettings());
document.getElementById("btn-close-modal")?.addEventListener("click", () => document.getElementById("modal-overlay").classList.add("hidden"));
document.getElementById("btn-open-theme-folder")?.addEventListener("click", async () => {
  await fetch("/themes/open-folder", { method: "POST" });
});

document.getElementById("btn-save-config")?.addEventListener("click", async () => {
  // Collect all preferences
  const prefs = {
    // Files
    onLaunch: document.getElementById("cfg-on-launch").value,
    recordRecent: document.getElementById("cfg-record-recent").checked,
    
    // Editor
    indent: document.getElementById("cfg-indent").value,
    autopairBrackets: document.getElementById("cfg-autopair-brackets").checked,
    autopairMarkdown: document.getElementById("cfg-autopair-markdown").checked,
    lineEnding: document.getElementById("cfg-line-ending").value,
    spellCheck: document.getElementById("cfg-spell-check").value,
    
    // Export
    exportFolder: document.getElementById("cfg-export-folder").value,
    pandocPath: document.getElementById("cfg-pandoc-path").value,
    
    // Appearance
    fontSize: document.getElementById("cfg-font-size").value,
  };
  
  // Save to localStorage
  localStorage.setItem("lectura-prefs", JSON.stringify(prefs));
  
  // Apply theme change
  const selectedTheme = document.getElementById("cfg-theme").value;
  if (selectedTheme !== currentTheme) {
    await applyTheme(selectedTheme);
  }
  
  // Apply font size
  if (prefs.fontSize !== "auto") {
    document.documentElement.style.setProperty("--editor-font-size", prefs.fontSize + "px");
    document.documentElement.style.setProperty("--preview-font-size", prefs.fontSize + "px");
  } else {
    document.documentElement.style.removeProperty("--editor-font-size");
    document.documentElement.style.removeProperty("--preview-font-size");
  }
  
  setStatus("Settings saved");
  document.getElementById("modal-overlay").classList.add("hidden");
});

document.getElementById("modal-overlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden"); });
document.getElementById("publish-overlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden"); });

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════
const previewPane = document.getElementById("preview-pane");
const editorPane = document.getElementById("editor-pane");
const previewEditorHandle = document.getElementById("preview-editor-resize-handle");
let viewMode = 2; // 0: both, 1: reader only, 2: editor only (default)

function switchToEditorView() {
  if (viewMode !== 2) {
    viewMode = 1;
    togglePreview();
  }
}

function togglePreview() {
  viewMode = (viewMode + 1) % 3;
  
  const toggleBtn = document.getElementById("btn-toggle-preview");
  
  if (viewMode === 0) { // both visible
    previewPane.classList.remove("hidden-pane");
    editorPane.classList.remove("hidden-pane");
    previewEditorHandle.classList.remove("hidden-pane");
    if (toggleBtn) toggleBtn.textContent = "Toggle Render";
  } else if (viewMode === 1) { // reader only
    previewPane.classList.remove("hidden-pane");
    editorPane.classList.add("hidden-pane");
    previewEditorHandle.classList.add("hidden-pane");
    if (toggleBtn) toggleBtn.textContent = "Render View (Reader)";
    // Add click-to-edit hint
    previewPane.style.cursor = "text";
  } else { // editor only
    previewPane.classList.add("hidden-pane");
    editorPane.classList.remove("hidden-pane");
    previewEditorHandle.classList.add("hidden-pane");
    if (toggleBtn) toggleBtn.textContent = "Editor View";
    previewPane.style.cursor = "default";
    // Focus editor when switching to editor mode
    view.focus();
    // Auto-activate INSERT mode if Vim is enabled
    if (vimEnabled) {
      setTimeout(() => {
        try {
          Vim.handleKey(view.contentDOM, 'i');
        } catch (e) {}
      }, 50);
    }
  }
  
  // Hide/show Vim indicator based on editor visibility
  const vimIndicator = document.getElementById("vim-mode-indicator");
  if (vimIndicator) {
    vimIndicator.classList.toggle("hidden", viewMode === 1);
  }
}

// Click on preview to switch to editor (Notion-style)
document.getElementById("preview").addEventListener("click", (e) => {
  // Only switch if in reader-only mode and not clicking on interactive elements
  if (viewMode === 1 && !e.target.closest("a, button, .flashcard-flip")) {
    viewMode = 2; // Switch to editor only
    togglePreview();
    togglePreview(); // Call twice to get to editor mode
    // Focus editor after a short delay
    setTimeout(() => view.focus(), 100);
  }
});

// Preview-Editor resize functionality
let isResizingPreviewEditor = false;

previewEditorHandle.addEventListener("mousedown", (e) => {
  isResizingPreviewEditor = true;
  document.body.style.cursor = "col-resize";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isResizingPreviewEditor) return;
  
  const main = document.getElementById("main");
  const sidebar = document.getElementById("sidebar");
  const rect = main.getBoundingClientRect();
  const sidebarWidth = sidebar.offsetWidth;
  
  // Calculate position relative to main area (excluding sidebar)
  const x = e.clientX - rect.left - sidebarWidth;
  const mainWidth = rect.width - sidebarWidth;
  
  // Set minimum widths (30% each)
  const minWidth = mainWidth * 0.3;
  const maxWidth = mainWidth * 0.7;
  
  if (x >= minWidth && x <= maxWidth) {
    const editorWidth = (x / mainWidth) * 100;
    const previewWidth = 100 - editorWidth;
    
    editorPane.style.flex = `0 0 ${editorWidth}%`;
    previewPane.style.flex = `0 0 ${previewWidth}%`;
  }
});

document.addEventListener("mouseup", () => {
  if (isResizingPreviewEditor) {
    isResizingPreviewEditor = false;
    document.body.style.cursor = "";
  }
});

document.getElementById("btn-toggle-preview")?.addEventListener("click", () => { closeAllMenus(); togglePreview(); });
document.getElementById("btn-toggle-source")?.addEventListener("click", () => { closeAllMenus(); togglePreview(); });

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // F7 to toggle preview
  if (e.key === 'F7') {
    e.preventDefault();
    e.stopPropagation();
    togglePreview();
    return;
  }
  
  // "I" key to toggle between reader and editor modes (only when not typing)
  if (e.key === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    const target = e.target;
    
    // Skip if in input fields
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Skip if typing in editor
    if (target.classList && target.classList.contains('cm-content')) {
      return;
    }
    
    // Only trigger in reader mode or when editor is not focused
    if (viewMode === 1 || (viewMode === 2 && !document.querySelector('.cm-focused'))) {
      e.preventDefault();
      e.stopPropagation();
      
      if (viewMode === 1) {
        // Reader to editor
        viewMode = 0;
        togglePreview();
        setTimeout(() => view.focus(), 100);
      } else if (viewMode === 2) {
        // Editor to reader
        viewMode = 1;
        togglePreview();
      }
    }
  }
}, true);

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS MODE
// ═══════════════════════════════════════════════════════════════════════════════
let focusModeActive = false;
let paragraphFocusActive = false;

function toggleFocusMode() {
  focusModeActive = !focusModeActive;
  document.body.classList.toggle("focus-mode", focusModeActive);
  
  if (focusModeActive) {
    localStorage.setItem("sc-focus-mode", "true");
    enableParagraphFocus();
  } else {
    localStorage.removeItem("sc-focus-mode");
    disableParagraphFocus();
  }
}

function enableParagraphFocus() {
  paragraphFocusActive = true;
  view.dom.addEventListener('click', handleParagraphClick);
  view.dom.addEventListener('keyup', handleParagraphKeyup);
}

function disableParagraphFocus() {
  paragraphFocusActive = false;
  view.dom.removeEventListener('click', handleParagraphClick);
  view.dom.removeEventListener('keyup', handleParagraphKeyup);
  clearParagraphFocus();
}

function handleParagraphClick(e) {
  if (!paragraphFocusActive) return;
  updateParagraphFocus();
}

function handleParagraphKeyup(e) {
  if (!paragraphFocusActive) return;
  updateParagraphFocus();
}

function updateParagraphFocus() {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  
  // Find paragraph boundaries (empty lines)
  let startLine = line.number;
  let endLine = line.number;
  
  // Find start of paragraph
  while (startLine > 1) {
    const prevLine = view.state.doc.line(startLine - 1);
    if (prevLine.text.trim() === '') break;
    startLine--;
  }
  
  // Find end of paragraph
  while (endLine < view.state.doc.lines) {
    const nextLine = view.state.doc.line(endLine + 1);
    if (nextLine.text.trim() === '') break;
    endLine++;
  }
  
  const startPos = view.state.doc.line(startLine).from;
  const endPos = view.state.doc.line(endLine).to;
  
  applyParagraphFocus(startPos, endPos);
}

function applyParagraphFocus(start, end) {
  // Remove existing focus
  clearParagraphFocus();
  
  // Add dimming class to all lines
  const lines = view.dom.querySelectorAll('.cm-line');
  lines.forEach(line => line.classList.add('cm-line-dimmed'));
  
  // Remove dimming from focused paragraph
  const startLine = view.state.doc.lineAt(start).number;
  const endLine = view.state.doc.lineAt(end).number;
  
  for (let i = startLine; i <= endLine; i++) {
    const lineEl = view.domAtPos(view.state.doc.line(i).from);
    if (lineEl && lineEl.node) {
      const lineNode = lineEl.node.nodeType === 1 ? lineEl.node : lineEl.node.parentElement;
      if (lineNode && lineNode.classList.contains('cm-line')) {
        lineNode.classList.remove('cm-line-dimmed');
      }
    }
  }
}

function clearParagraphFocus() {
  const lines = view.dom.querySelectorAll('.cm-line-dimmed');
  lines.forEach(line => line.classList.remove('cm-line-dimmed'));
}

document.getElementById("btn-focus")?.addEventListener("click", () => { closeAllMenus(); toggleFocusMode(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "F8" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    toggleFocusMode();
  }
});

// Click exit focus pseudo-element
document.addEventListener("click", (e) => {
  if (document.body.classList.contains("focus-mode") && e.clientX > window.innerWidth - 130 && e.clientY < 40) {
    toggleFocusMode();
  }
});

if (localStorage.getItem("sc-focus-mode") === "true") toggleFocusMode();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPEWRITER MODE
// ═══════════════════════════════════════════════════════════════════════════════
let typewriterMode = localStorage.getItem("sc-typewriter") === "true";

function toggleTypewriter() {
  typewriterMode = !typewriterMode;
  document.body.classList.toggle("typewriter-mode", typewriterMode);
  localStorage.setItem("sc-typewriter", String(typewriterMode));
  setStatus(typewriterMode ? "Typewriter mode on" : "Typewriter mode off");
}

document.getElementById("btn-typewriter")?.addEventListener("click", () => { closeAllMenus(); toggleTypewriter(); });
if (typewriterMode) document.body.classList.add("typewriter-mode");

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
let githubToken = sessionStorage.getItem('github-token');
let githubUser = null;
let currentRepo = null;

// GitHub OAuth flow
document.getElementById('btn-github-signin')?.addEventListener('click', async () => {
  try {
    // Fetch client ID from the backend (configured via GITHUB_CLIENT_ID env var)
    const idRes = await fetch('/auth/github/client-id');
    if (!idRes.ok) {
      setStatus('GitHub OAuth not configured — set GITHUB_CLIENT_ID env var', true);
      return;
    }
    const { client_id: CLIENT_ID } = await idRes.json();
    const REDIRECT_URI = `${window.location.origin}/auth/github/callback`;
    const SCOPE = 'repo,user:email';

    // Generate state for security
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('github-oauth-state', state);

    // Build OAuth URL
    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(SCOPE)}&` +
      `state=${state}`;
    
    // Open popup window (like Zed does)
    const popup = window.open(
      authUrl,
      'github-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );
    
    // Listen for OAuth callback
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'github-auth-success') {
        popup.close();
        window.removeEventListener('message', handleMessage);
        await handleGitHubCallback(event.data.code, event.data.state);
      } else if (event.data.type === 'github-auth-error') {
        popup.close();
        window.removeEventListener('message', handleMessage);
        setStatus('GitHub authentication failed', true);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Handle popup closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
      }
    }, 1000);
    
  } catch (error) {
    setStatus('GitHub signin failed', true);
  }
});

// Google Drive sign-in
document.getElementById('btn-gdrive-signin')?.addEventListener('click', () => {
  const popup = window.open("/gdrive/auth", "_blank", "width=600,height=700");
  // Poll for popup close, then refresh gdrive status
  if (popup) {
    const check = setInterval(() => {
      if (popup.closed) {
        clearInterval(check);
        checkGdriveStatus();
      }
    }, 1000);
  }
});

// Google Drive: check connection status and load files
async function checkGdriveStatus() {
  const authSection = document.getElementById("gdrive-auth");
  const filesSection = document.getElementById("gdrive-files");
  if (!authSection || !filesSection) return;
  try {
    const res = await fetch("/gdrive/status");
    if (!res.ok) {
      // Server error — show sign-in button as fallback
      authSection.classList.remove("hidden");
      filesSection.classList.add("hidden");
      return;
    }
    const { connected } = await res.json();
    if (connected) {
      authSection.classList.add("hidden");
      filesSection.classList.remove("hidden");
      loadGdriveFiles();
    } else {
      authSection.classList.remove("hidden");
      filesSection.classList.add("hidden");
    }
  } catch (_) {
    // Network error — show sign-in button
    authSection.classList.remove("hidden");
    filesSection.classList.add("hidden");
  }
}

async function loadGdriveFiles() {
  const list = document.getElementById("gdrive-file-list");
  list.innerHTML = "<li class='loading'>Loading…</li>";
  try {
    const res = await fetch("/gdrive/files");
    list.innerHTML = "";
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      list.innerHTML = `<li class="no-results">${err.detail || "Error loading files"}</li>`;
      return;
    }
    const { files } = await res.json();
    if (!files.length) {
      list.innerHTML = "<li class='no-results'>No .md files found</li>";
      return;
    }
    files.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      li.className = "file-item";
      li.addEventListener("click", async () => {
        const r = await fetch(`/gdrive/open/${encodeURIComponent(name)}`);
        if (!r.ok) { setStatus("Failed to open", true); return; }
        const { content } = await r.json();
        setContent(content);
        document.getElementById("filename-input").value = name;
        currentFile = name;
        setStatus(`Opened ${name} from Google Drive`);
      });
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = "<li class='no-results'>Failed to connect</li>";
  }
}

document.getElementById("btn-gdrive-refresh")?.addEventListener("click", loadGdriveFiles);

// Handle OAuth callback (this would be called from the callback page)
async function handleGitHubCallback(code, state) {
  try {
    // Verify state
    const storedState = localStorage.getItem('github-oauth-state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }
    localStorage.removeItem('github-oauth-state');
    
    // Exchange code for access token
    const response = await fetch('/auth/github/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    if (!response.ok) throw new Error('Token exchange failed');
    
    const { access_token } = await response.json();
    
    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token ${access_token}` }
    });
    
    if (!userResponse.ok) throw new Error('Failed to get user info');
    
    const user = await userResponse.json();
    
    githubToken = access_token;
    githubUser = user;
    sessionStorage.setItem('github-token', access_token);
    
    updateGitPanel();
    setStatus(`Signed in as ${user.login}`);
  } catch (error) {
    setStatus('GitHub authentication failed', true);
  }
}

// Sign out
document.getElementById('btn-github-signout')?.addEventListener('click', () => {
  githubToken = null;
  githubUser = null;
  currentRepo = null;
  sessionStorage.removeItem('github-token');
  updateGitPanel();
  setStatus('Signed out of GitHub');
});

// Commit changes — uses the publish endpoint to actually push to GitHub
document.getElementById('btn-git-commit')?.addEventListener('click', async () => {
  const message = document.getElementById('git-commit-message').value.trim();
  if (!message) {
    setStatus('Commit message required', true);
    return;
  }

  if (!currentFile || currentFile === 'untitled.md') {
    setStatus('Save the file first', true);
    return;
  }

  try {
    setStatus('Publishing to GitHub...');
    await saveFile(true);
    const res = await fetch(`/publish/${encodeURIComponent(currentFile)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: getContent(), message }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('git-commit-message').value = '';
      updateGitStatus();
      setStatus(`Published ${currentFile} to GitHub`);
    } else {
      setStatus(data.detail || 'Publish failed', true);
    }
  } catch (error) {
    setStatus('Publish failed', true);
  }
});

// Push all — uses the bulk publish endpoint
document.getElementById('btn-git-push')?.addEventListener('click', async () => {
  try {
    setStatus('Publishing all notes...');
    const res = await fetch('/publish', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      let msg = `Published ${data.published} notes`;
      if (data.results?.github) msg += ` — GitHub: ${data.results.github}`;
      updateGitStatus();
      setStatus(msg);
    } else {
      setStatus(data.detail || 'Publish failed', true);
    }
  } catch (error) {
    setStatus('Publish failed', true);
  }
});

// Update Git panel UI
function updateGitPanel() {
  const authSection = document.getElementById('git-auth');
  const gitPanel = document.getElementById('git-panel');
  
  if (githubUser) {
    authSection.classList.add('hidden');
    gitPanel.classList.remove('hidden');
    
    document.getElementById('git-avatar').src = githubUser.avatar_url;
    document.getElementById('git-username').textContent = githubUser.login;
    document.getElementById('git-repo').textContent = currentRepo || 'No repository';
    
    updateGitStatus();
  } else {
    authSection.classList.remove('hidden');
    gitPanel.classList.add('hidden');
  }
}

// Update Git status
function updateGitStatus() {
  const changesEl = document.getElementById('git-changes');
  const commitBtn = document.getElementById('btn-git-commit');
  const pushBtn = document.getElementById('btn-git-push');
  const messageInput = document.getElementById('git-commit-message');
  
  // Simulate checking for changes
  const hasChanges = isDirty; // Use existing dirty state
  const hasCommits = false; // Simulate no unpushed commits
  
  if (hasChanges) {
    changesEl.textContent = '1 file changed';
    commitBtn.disabled = !messageInput.value.trim();
    updateFileChanges();
  } else {
    changesEl.textContent = 'No changes';
    commitBtn.disabled = true;
  }
  
  pushBtn.disabled = !hasCommits;
}

// Update file changes list
function updateFileChanges() {
  const fileList = document.getElementById('git-file-changes');
  
  if (isDirty && currentFile) {
    fileList.innerHTML = `
      <div class="git-file-item">
        <span class="git-file-status modified">M</span>
        <span class="git-file-name">${currentFile}</span>
      </div>
    `;
  } else {
    fileList.innerHTML = '';
  }
}

// Enable/disable commit button based on message
document.getElementById('git-commit-message')?.addEventListener('input', (e) => {
  const commitBtn = document.getElementById('btn-git-commit');
  commitBtn.disabled = !e.target.value.trim() || !isDirty;
});

// Initialize GitHub integration
if (githubToken) {
  // Verify stored token on startup
  fetch('https://api.github.com/user', {
    headers: { 'Authorization': `token ${githubToken}` }
  })
  .then(response => response.ok ? response.json() : Promise.reject())
  .then(user => {
    githubUser = user;
    updateGitPanel();
  })
  .catch(() => {
    sessionStorage.removeItem('github-token');
    githubToken = null;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const helpPanel = document.getElementById("help-panel");

function toggleHelp() {
  helpPanel.classList.toggle("open");
}

document.getElementById("btn-help")?.addEventListener("click", () => { closeAllMenus(); toggleHelp(); });
document.getElementById("btn-close-help")?.addEventListener("click", () => helpPanel.classList.remove("open"));
document.getElementById("btn-about")?.addEventListener("click", () => { 
  closeAllMenus(); 
  document.getElementById("about-overlay").classList.remove("hidden");
});
document.getElementById("btn-close-about")?.addEventListener("click", () => {
  document.getElementById("about-overlay").classList.add("hidden");
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && helpPanel.classList.contains("open")) helpPanel.classList.remove("open");
  if (e.key === "Escape" && !document.getElementById("about-overlay").classList.contains("hidden")) {
    document.getElementById("about-overlay").classList.add("hidden");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR RESIZE
// ═══════════════════════════════════════════════════════════════════════════════
const resizeHandle = document.getElementById("sidebar-resize-handle");
let isResizing = false;

resizeHandle?.addEventListener("mousedown", (e) => {
  isResizing = true;
  resizeHandle.classList.add("dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const sidebar = document.getElementById("sidebar");
  const newWidth = Math.min(Math.max(e.clientX, 160), 500);
  sidebar.style.width = newWidth + "px";
  document.documentElement.style.setProperty('--sidebar-w', newWidth + 'px');
});

document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    resizeHandle?.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
});

function updateSidebarWidth() {
  const sidebar = document.getElementById("sidebar");
  const isCollapsed = sidebar.classList.contains("collapsed");
  const width = isCollapsed ? 8 : parseInt(sidebar.style.width || getComputedStyle(sidebar).width);
  
  document.documentElement.style.setProperty('--sidebar-w', width + 'px');
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════
const HISTORY_KEY = "sc-editor-history";
let historySaveTimer = null;

function saveEditorHistory() {
  try {
    const content = getContent();
    if (content.trim()) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ content, file: currentFile, timestamp: Date.now() }));
    }
  } catch (e) {}
}

function restoreEditorHistory() {
  // Disabled - don't auto-restore files on launch (Typora behavior)
  return;
}

function scheduleHistorySave() {
  clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(saveEditorHistory, 5000);
}

window.addEventListener("beforeunload", (e) => {
  saveEditorHistory();
  if (isDirty) { e.preventDefault(); e.returnValue = ""; }
});

// Disabled auto-restore
// setTimeout(restoreEditorHistory, 100);

// ═══════════════════════════════════════════════════════════════════════════════
// CLOUD BROWSER
// ═══════════════════════════════════════════════════════════════════════════════
async function openCloudBrowser(provider) {
  const section = document.getElementById("cloud-section");
  const label = document.getElementById("cloud-label");
  const list = document.getElementById("cloud-file-list");
  label.textContent = "Google Drive";
  list.innerHTML = "<li class='loading'>Loading…</li>";
  section.classList.remove("hidden");
  const url = "/gdrive/files";
  const res = await fetch(url);
  list.innerHTML = "";
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const li = document.createElement("li");
    li.className = "no-results";
    li.textContent = err.detail || "Error";
    list.appendChild(li);
    return;
  }
  const { files } = await res.json();
  if (!files.length) {
    const li = document.createElement("li");
    li.className = "no-results";
    li.textContent = "No .md files";
    list.appendChild(li);
    return;
  }
  files.forEach(name => {
    const openUrl = `/gdrive/open/${encodeURIComponent(name)}`;
    const li = document.createElement("li");
    li.textContent = name;
    li.style.cursor = "pointer";
    li.style.padding = "6px 12px";
    li.addEventListener("click", async () => {
      const r = await fetch(openUrl);
      if (!r.ok) { setStatus("Failed to open", true); return; }
      const { content } = await r.json();
      setContent(content);
      document.getElementById("filename-input").value = name;
      currentFile = name;
      setStatus(`Opened ${name} from ${label.textContent}`);
    });
    list.appendChild(li);
  });
}

document.getElementById("btn-close-cloud")?.addEventListener("click", () => document.getElementById("cloud-section").classList.add("hidden"));

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-SAVE / AUTO-PUBLISH
// ═══════════════════════════════════════════════════════════════════════════════
setInterval(() => {
  if (isDirty && currentFile !== "untitled.md") {
    saveFile(true);
  }
}, 60000);

// Auto-publish removed — publishing should only happen on explicit user action

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTRON
// ═══════════════════════════════════════════════════════════════════════════════
const isElectron = navigator.userAgent.toLowerCase().includes("electron");
if (isElectron) {
  const quitBtn = document.getElementById("btn-quit");
  if (quitBtn) {
    quitBtn.style.display = "";
    quitBtn.addEventListener("click", () => {
      if (isDirty && !confirm("Unsaved changes. Quit anyway?")) return;
      window.close();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "q") {
      e.preventDefault();
      if (isDirty && !confirm("Unsaved changes. Quit anyway?")) return;
      window.close();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE / OPEN FOLDER
// ═══════════════════════════════════════════════════════════════════════════════
let workspacePath = "";
let workspaceName = "";

async function loadWorkspace() {
  try {
    const res = await fetch("/workspace");
    const data = await res.json();
    workspacePath = data.path;
    workspaceName = data.name;
    if (workspacePath) addRecentLocation(workspacePath);
    const el = document.getElementById("workspace-name");
    if (el) {
      el.textContent = workspaceName;
      el.title = workspacePath;
    }
    
    // Update sidebar header (Typora-style: show folder name in sidebar)
    const sidebarHeader = document.getElementById("sidebar-header");
    const sidebarFolderName = document.getElementById("sidebar-folder-name");
    if (workspacePath) {
      if (sidebarHeader) sidebarHeader.classList.remove("hidden");
      if (sidebarFolderName) sidebarFolderName.textContent = workspaceName;
    } else {
      if (sidebarHeader) sidebarHeader.classList.add("hidden");
    }
    
    // Update status bar folder display
    const folderStatus = document.getElementById("folder-status");
    if (folderStatus) {
      folderStatus.textContent = workspacePath ? workspaceName : "";
    }
  } catch {}
}

async function setWorkspace(folderPath) {
  const res = await fetch("/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folderPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus(err.detail || "Failed to open folder", true);
    return false;
  }
  const data = await res.json();
  workspacePath = data.path;
  workspaceName = data.name;

  // Save to recent locations
  addRecentLocation(workspacePath);

  // Update workspace bar
  const el = document.getElementById("workspace-name");
  if (el) {
    el.textContent = workspaceName;
    el.title = workspacePath;
  }

  // Update bottom folder name
  updateBottomFolderName();

  // Update sidebar header (Typora-style: show folder name in sidebar)
  const sidebarHeader = document.getElementById("sidebar-header");
  const sidebarFolderName = document.getElementById("sidebar-folder-name");
  if (workspacePath) {
    if (sidebarHeader) sidebarHeader.classList.remove("hidden");
    if (sidebarFolderName) sidebarFolderName.textContent = workspaceName;
  } else {
    if (sidebarHeader) sidebarHeader.classList.add("hidden");
  }

  // Update status bar folder display
  const folderStatus = document.getElementById("folder-status");
  if (folderStatus) {
    folderStatus.textContent = workspacePath ? workspaceName : "";
  }

  // Reset editor state
  currentFile = "untitled.md";
  document.getElementById("filename-input").value = "untitled.md";
  setContent("");
  loadFileList();
  setStatus(`Opened folder: ${workspacePath}`);
  return true;
}

function addRecentLocation(path) {
  if (!path) return;
  const recent = JSON.parse(localStorage.getItem("lectura-recent-locations") || "[]");
  const filtered = recent.filter(p => p !== path);
  filtered.unshift(path);
  localStorage.setItem("lectura-recent-locations", JSON.stringify(filtered.slice(0, 10)));
}

function getPinnedFolders() {
  return JSON.parse(localStorage.getItem("lectura-pinned-folders") || "[]");
}

function togglePinFolder(path) {
  const pinned = getPinnedFolders();
  const idx = pinned.indexOf(path);
  if (idx >= 0) {
    pinned.splice(idx, 1);
  } else {
    pinned.push(path);
  }
  localStorage.setItem("lectura-pinned-folders", JSON.stringify(pinned));
}

// ── Folder browser dialog ────────────────────────────────────────────────────
let folderBrowserCurrent = "";

async function openFolderDialog() {
  closeAllMenus();
  // In Electron, directly open native OS folder picker
  if (window.electronAPI?.openFolderDialog) {
    const folderPath = await window.electronAPI.openFolderDialog(workspacePath || "");
    if (folderPath) setWorkspace(folderPath);
    return;
  }
  // Fallback: custom HTML folder browser for web mode
  document.getElementById("folder-dialog-overlay").classList.remove("hidden");
  document.getElementById("folder-dialog").classList.remove("hidden");
  browseTo(workspacePath || "");
}

function closeFolderDialog() {
  document.getElementById("folder-dialog-overlay").classList.add("hidden");
  document.getElementById("folder-dialog")?.classList.add("hidden");
}

async function browseTo(dirPath) {
  try {
    const res = await fetch("/workspace/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dirPath || "" }),
    });
    if (!res.ok) return;
    var data = await res.json();
  } catch { return; }
  folderBrowserCurrent = data.current || "";
  document.getElementById("folder-path-input").value = folderBrowserCurrent;
  document.getElementById("folder-selected-path").textContent = folderBrowserCurrent;

  const list = document.getElementById("folder-browser-list");
  list.innerHTML = "";

  (data.dirs || []).forEach(dir => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="folder-icon">📁</span> ${dir.name}`;
    li.addEventListener("click", () => browseTo(dir.path));
    li.addEventListener("dblclick", () => {
      setWorkspace(dir.path);
      closeFolderDialog();
    });
    list.appendChild(li);
  });

  if (!data.dirs || data.dirs.length === 0) {
    const li = document.createElement("li");
    li.style.color = "var(--text-muted)";
    li.style.fontStyle = "italic";
    li.textContent = "No subfolders";
    list.appendChild(li);
  }
}

document.getElementById("btn-open-folder")?.addEventListener("click", openFolderDialog);
document.getElementById("workspace-name")?.addEventListener("click", openFolderDialog);
document.getElementById("folder-dialog-close")?.addEventListener("click", closeFolderDialog);
document.getElementById("folder-dialog-overlay")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeFolderDialog();
});

document.getElementById("folder-up-btn")?.addEventListener("click", () => {
  const input = document.getElementById("folder-path-input").value.trim();
  const parent = input.replace(/\/[^/]*\/?$/, "") || "/";
  browseTo(parent);
});

document.getElementById("folder-go-btn")?.addEventListener("click", () => {
  browseTo(document.getElementById("folder-path-input").value.trim());
});

document.getElementById("folder-path-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") browseTo(e.target.value.trim());
});

document.getElementById("folder-open-btn")?.addEventListener("click", () => {
  setWorkspace(folderBrowserCurrent);
  closeFolderDialog();
});

// ── Bottom sidebar context menus ─────────────────────────────────────────────
function showFolderContextMenu(e) {
  showSidebarMorePopup({ x: e.clientX, y: e.clientY }, true);
}

function showFolderOptionsMenu(e) {
  const menu = document.createElement("div");
  menu.className = "context-menu";
  const rect = e.target.closest("button").getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.left = rect.left + "px";
  menu.style.top = (rect.bottom + 4) + "px";
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="pin">Pin Folder</div>
    <div class="context-menu-item" data-action="delete">Delete Folder</div>
  `;
  
  document.body.appendChild(menu);
  
  menu.addEventListener("click", (ev) => {
    const action = ev.target.dataset.action;
    if (action === "pin") {
      showToast("Folder pinned");
    } else if (action === "delete") {
      if (confirm("Delete this folder and all its contents?")) {
        showToast("Folder deleted");
      }
    }
    menu.remove();
  });
  
  setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
}

function revealInExplorer() {
  if (!currentFile) {
    showToast("No file selected");
    return;
  }
  fetch("/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: currentFile })
  }).then(() => {
    showToast("Opened in file explorer");
  }).catch(() => {
    showToast("Could not open file explorer");
  });
}

function makeFileNameEditable(fileEl, filePath, currentName) {
  const nameSpan = fileEl.querySelector(".file-name");
  if (!nameSpan) return;
  
  const input = document.createElement("input");
  input.type = "text";
  input.className = "file-name-input";
  input.value = currentName.replace(/\.md$/, "");
  input.style.cssText = "background: var(--bg-input); border: 1px solid var(--accent); padding: 2px 4px; border-radius: 3px; font-size: inherit; width: 100%;";
  
  nameSpan.replaceWith(input);
  input.focus();
  input.select();
  
  const finishEdit = async () => {
    const newName = input.value.trim();
    if (!newName) {
      input.replaceWith(nameSpan);
      return;
    }
    
    const finalName = newName.endsWith(".md") ? newName : newName + ".md";
    if (finalName === currentName) {
      input.replaceWith(nameSpan);
      return;
    }
    
    // Rename the file
    const parent = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";
    const newPath = parent ? `${parent}/${finalName}` : finalName;
    
    const r = await fetch(`/files/${encodeURIComponent(filePath)}`);
    if (!r.ok) {
      input.replaceWith(nameSpan);
      showToast("Failed to rename");
      return;
    }
    
    const { content } = await r.json();
    const createRes = await fetch(`/files/${encodeURIComponent(newPath)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    
    if (!createRes.ok) {
      input.replaceWith(nameSpan);
      showToast("Failed to rename");
      return;
    }
    
    await fetch(`/files/${encodeURIComponent(filePath)}`, { method: "DELETE" });
    
    if (currentFile === filePath) {
      currentFile = newPath;
      document.getElementById("filename-input").value = finalName;
      updateBottomFileName();
    }
    
    await loadFileList();
    showToast(`Renamed to "${finalName}"`);
  };
  
  input.addEventListener("blur", finishEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEdit();
    } else if (e.key === "Escape") {
      input.replaceWith(nameSpan);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════

// Apply saved preferences on startup
function applyPreferences() {
  const prefs = JSON.parse(localStorage.getItem("lectura-prefs") || "{}");
  
  // Apply font size
  if (prefs.fontSize && prefs.fontSize !== "auto") {
    document.documentElement.style.setProperty("--editor-font-size", prefs.fontSize + "px");
    document.documentElement.style.setProperty("--preview-font-size", prefs.fontSize + "px");
  }
}

applyPreferences();

// ── Bottom control bar event listeners ──────────────────────────────────────
document.getElementById("btn-bottom-toggle-sidebar")?.addEventListener("click", toggleSidebar);
document.getElementById("btn-bottom-toggle-editor")?.addEventListener("click", () => {
  const editorPane = document.getElementById("editor-pane");
  const previewPane = document.getElementById("preview-pane");
  
  // Toggle between editor-only and preview-only
  if (editorPane.classList.contains("hidden-pane")) {
    // Currently showing preview-only, switch to editor-only
    editorPane.classList.remove("hidden-pane");
    previewPane.classList.add("hidden-pane");
  } else if (previewPane.classList.contains("hidden-pane")) {
    // Currently showing editor-only, switch to preview-only
    editorPane.classList.add("hidden-pane");
    previewPane.classList.remove("hidden-pane");
  } else {
    // Currently showing both, switch to preview-only
    editorPane.classList.add("hidden-pane");
  }
});

document.getElementById("btn-bottom-new-file")?.addEventListener("click", async () => {
  closeAllMenus();
  
  // Create untitled file inline
  const folder = currentFolder || "";
  let counter = 1;
  let fileName = "untitled.md";
  let fullPath = folder ? `${folder}/${fileName}` : fileName;
  
  // Find unique name
  const res = await fetch("/files");
  const { files } = await res.json();
  while (files.some(f => (typeof f === 'string' ? f : f.path) === fullPath)) {
    fileName = `untitled-${counter}.md`;
    fullPath = folder ? `${folder}/${fileName}` : fileName;
    counter++;
  }
  
  // Create empty file
  const r = await fetch(`/files/${encodeURIComponent(fullPath)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "" })
  });
  
  if (r.ok) {
    currentFile = fullPath;
    setContent("");
    isDirty = false;
    updateDirtyBadge();
    updateBottomFileName();
    await loadFileList();
    
    // Find the file in sidebar and make it editable
    setTimeout(() => {
      const fileEl = document.querySelector(`li.tree-file[data-file-path="${fullPath}"]`);
      if (fileEl) {
        fileEl.scrollIntoView({ behavior: "smooth", block: "center" });
        const nameSpan = fileEl.querySelector(".file-name");
        if (nameSpan) {
          makeFileNameEditable(fileEl, fullPath, fileName);
        }
      }
    }, 100);
  }
});

document.getElementById("btn-bottom-view-toggle")?.addEventListener("click", () => {
  if (filesViewMode === "tree") {
    filesViewMode = "list";
    populateFileList();
  } else {
    filesViewMode = "tree";
  }
  
  // Update the displayed content
  document.querySelectorAll(".sidebar-content").forEach(panel => {
    if (panel.dataset.for === "tree" || panel.dataset.for === "list") {
      panel.style.display = panel.dataset.for === filesViewMode ? "" : "none";
    }
  });
  
  updateViewToggleIcon();
});

function updateBottomFolderName() {
  const folderNameEl = document.getElementById("bottom-folder-name");
  const wsName = document.getElementById("workspace-name")?.textContent || "No folder";
  if (folderNameEl) {
    folderNameEl.textContent = wsName;
  }
}

function updateBottomFileName() {
  // No longer needed - bottom shows folder name instead
}

function showRecentLocationsMenu(e) {
  const menu = document.createElement("div");
  menu.className = "context-menu";
  const rect = e.target.closest("button").getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.right = (window.innerWidth - rect.right) + "px";
  menu.style.bottom = (window.innerHeight - rect.top + 4) + "px";
  
  // Get recent files from localStorage
  const recentFiles = JSON.parse(localStorage.getItem("lectura-recent-files") || "[]");
  
  let menuHTML = '<div class="context-menu-section-title">Recent Locations</div>';
  
  if (recentFiles.length > 0) {
    recentFiles.slice(0, 10).forEach((file, index) => {
      const fileName = file.split("/").pop();
      menuHTML += `
        <div class="context-menu-item recent-location-item" data-file="${file}" title="${file}">
          <span class="recent-file-name">${fileName}</span>
          <div class="recent-actions">
            <button class="recent-pin-btn" data-file="${file}" title="Pin">📍</button>
            <button class="recent-delete-btn" data-file="${file}" title="Remove">✕</button>
          </div>
        </div>
      `;
    });
  } else {
    menuHTML += '<div class="context-menu-item" style="opacity: 0.5">No recent files</div>';
  }
  
  menuHTML += '<div class="context-menu-sep"></div>';
  menuHTML += '<div class="context-menu-item" data-action="clear-recent">Clear Recent</div>';
  
  menu.innerHTML = menuHTML;
  document.body.appendChild(menu);
  
  menu.addEventListener("click", (ev) => {
    const item = ev.target.closest(".context-menu-item");
    if (!item) return;
    
    if (item.classList.contains("recent-location-item")) {
      const file = item.dataset.file;
      if (file) openFile(file);
    } else if (item.dataset.action === "clear-recent") {
      localStorage.setItem("lectura-recent-files", "[]");
      showToast("Recent files cleared");
    }
    menu.remove();
  });
  
  menu.querySelectorAll(".recent-pin-btn").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showToast("File pinned");
    });
  });
  
  menu.querySelectorAll(".recent-delete-btn").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const file = btn.dataset.file;
      const recent = JSON.parse(localStorage.getItem("lectura-recent-files") || "[]");
      const filtered = recent.filter(f => f !== file);
      localStorage.setItem("lectura-recent-files", JSON.stringify(filtered));
      menu.remove();
      showToast("Removed from recent");
    });
  });
  
  setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
}

// ── Sort mode for file tree ──────────────────────────────────────────────────
let fileSortMode = localStorage.getItem("lectura-sort-mode") || "name";

function getSortComparator() {
  switch (fileSortMode) {
    case "name": return naturalSort;
    case "name-desc": return (a, b) => naturalSort(b, a);
    case "modified": return (a, b) => (b._mtime || 0) - (a._mtime || 0);
    case "created": return (a, b) => (b._ctime || 0) - (a._ctime || 0);
    default: return naturalSort;
  }
}

function getFileSortComparator() {
  switch (fileSortMode) {
    case "name": return (a, b) => naturalSort(a.name, b.name);
    case "name-desc": return (a, b) => naturalSort(b.name, a.name);
    case "modified": return (a, b) => (b.mtime || 0) - (a.mtime || 0);
    case "created": return (a, b) => (b.ctime || 0) - (a.ctime || 0);
    default: return (a, b) => naturalSort(a.name, b.name);
  }
}

// ── Inline folder creation in sidebar (Typora-style) ────────────────────────
async function createFolderInline(parentPath = "") {
  const container = parentPath
    ? document.querySelector(`li.tree-folder[data-folder-path="${parentPath}"] > ul`)
    : document.getElementById("file-list");
  if (!container) {
    // Fallback: prompt
    const name = prompt("Folder name:", "New Folder");
    if (!name) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    const r = await fetch(`/folders/${encodeURIComponent(fullPath)}`, { method: "POST" });
    if (r.ok) { expandedFolders.add(fullPath); saveExpandedFolders(); loadFileList(); setStatus(`Created folder "${name}"`); }
    else setStatus("Failed to create folder", true);
    return;
  }

  // Expand the parent folder first
  if (parentPath) {
    expandedFolders.add(parentPath);
    saveExpandedFolders();
    await loadFileList();
    // Re-find the container after refresh
    const updatedContainer = document.querySelector(`li.tree-folder[data-folder-path="${parentPath}"] > ul`);
    if (updatedContainer) return createFolderInlineInContainer(updatedContainer, parentPath);
  }

  createFolderInlineInContainer(container, parentPath);
}

function createFolderInlineInContainer(container, parentPath) {
  const li = document.createElement("li");
  li.className = "tree-folder new-folder-inline";

  const header = document.createElement("div");
  header.className = "folder-header";
  header.innerHTML = `
    <span class="folder-arrow">▶</span>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink:0; color: var(--text-dim);">
      <path d="M1 2.5A1.5 1.5 0 012.5 1h3.379a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.121 3H13.5A1.5 1.5 0 0115 4.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-10z"/>
    </svg>
  `;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-rename-input";
  input.value = "New Folder";
  input.style.cssText = "background: var(--bg-input); border: 1px solid var(--accent); padding: 2px 4px; border-radius: 3px; font-size: 12px; flex: 1; min-width: 0; margin-left: 4px; color: var(--text); outline: none;";
  header.appendChild(input);
  li.appendChild(header);

  // Insert at the top of the container
  container.insertBefore(li, container.firstChild);

  input.focus();
  input.select();

  const finish = async () => {
    const name = input.value.trim();
    li.remove();
    if (!name) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    const r = await fetch(`/folders/${encodeURIComponent(fullPath)}`, { method: "POST" });
    if (r.ok) {
      expandedFolders.add(fullPath);
      saveExpandedFolders();
      await loadFileList();
      setStatus(`Created folder "${name}"`);
    } else {
      setStatus("Failed to create folder", true);
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(); }
    else if (e.key === "Escape") { li.remove(); }
  });
  input.addEventListener("blur", finish);
}

// ── Three-dots "More" popup (Typora-style) ──────────────────────────────────
function showSidebarMorePopup(anchorRect, fromContextMenu) {
  // Remove any existing popup
  document.querySelector(".sidebar-more-popup")?.remove();

  const popup = document.createElement("div");
  popup.className = "sidebar-more-popup";

  // Get recent folders/locations and pinned folders
  const recentLocations = JSON.parse(localStorage.getItem("lectura-recent-locations") || "[]");
  const pinnedFolders = getPinnedFolders();

  let pinnedHTML = "";
  if (pinnedFolders.length > 0) {
    pinnedFolders.forEach(loc => {
      const locName = loc.split("/").pop() || loc;
      const isCurrent = loc === workspacePath;
      pinnedHTML += `
        <div class="popup-item recent-location-item${isCurrent ? " current-loc" : ""}" data-location="${loc}" title="${loc}">
          <span class="recent-loc-icon" style="color: var(--accent);">📌</span>
          <span class="recent-file-name">${locName}</span>
          <button class="pin-btn pinned" data-pin-path="${loc}" title="Unpin">📌</button>
        </div>`;
    });
  }

  let recentHTML = "";
  const recentFiltered = recentLocations.filter(p => !pinnedFolders.includes(p));
  if (recentFiltered.length > 0) {
    recentFiltered.slice(0, 8).forEach(loc => {
      const locName = loc.split("/").pop() || loc;
      const isCurrent = loc === workspacePath;
      recentHTML += `
        <div class="popup-item recent-location-item${isCurrent ? " current-loc" : ""}" data-location="${loc}" title="${loc}">
          <span class="recent-loc-icon">📁</span>
          <span class="recent-file-name">${locName}</span>
          <button class="pin-btn" data-pin-path="${loc}" title="Pin folder">📌</button>
        </div>`;
    });
  } else if (pinnedFolders.length === 0) {
    const wsName = workspacePath ? workspacePath.split("/").pop() : "notes";
    recentHTML = `
      <div class="popup-item recent-location-item current-loc" data-location="" title="${workspacePath || 'notes'}">
        <span class="recent-loc-icon">📁</span>
        <span class="recent-file-name">${wsName}</span>
      </div>`;
  }

  // Sort button helpers
  const isActive = (mode) => fileSortMode === mode ? "active" : "";

  popup.innerHTML = `
    <div class="popup-header">
      <span>Action</span>
      <button class="popup-close" title="Close">&times;</button>
    </div>
    <div class="popup-item" data-action="new-file">New File</div>
    <div class="popup-item" data-action="search">Search</div>
    <div class="popup-item" data-action="reveal">Reveal in File Explorer</div>
    <div class="popup-item" data-action="open-folder">Open Folder...</div>
    <div class="popup-item" data-action="refresh">Refresh Folder</div>
    <div class="popup-sep"></div>
    <div class="sort-row">
      <span class="popup-section-title">Sort</span>
      <button class="sort-btn ${isActive("name")}" data-sort="name" title="Sort by Name (A→Z)">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.082 5.629L9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371h-1.781zm1.57-.785L11 2.687h-.047l-.652 2.157h1.351z"/><path d="M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645V14zM4.5 2.5a.5.5 0 00-1 0v9.793l-1.146-1.147a.5.5 0 00-.708.708l2 2a.5.5 0 00.708 0l2-2a.5.5 0 00-.708-.708L4.5 12.293V2.5z"/></svg>
      </button>
      <button class="sort-btn ${isActive("modified")}" data-sort="modified" title="Sort by Date Modified">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 0a.5.5 0 01.5.5V1h8V.5a.5.5 0 011 0V1h1a2 2 0 012 2v11a2 2 0 01-2 2H2a2 2 0 01-2-2V3a2 2 0 012-2h1V.5a.5.5 0 01.5-.5zM1 4v10a1 1 0 001 1h12a1 1 0 001-1V4H1z"/></svg>
      </button>
      <button class="sort-btn ${isActive("created")}" data-sort="created" title="Sort by Date Created">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a.5.5 0 00-1 0V7H3.5a.5.5 0 000 1H7v3.5a.5.5 0 001 0V8h3.5a.5.5 0 000-1H8V3.5z"/><path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z"/></svg>
      </button>
      <button class="sort-btn ${isActive("name-desc")}" data-sort="name-desc" title="Sort by Name (Z→A)">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.082 5.629L9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371h-1.781zm1.57-.785L11 2.687h-.047l-.652 2.157h1.351z"/><path d="M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645V14zM4.5 13.5a.5.5 0 01-1 0V3.707L2.354 4.854a.5.5 0 11-.708-.708l2-2a.5.5 0 01.708 0l2 2a.5.5 0 01-.708.708L4.5 3.707V13.5z"/></svg>
      </button>
    </div>
    ${pinnedHTML ? `<div class="popup-sep"></div><div class="popup-section-title">Pinned</div>${pinnedHTML}` : ""}
    <div class="popup-sep"></div>
    <div class="popup-section-title">Recent Locations</div>
    ${recentHTML || '<div class="popup-item" style="opacity:0.5;pointer-events:none;font-size:12px;">No recent folders</div>'}
  `;

  // Position
  popup.style.position = "fixed";
  document.body.appendChild(popup);

  const popupW = popup.offsetWidth;
  const popupH = popup.offsetHeight;

  let posX, posY;
  if (fromContextMenu) {
    posX = anchorRect.x;
    posY = anchorRect.y;
  } else {
    // Open upward from the button
    posX = anchorRect.right - popupW;
    posY = anchorRect.top - popupH - 4;
  }

  // Clamp to viewport
  if (posX + popupW > window.innerWidth) posX = window.innerWidth - popupW - 8;
  if (posY + popupH > window.innerHeight) posY = window.innerHeight - popupH - 8;
  if (posX < 0) posX = 8;
  if (posY < 0) posY = 8;

  popup.style.left = posX + "px";
  popup.style.top = posY + "px";

  // Close button
  popup.querySelector(".popup-close").addEventListener("click", () => popup.remove());

  // Action items
  popup.addEventListener("click", (ev) => {
    const item = ev.target.closest(".popup-item[data-action]");
    if (!item) return;
    const action = item.dataset.action;
    if (action === "new-file") {
      document.getElementById("btn-bottom-new-file")?.click();
    } else if (action === "search") {
      document.getElementById("search-input")?.focus();
    } else if (action === "reveal") {
      revealInExplorer();
    } else if (action === "open-folder") {
      openFolderDialog();
    } else if (action === "refresh") {
      loadFileList();
      showToast("Folder refreshed");
    }
    popup.remove();
  });

  // Sort buttons
  popup.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      fileSortMode = btn.dataset.sort;
      localStorage.setItem("lectura-sort-mode", fileSortMode);
      popup.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadFileList();
    });
  });

  // Pin/unpin buttons
  popup.querySelectorAll(".pin-btn[data-pin-path]").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      togglePinFolder(btn.dataset.pinPath);
      // Re-render popup
      popup.remove();
      const rect = document.getElementById("btn-bottom-more").getBoundingClientRect();
      showSidebarMorePopup(rect, false);
    });
  });

  // Recent location items — switch workspace
  popup.querySelectorAll(".recent-location-item[data-location]").forEach(item => {
    item.addEventListener("click", (ev) => {
      if (ev.target.closest(".pin-btn")) return;
      const loc = item.dataset.location;
      if (loc && loc !== workspacePath) {
        setWorkspace(loc);
      }
      popup.remove();
    });
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener("click", (ev) => {
      if (!popup.contains(ev.target)) popup.remove();
    }, { once: true });
  }, 0);
}

// Three-dots button click
document.getElementById("btn-bottom-more")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  const rect = btn.getBoundingClientRect();
  showSidebarMorePopup(rect, false);
});

// Bottom folder name button click — opens same popup
document.getElementById("btn-bottom-folder-name")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  const rect = btn.getBoundingClientRect();
  showSidebarMorePopup(rect, false);
});

loadWorkspace();
// Lazy load file list after UI is ready
setTimeout(() => {
  loadFileList();
  updateBottomFolderName();
  updateBottomFileName();
  switchSidebarMode("files");
}, 100);
// Initialize Mermaid early
initMermaid();

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('hideSidebar') === 'true') {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.add("collapsed");
  document.body.classList.add("sidebar-collapsed");
}

// Load file from URL parameter
const fileParam = urlParams.get('file');
if (fileParam) {
  setTimeout(() => openFile(fileParam), 200);
}

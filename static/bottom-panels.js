/**
 * Bottom Panels Manager (Zed-style)
 * Sidebar and Outline panels collapse downwards
 */

class BottomPanelsManager {
  constructor() {
    this.sidebarPanelOpen = false;
    this.outlinePanelOpen = false;
    this.init();
  }

  init() {
    this.createPanels();
    this.setupEventListeners();
  }

  createPanels() {
    const main = document.getElementById("main");
    
    // Create wrapper for editor/preview
    const editorWrapper = document.createElement("div");
    editorWrapper.style.display = "flex";
    editorWrapper.style.flex = "1";
    editorWrapper.style.overflow = "hidden";
    
    // Move existing content into wrapper
    while (main.firstChild) {
      editorWrapper.appendChild(main.firstChild);
    }
    main.appendChild(editorWrapper);

    // Create sidebar bottom panel
    const sidebarPanel = document.createElement("div");
    sidebarPanel.id = "bottom-sidebar-panel";
    sidebarPanel.className = "bottom-panel";
    sidebarPanel.innerHTML = `
      <div style="padding: 8px; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 600;">Project</div>
      <div id="bottom-sidebar-content" style="flex: 1; overflow-y: auto;"></div>
    `;
    main.appendChild(sidebarPanel);

    // Create outline bottom panel
    const outlinePanel = document.createElement("div");
    outlinePanel.id = "bottom-outline-panel";
    outlinePanel.className = "bottom-panel";
    outlinePanel.innerHTML = `
      <div style="padding: 8px; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 600;">Outline</div>
      <div id="bottom-outline-content" style="flex: 1; overflow-y: auto;"></div>
    `;
    main.appendChild(outlinePanel);
  }

  setupEventListeners() {
    document.getElementById("btn-panel-sidebar")?.addEventListener("click", () => {
      this.toggleSidebarPanel();
    });

    document.getElementById("btn-panel-outline")?.addEventListener("click", () => {
      this.toggleOutlinePanel();
    });
  }

  toggleSidebarPanel() {
    this.sidebarPanelOpen = !this.sidebarPanelOpen;
    const panel = document.getElementById("bottom-sidebar-panel");
    const btn = document.getElementById("btn-panel-sidebar");
    
    panel.classList.toggle("visible", this.sidebarPanelOpen);
    btn.classList.toggle("active", this.sidebarPanelOpen);

    if (this.sidebarPanelOpen) {
      this.syncSidebarContent();
    }
  }

  toggleOutlinePanel() {
    this.outlinePanelOpen = !this.outlinePanelOpen;
    const panel = document.getElementById("bottom-outline-panel");
    const btn = document.getElementById("btn-panel-outline");
    
    panel.classList.toggle("visible", this.outlinePanelOpen);
    btn.classList.toggle("active", this.outlinePanelOpen);

    if (this.outlinePanelOpen) {
      this.syncOutlineContent();
    }
  }

  syncSidebarContent() {
    const sidebarContent = document.querySelector(".sidebar-content[data-for='files']");
    const bottomContent = document.getElementById("bottom-sidebar-content");
    
    if (sidebarContent) {
      bottomContent.innerHTML = sidebarContent.innerHTML;
    }
  }

  syncOutlineContent() {
    const outlineContent = document.querySelector(".sidebar-content[data-for='outline']");
    const bottomContent = document.getElementById("bottom-outline-content");
    
    if (outlineContent) {
      bottomContent.innerHTML = outlineContent.innerHTML;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.bottomPanelsManager = new BottomPanelsManager();
  });
} else {
  window.bottomPanelsManager = new BottomPanelsManager();
}

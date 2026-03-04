# Typora-Style Sidebar Controls

## Overview
Implemented Typora-inspired bottom control bars in the sidebar that change based on the active mode.

## Features

### Outline Mode Controls
Located at the bottom left of the sidebar when in Outline view:
- **Toggle Sidebar (<)** - Collapses/expands the sidebar
- **Toggle Editor (</> icon)** - Shows/hides the editor pane

### Files Mode Controls (Tree/List)
Located at the bottom of the sidebar when in Files (Tree or List) view:
- **New File (+)** - Creates a new file in the current folder
- **Folder Name (middle button)** - Shows current folder name
  - Click: Opens/closes folder browser dialog
  - Right-click: Shows context menu with:
    - New File
    - Search
    - Reveal in File Explorer
    - Open Folder...
    - Refresh Folder
- **Three-dot menu (⋮)** - Folder options:
  - Pin Folder
  - Delete Folder
- **View Toggle** - Switches between Tree and List view
  - Shows folder icon when in Tree mode
  - Shows list icon when in List mode

### Cloud Modes (Git/Google Drive)
Bottom controls are hidden when in Git or Google Drive modes.

## Implementation Details

### Files Modified
1. **static/index.html** - Added bottom control bar HTML structure
2. **static/style.css** - Added styling for bottom controls and context menus
3. **static/editor.js** - Added event handlers and mode switching logic

### Key Functions
- `switchSidebarMode(mode)` - Updates visibility of bottom controls based on mode
- `updateBottomFolderName()` - Syncs folder name in bottom bar with workspace
- `showFolderContextMenu(e)` - Displays right-click menu on folder name
- `showFolderOptionsMenu(e)` - Displays three-dot menu options
- `toggleEditorPane()` - Shows/hides the editor pane

### CSS Classes
- `.sidebar-bottom-controls` - Container for bottom control bar
- `.bottom-controls-group` - Group of controls for specific mode
- `.bottom-control-btn` - Individual control button
- `.folder-name-btn` - Folder name button with special styling
- `.context-menu-item` - Context menu item styling

## Usage
The controls automatically appear/disappear based on the selected sidebar mode (Outline, Tree, List, Git, or Google Drive).

# MindMap Local 💡

An offline-first, private, and premium mind mapping application inspired by MindMeister. It stores all maps directly on your machine inside your browser's local database (`IndexedDB`) and requires **zero terminal commands to launch**.

---

## 🚀 How to Launch the App

You don't need to use the terminal to start the app. 

1. Open Finder and navigate to this folder: `/Users/patricksilveira/Code/mindmap`.
2. Double-click the **`MindMap.app`** application bundle.
3. Your default web browser will automatically open to `http://localhost:5515` and load your maps dashboard!
4. You will also see a macOS system notification confirming that the app is ready.

> **Note on macOS Security:** Because manually created app bundles are not signed with a paid Apple Developer certificate, macOS may show a warning when opening it for the first time. To bypass this, simply **Right-Click (Control-Click) the `MindMap.app` and choose Open**, or open it once, let it fail, then go to **System Settings > Privacy & Security** and click **Open Anyway**.

---

## ✨ Features

- **Double-Click Edit:** Double-click any node on the canvas to instantly edit its text inline.
- **Auto-Save:** The app automatically saves your modifications to a local browser database on every change (with a 800ms debounce safety).
- **Vibrant Node Colors:** Choose between a curated palette of pastel and deep colors (Coral, Emerald, Sky, Indigo, Amber, etc.).
- **Emoji Decorators:** Instantly badge nodes with emojis to make your diagrams visually appealing.
- **Text Notes:** Add descriptions or longer references to any node. A small sheet icon will appear on nodes with active notes.
- **Symmetric & Outline Layouts:** Choose between **Symmetrical Split** layout (ideal for standard mind mapping) and **Right-only Tree** outline layout.
- **Drag & Drop Re-parenting:** Drag any node card and drop it near another node to re-parent the branch instantly with a smooth visual transition.
- **Dark/Light Mode:** Toggle between clean light mode and sleek dark mode styles.
- **Multi-Format Exports:**
  - **Markdown (`.md`)**: Bulleted outline, ideal for documentation or imports into Obsidian/Notion.
  - **Plain Text (`.txt`)**: Tab-spaced indent outline.
  - **Vector Image (`.svg`)**: Infinite resolution vector graph image download.
  - **JSON Backup (`.mindmap`)**: Save a local file backup that you can import later on the Dashboard.

---

## ⌨️ Keyboard Shortcuts

This app is fully optimized for speed and keyboard-driven usage:

| Action | Shortcut |
| :--- | :--- |
| **Add Child Node** (Sub-topic) | `Tab` |
| **Add Sibling Node** (Same Level) | `Enter` |
| **Delete Selected Node & Sub-branches** | `Delete` or `Backspace` |
| **Edit Topic Text** | `Double Click` or `F2` or just type |
| **Navigate Up / Down Sibling** | `Arrow Up` / `Arrow Down` |
| **Navigate Left / Right** (Inwards/Outwards) | `Arrow Left` / `Arrow Right` |
| **Recenter Focus to Root Node** | `Escape` |

---

## 🛠️ Developer Rebuilding Commands

If you make any changes to the source code files, you can rebuild the project using Node.js:

1. **Install dependencies:** `npm install` (already done).
2. **Start Dev Server:** `npm run dev` (to iterate with Hot Module Replacement).
3. **Compile static bundle:** `npm run build` (builds code to the `dist` folder which is served by the launcher).

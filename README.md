<p align="center">
  <img src="public/app-icon.png" width="128" height="128" alt="MindMap Local Logo" style="border-radius: 28px; box-shadow: 0 8px 24px rgba(236, 72, 153, 0.35);" />
</p>

<h1 align="center">MindMap Local</h1>

<p align="center">
  <b>A private, offline-first, keyboard-driven mind mapping tool for macOS & the modern web.</b><br />
  Stores all mind maps locally on your machine with zero cloud lock-in and zero terminal setup.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/offline--first-100%25-brightgreen?style=flat-square" alt="Offline First" />
  <img src="https://img.shields.io/badge/privacy-local%20disk%20only-blue?style=flat-square" alt="Local Disk Only" />
  <img src="https://img.shields.io/badge/tests-39%20passing-success?style=flat-square" alt="Tests 39 passing" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/vite-8-646cff?style=flat-square&logo=vite" alt="Vite 8" />
  <img src="https://img.shields.io/badge/style-retro%20punk-ff007f?style=flat-square" alt="Retro Punk" />
</p>

---

## ⚡ Highlights

- 🍏 **Double-Click App Launch**: Launch instantly on macOS via `MindMap.app` without touching a terminal.
- 🌳 **4 Dynamic Layouts**:
  - **Mind Map (Radial / Symmetrical)**: Balances branches left and right.
  - **Organograma (Top-Down Org Chart)**: Clean hierarchy from top to bottom with vertical S-curves.
  - **Right Tree Outline**: Expand branches left-to-right.
  - **Left Tree Outline**: Expand branches right-to-left.
- 📥 **Hierarchical Markdown Import**: Create maps directly from Markdown files (`.md`, `.txt`) or pasted text (`#` headings, `-` bullet lists, `- [ ]` task checkboxes, notes).
- 🧹 **Smart Formatting Sanitizer**: Automatically removes markdown escape artifacts (like `\(ex: IA\)` or `processo\.`) and strips markdown wrappers with a one-click clean button.
- ✍️ **Multiline Topics**: Type `Shift + Enter` to insert newlines within topics with automatic text wrapping and dynamic node height adaptation.
- 💾 **100% Private & Persistent**: Maps are stored directly in your workspace under `data/*.json` on disk, with transparent IndexedDB fallback.
- 🎨 **Retro-Punk Aesthetics & Themes**: Colorful neon accents, light/dark mode, customizable palette colors, and emoji badges.
- 📤 **Versatile Exports**: Export to Markdown (`.md`), Plain Text (`.txt`), Scalable Vector Graphic (`.svg`), or full JSON database backup (`.mindmap`).
- ⌨️ **Keyboard-First Workflow**: Fast navigation, quick topic creation (`Tab` for child, `Enter` for sibling), and full Undo/Redo (`Cmd+Z` / `Cmd+Shift+Z`).

---

## 🚀 How to Launch on macOS

You don't need to open the terminal to use MindMap Local:

1. Open Finder in the project folder.
2. Double-click **`MindMap.app`**.
3. Your default web browser will open to `http://localhost:5515` and display your dashboard!
4. A macOS system notification will let you know the local server is ready.

> **First-time macOS gatekeeper note:** Because this is an unsigned local build, macOS may prompt on first launch. Simply **Right-Click (Control-Click) `MindMap.app` and choose Open**, or allow it in **System Settings > Privacy & Security > Open Anyway**.

---

## ⌨️ Keyboard Shortcuts Reference

Designed for rapid brainstorming without reaching for the mouse:

| Action | Shortcut |
| :--- | :--- |
| **Add Child Sub-topic** | `Tab` |
| **Add Sibling Topic** (same level) | `Enter` |
| **Multiline Break inside topic** | `Shift + Enter` |
| **Finish & Save Text Edit** | `Enter` |
| **Cancel Text Edit** | `Escape` |
| **Edit Selected Node** | `Double Click`, `F2`, or start typing |
| **Delete Selected Branch** | `Delete` or `Backspace` |
| **Undo / Redo** | `Cmd/Ctrl + Z` / `Cmd/Ctrl + Shift + Z` (or `Ctrl + Y`) |
| **Navigate Siblings** | `Arrow Up` / `Arrow Down` *(or Left/Right in Org mode)* |
| **Navigate Parent / Child** | `Arrow Left` / `Arrow Right` *(or Up/Down in Org mode)* |
| **Recenter Viewport to Root** | `Escape` (when not editing) |

---

## 📥 Markdown Import Format

You can import files or paste markdown directly. The parser automatically structures:

```markdown
# Roadmap de Inovação

- 🚀 Fase 1: Fundação
  - Diagnóstico de processos
  - Mapear ferramentas atuais *(Note: Prioridade alta)*
  - [x] Entrevistar lideranças
  - [ ] Selecionar fornecedores
- 🎯 Fase 2: Implementação
  - Implementar tecnologias e soluções novas (ex: IA)
  - Treinamento da equipe
```

- **Headings (`#`, `##`, `###`)**: Converted into hierarchical parent/child branches.
- **Bullets (`-`, `*`, `+`, `1.`)**: Indented sub-bullets become nested nodes.
- **Tasks (`- [ ]`, `- [x]`)**: Automatically converted to task status emojis (`⬜` / `✅`).
- **Notes (`*(Note: ...)*`, `[Note: ...]`)**: Extracted into node description notes.
- **Escape Cleanup**: Common backslash escapes (e.g. `\(`, `\)`, `\.`, `\-`, `\*`) from LLM or Notion exports are automatically cleaned.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19, Vanilla CSS Design System with CSS tokens (no heavy UI frameworks).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Bundler**: Vite 8.
- **Local Server**: Lightweight Node.js HTTP server (`server.js`) providing local disk read/write REST endpoints at `/api/maps` saving to `./data/`.
- **Database Fallback**: In-browser IndexedDB (`idb`) if running without the backend server.
- **Desktop Wrapper**: Native macOS `.app` bundle script with multi-resolution `.icns` retro-punk app icon.
- **Testing**: [Vitest](https://vitest.dev/) suite with 39 unit tests covering layouts, markdown parsing, history, and exports.

---

## 💻 Developer Guide

If you'd like to develop or run in developer mode:

```bash
# Install dependencies
npm install

# Start Vite dev server + disk API store
npm run dev

# Run Vitest test suite
npm test

# Run ESLint
npm run lint

# Compile production bundle
npm run build
```

---

## 📄 License

MIT License. Free for personal and commercial use.

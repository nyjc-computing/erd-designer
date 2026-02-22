# ERD Designer 📊

**Live Demo:** [https://mrvsurya.github.io/erd-designer/](https://mrvsurya.github.io/erd-designer/)

A specialised React-based tool for designing Entity Relationship Diagrams (ERDs) with precision and ease. This application allows modelling of database structures using professional Crow's foot notation and validation with integrated AI auditing.

## 🚀 Key Features

### 📐 Precise Crow's Foot Notation
* **Flush Geometry:** Custom-calculated trident (fork) connectors that sit perfectly flush against entity borders, regardless of the connection angle.
* **Dynamic Cardinality:** Support for standard ERD relationships, including **1:1**, **1:M**, **M:1**, and **M:M**. Click any relationship label to cycle through cardinality types.
* **Contrast-Optimised Labels:** Cardinality labels are rendered in high-contrast black-on-white for perfect legibility in both the app and exported PNGs.

### 🏢 Entity & Canvas Management
* **Custom Entity Nodes:** Create and label database entities with an intuitive, on-node text interface and optimised slim horizontal widths.
* **Zoom-to-Fit:** Instantly re-centre and scale the canvas to view the entire diagram with a single click. This feature also triggers automatically when opening a project to ensure immediate visibility.
* **Smart Duplication:** `Ctrl + D` instantly clones the selected entity and shifts focus to the new node, preventing the accidental movement of the original.
* **Smart Placement:** New entities are automatically placed at the centre of the current viewport, eliminating the need to hunt for nodes placed outside the visible area after panning or zooming.

### 📁 Advanced Project & File Handling
* **Modern File Persistence:** Integrated with the **File System Access API**. The system tracks the file handle of an opened project, allowing for direct "Overwrite" saves rather than forced new downloads.
* **Overwrite Protection:** A confirmation prompt appears when saving to an existing file to prevent accidental data loss.
* **Session-Aware Undo:** The undo system (`Ctrl + Z`) tracks the entire application state, including nodes, edges, business context, notes, and even the current file link. 
* **High-Quality PNG Export:** Generate professional-grade diagrams with a solid white background. 
* **Professional Mode:** Automatic suppression of connection handles and grid dots during export for a cleaner final look.

### 🤖 AI-Powered Auditing
* **Context-Aware Prompts:** Generates specialised audit prompts that feed the business rules and diagram structure to an AI for architectural verification.
* **Strict Logic Constraints:** The AI focus is directed towards relationship logic and existing entities, ignoring unrelated attributes or fields outside the context.
* **Integrated Notes:** A dedicated "Design Notes" area to store AI feedback and architectural decisions directly within the project file.

### ⌨️ Comprehensive Keyboard Shortcuts
* **`Ctrl + S`**: Save the current project (triggers overwrite for opened files or a new save for new projects).
* **`Ctrl + Z`**: Full-state undo, including canvas changes and sidebar text updates.
* **`Ctrl + D`**: Duplicate the selected entity node.
* **`Delete` / `Backspace`**: Remove the selected entity or relationship.

### 🛠️ User Interface
* **Collapsible Sidebar:** A space-efficient sidebar that can be toggled to maximise the active workspace while keeping essential tools within reach.
* **Night Mode Support:** Toggle between light and dark themes with a single click to reduce eye strain.
* **Fluid Canvas:** Built on React Flow, providing a smooth panning, zooming, and drag-and-drop experience.

---

## 🛠️ Built With

* [React](https://reactjs.org/) - UI Framework
* [React Flow](https://reactflow.dev/) - Powerful diagramming library
* [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) - Modern file handling
* [html-to-image](https://www.npmjs.com/package/html-to-image) - High-quality image generation
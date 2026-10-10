# FlowCraft - AI-Powered Diagram Generator 🎨✨

Transform your code into beautiful diagrams, infographics, and visualizations instantly. **FlowCraft** allows developers to visualize complex logic, document architectures, and create professional assets directly within VS Code, powered by your choice of AI.

[FlowCraft](https://www.flowcraft.app)

## Key Features

### Multi-Provider AI Support
Choose the AI provider — and the specific model — that fits your needs and budget. FlowCraft supports:
*   **OpenAI** — `gpt-6.1-sol`
*   **Anthropic** — Claude Opus 5.5, Sonnet 5.5, and Haiku 5.5
*   **Google** — `gemini-3.8-flash`
*   **FlowCraft API**
    * Documentation available at [FlowCraft API Docs](https://www.flowcraft.app/features/api-keys/).

Select your per-provider model from the Settings sidebar (`models · per provider`). The choice is sent with every generation request; leave on **default** to use the server-side default.

### Comprehensive Visualization Types
Generate widespread diagram standards and creative assets:
*   **Mermaid Diagrams**: Flowcharts, Sequence, Class, State, ER, Gantt, Pie Charts.
*   **Infographics**: Create SVG-based infographics for presentations and docs.
*   **AI Images**: Generate illustrative images and diagrams from text descriptions.

### Privacy-First Architecture
*   **Bring Your Own Key (BYOK)**: Your API keys are stored securely in VS Code's Secret Storage.

### Seamless In-Editor Experience
*   **Integrated Viewer**: View, zoom, and pan diagrams without leaving VS Code.
*   **Visualize this (zero typing)**: Right-click a file, a folder, or a selection → **FlowCraft: Visualize this**. FlowCraft reads the code, picks a sensible diagram type (flowchart, class diagram, or an architecture graph for folders), and generates — no prompt to write. Change the type from the viewer's **Type…** dropdown.
*   **Conversational refine**: Don't like the result? Type a plain-English change in the viewer's **Refine** bar — *"make it left-to-right"*, *"add the error path"*, *"simplify"* — and FlowCraft edits the existing diagram instead of starting over. **↶ Back** steps through your history.
*   **Mermaid in Markdown**: Open any `.md` file and FlowCraft adds **Preview** / **Refine** actions above every ` ```mermaid ` block. Preview renders it in the viewer; Refine rewrites it in place. Use **FlowCraft: Insert diagram here** to generate a Mermaid block from a description right at your cursor.
*   **History & Management**: Access, regenerate, or duplicate past diagrams from a dedicated history view.
*   **Export**: One-click export to **SVG**, **PNG**, or **PDF**.

---

## Getting Started

1.  **Install FlowCraft** from the VS Code Marketplace.
2.  **Open the Sidebar**: Click the FlowCraft logo in the activity bar.
3.  **Configure Provider**:
    *   On first run, you will be prompted to configure an API provider.
    *   Enter your API Key (e.g., OpenAI, Anthropic) to get started.
4.  **Generate**:
    *   Select code in your editor and right-click -> `FlowCraft: Generate Diagram from Selection`.
    *   Or use the sidebar "Generate Diagram" button to start from scratch.

## 💡 Usage

### Generating Diagrams
You can generate diagrams in multiple ways:
*   **Visualize this**: Right-click a file/folder/selection > `FlowCraft: Visualize this` — zero typing.
*   **Context Menu**: Select code, Right-click > `FlowCraft: Generate...`
*   **Command Palette**: `Ctrl+Shift+P` (or `Cmd+Shift+P`) > type `FlowCraft`
*   **Sidebar UI**: Use the visual "Create Diagram" interface to select type, complexity, and style.

### Refining Diagrams
Generation rarely nails it on the first try, so you don't have to start over:
*   In the diagram viewer, type a change in the **Refine** bar (e.g. *"make it left-to-right"*) and hit **Refine**. **↶ Back** undoes a step.
*   In Markdown, click **Refine** above a ` ```mermaid ` block to rewrite it in place from a plain-English instruction.

### Authoring in Markdown
*   Open a `.md` file with ` ```mermaid ` blocks to get **Preview** / **Refine** actions above each one.
*   Run `FlowCraft: Insert diagram here` to generate and drop a Mermaid block at your cursor.

## Configuration

Open the **FlowCraft Settings** sidebar panel to configure:
*   **Providers & keys** — paste API keys for each provider; stored in `vscode.secrets`.
*   **Default provider** — which provider generation commands use by default.
*   **Per-provider model** — pick the LLM for each provider (e.g. Opus 4 for Anthropic, `gpt-6.1-sol` for OpenAI). Leave on `default (server)` to use FlowCraft's recommended model.
*   **Defaults** — diagram type, color palette, complexity.

Or access VS Code's settings (`Cmd+,` / `Ctrl+,`) and search for `FlowCraft` for the underlying keys.

## ✨ FlowCraft Premium

**Diagram generation is always free and BYOK** — you bring your own provider key and FlowCraft never charges for or routes your generations. Premium is an optional account-level upgrade that unlocks convenience features on top:

| | Free | Premium |
| --- | --- | --- |
| AI diagram generation (BYOK) | ✓ Unlimited | ✓ Unlimited |
| Mermaid, infographics & illustrations | ✓ | ✓ |
| In-editor preview + SVG / PNG / PDF export | ✓ | ✓ |
| **Cloud history sync** (diagrams on the web + across machines) | — | ✓ |
| **Premium templates** (curated, ready-to-edit library) | — | ✓ |
| **Advanced exports** (hi-res PNG 3×/4×, data-URI, Markdown bundle, batch export) | — | ✓ |

Sign in from the **FlowCraft** sidebar to manage your plan. See pricing at **[flowcraft.app/dashboard/pricing](https://flowcraft.app/dashboard/pricing)**.

## Contributing & Support

We love feedback!
*   **Report Issues**: [GitHub Issues](https://github.com/shagunmistry/FlowCraft-VsCode-Extension/issues)
*   **Feature Requests**: Submit a request on our repo.

---

*Built with ❤️ for developers who love visual documentation.*

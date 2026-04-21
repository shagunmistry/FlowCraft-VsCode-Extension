# FlowCraft - AI-Powered Diagram Generator 🎨✨

Transform your code into beautiful diagrams, infographics, and visualizations instantly. **FlowCraft** allows developers to visualize complex logic, document architectures, and create professional assets directly within VS Code, powered by your choice of AI.

[FlowCraft](https://www.flowcraft.app)

## Key Features

### Multi-Provider AI Support
Choose the AI provider — and the specific model — that fits your needs and budget. FlowCraft supports:
*   **OpenAI** — `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-mini`, `o3-mini`
*   **Anthropic** — Claude Opus 4, Sonnet 4, Haiku 4, and recent 3.x models
*   **Google** — `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
*   **FlowCraft API**
    * Documentation available at [FlowCraft API Docs](https://www.flowcraft.app/features/api-keys/).

Select your per-provider model from the Settings sidebar (`models · per provider`). The choice is sent with every generation request; leave on **default** to use the server-side default.

### Comprehensive Visualization Types
Generate widespread diagram standards and creative assets:
*   **Mermaid Diagrams**: Flowcharts, Sequence, Class, State, ER, Gantt, Pie Charts.
*   **Infographics**: Create SVG-based infographics for presentations and docs. (Coming Soon)
*   **AI Images**: Generate illustrative images and diagrams from text descriptions. (Coming Soon)

### Privacy-First Architecture
*   **Bring Your Own Key (BYOK)**: Your API keys are stored securely in VS Code's Secret Storage.

### Seamless In-Editor Experience
*   **Integrated Viewer**: View, zoom, and pan diagrams without leaving VS Code.
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
*   **Context Menu**: Select code, Right-click > `FlowCraft: Generate...`
*   **Command Palette**: `Ctrl+Shift+P` (or `Cmd+Shift+P`) > type `FlowCraft`
*   **Sidebar UI**: Use the visual "Create Diagram" interface to select type, complexity, and style.

## Configuration

Open the **FlowCraft Settings** sidebar panel to configure:
*   **Providers & keys** — paste API keys for each provider; stored in `vscode.secrets`.
*   **Default provider** — which provider generation commands use by default.
*   **Per-provider model** — pick the LLM for each provider (e.g. Opus 4 for Anthropic, `gpt-4o-mini` for OpenAI). Leave on `default (server)` to use FlowCraft's recommended model.
*   **Defaults** — diagram type, color palette, complexity.

Or access VS Code's settings (`Cmd+,` / `Ctrl+,`) and search for `FlowCraft` for the underlying keys.

## Contributing & Support

We love feedback!
*   **Report Issues**: [GitHub Issues](https://github.com/shagunmistry/FlowCraft-VsCode-Extension/issues)
*   **Feature Requests**: Submit a request on our repo.

---

*Built with ❤️ for developers who love visual documentation.*

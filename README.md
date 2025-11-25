# FlowCraft - AI-Powered Diagram Generator 🎨✨

Transform your code into beautiful diagrams, infographics, and visualizations instantly. **FlowCraft** allows developers to visualize complex logic, document architectures, and create professional assets directly within VS Code, powered by your choice of AI.

[FlowCraft](https://www.flowcraft.app)

## Key Features

### Multi-Provider AI Support
Choose the AI model that fits your needs and budget. FlowCraft supports:
*   **OpenAI**
*   **Anthropic**
*   **Google**
*   **FlowCraft API** 
    * Documentation available at [FlowCraft API Docs](https://www.flowcraft.app/features/api-keys/).

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

Access settings via `Cmd+,` (or `Ctrl+,`) and search for `FlowCraft`:
*   `flowcraft.api.provider`: Set your default AI provider.
*   `flowcraft.diagrams.defaultType`: Set your preferred diagram type.
*   `flowcraft.diagrams.autoSave`: Toggle automatic saving to history.

## Contributing & Support

We love feedback!
*   **Report Issues**: [GitHub Issues](https://github.com/shagunmistry/FlowCraft-VsCode-Extension/issues)
*   **Feature Requests**: Submit a request on our repo.

---

*Built with ❤️ for developers who love visual documentation.*

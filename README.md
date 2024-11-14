# FlowCraft

[FlowCraft](https://flowcraft.app) empowers developers to effortlessly convert code into visual flow diagrams. Simplify your workflow and enhance code comprehension by generating clear and concise flowcharts directly within your development environment.

## Features

- **Privacy-First Approach**: Use your own OpenAI API key for complete control and transparency over API usage
- **Effortless Code Conversion**: Select a code block or an entire file and instantly generate a corresponding flow diagram
- **Multiple Diagram Types**: Support for both flow diagrams and class diagrams
- **Seamless Integration**: Works seamlessly within VS Code, allowing you to visualize code flow without context switching
- **Improved Code Understanding**: Flow diagrams provide a visual representation of code logic, making it easier to understand complex structures
- **Enhanced Communication**: Flowcharts facilitate clear communication of code flow between developers and stakeholders

## Getting Started

1. Install the FlowCraft extension from VS Code marketplace
2. On first use, you'll be prompted to enter your OpenAI API key
   - This gives you full control over API usage and costs
   - Your key is stored securely in VS Code's secret storage
   - Never transmitted or stored on our servers
3. Start generating diagrams with any of the available commands!

Need to update your API key? Use the `FlowCraft: Reset API Key` command to securely remove the existing key and enter a new one.

## Why Bring Your Own API Key?

- **Cost Control**: Direct visibility and control over API usage
- **Transparency**: You know exactly what you're paying for
- **Security**: Your key is stored securely in VS Code's secret storage
- **Flexibility**: Use your organization's API key with custom rate limits and settings

## Available Commands

- `FlowCraft: Generate Flow Diagram for Current File`: Generates a flow diagram for the current file
- `FlowCraft: Generate Flow Diagram for Selection`: Generates a flow diagram for the selected code block
- `FlowCraft: Generate Class Diagram for Current File`: Generates a class diagram for the current file
- `FlowCraft: Generate Class Diagram for Selection`: Generates a class diagram for the selected code block
- `FlowCraft: Reset API Key`: Securely remove existing API key and enter a new one

## Future Enhancements

- Support for additional diagram types (sequence diagrams, UML diagrams, etc.)
- Customization options for diagram appearance
- Integration with version control systems to track flow diagram changes
- Batch processing for multiple files
- Team collaboration features

## Release Notes

### 1.2.0

Privacy and Control Update! 🔒

We're excited to announce a major update focused on privacy and user control:

- **Bring Your Own API Key**: Use your own OpenAI API key for complete control over API usage
- **Enhanced Privacy**: Your code never passes through our servers
- **Secure Storage**: API keys are stored securely in VS Code's secret storage
- **Better Cost Control**: Direct visibility and control over API usage
- **All Existing Features**: Continues to support both flow and class diagrams

### 1.1.0

Class Diagrams Update:

- **Class Diagrams**: Generate class diagrams from your code
- **Improved Flow Diagrams**: Enhanced accuracy and readability
- **Performance Improvements**: Faster diagram generation

### 1.0.0

Initial release with core functionality for flow diagram generation.

---

## Requesting Enhancements or Reporting Issues

If you have any suggestions for future enhancements or encounter any issues, please feel free to create an issue on the [GitHub repository](https://github.com/shagunmistry/FlowCraft-VsCode-Extension). We appreciate your feedback and contributions!

## Support

Need help? Have questions about API usage or costs? Visit our [support page](https://flowcraft.app/support) or reach out to us on [Twitter](https://twitter.com/flowcraft).
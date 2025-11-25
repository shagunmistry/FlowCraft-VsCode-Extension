import * as vscode from "vscode";
import {
  getDiagramExamples,
  promptPrefix,
  responseFormatPrompt,
} from "./constants";

class FlowCraftChatParticipant {
  async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    console.log("Request: ", request);
    console.log("Context: ", context);
    console.log("Stream: ", stream);
    console.log("Token: ", token);

    if (!request.command) {
      await stream.markdown(
        "⚠️ No command provided. Please provide a command to generate a diagram."
      );
      return;
    }

    const diagramExamples = getDiagramExamples(request.command);
    const userPrompt =
      promptPrefix(request.command) + "\n" + responseFormatPrompt;

    // initialize the messages array with the prompt
    const messages = [vscode.LanguageModelChatMessage.Assistant(userPrompt)];
    messages.push(vscode.LanguageModelChatMessage.Assistant(diagramExamples));

    // Get message history for context
    const previousMessages = context.history.filter(
      (h): h is vscode.ChatResponseTurn => h instanceof vscode.ChatResponseTurn
    );

    // Add previous messages to maintain context
    previousMessages.forEach((m) => {
      let fullMessage = "";
      m.response.forEach((r) => {
        const mdPart = r as vscode.ChatResponseMarkdownPart;
        fullMessage += mdPart.value.value;
      });
      messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
    });

    // Add the current user message
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

    try {
      // Progress indication
      stream.markdown("🎨 Generating diagram...");

      console.log("request.command", request.command);
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return undefined;
      }

      const selection = editor.selection;
      const code = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);

      const additionalPrompt = code || request.prompt;

      messages.push(vscode.LanguageModelChatMessage.User(additionalPrompt));

      // Get explanation from language model
      const chatResponse = await request.model.sendRequest(messages, {}, token);

      // Stream the explanation
      let mermaidCode = "";

      for await (const fragment of chatResponse.text) {
        console.log("Fragment: ", fragment);
        stream.markdown(fragment);
        mermaidCode += fragment;
      }

      // Send the mermaid code to your API to generate the diagram image
      const response = await fetch("YOUR_API_URL_HERE", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: mermaidCode }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate diagram image");
      }

      const data = await response.json() as { imageUrl: string };
      const diagramImageUrl = data.imageUrl;

      // Send the diagram image to the chat
      stream.markdown(`![Diagram](${diagramImageUrl})`);
    } catch (error) {
      const errorMessage = (error as Error).message;
      stream.markdown(
        `❌ Oops! Something went wrong while generating the diagram. Please try again. Error details: ${errorMessage}`
      );
    }
  }

  //   private async generateDiagram(
  //     code: string,
  //     apiKey: string,
  //     type: "flowchart" | "classDiagram"
  //   ) {
  //     const body = {
  //       title: `Chat_Generated_${new Date().toISOString()}`,
  //       description: code,
  //       type,
  //     };

  //     const response = await fetch(`${FLOWCRAFT_API_URL}/diagrams/generate`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "X-OpenAI-Key": apiKey,
  //       },
  //       body: JSON.stringify(body),
  //     });

  //     if (!response.ok) {
  //       throw new Error("Failed to generate diagram");
  //     }

  //     const data = await response.json();
  //     return data.response.inserted_diagram;
  //   }
}

export default FlowCraftChatParticipant;

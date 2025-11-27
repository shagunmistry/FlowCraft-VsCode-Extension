/**
 * Webview Messaging Utilities
 * Helper functions for communication between webview and extension
 */

// Get the VS Code API
const vscode = acquireVsCodeApi();

/**
 * Post a message to the extension
 * @param {string} command - Command to execute
 * @param {*} data - Data to send with the command
 */
export function postMessage(command, data) {
  vscode.postMessage({
    command,
    data
  });
}

/**
 * Set up message listener from extension
 * @param {Object} handlers - Map of command names to handler functions
 * @returns {Function} Cleanup function
 */
export function onMessage(handlers) {
  const messageHandler = (event) => {
    const message = event.data;
    const handler = handlers[message.command];

    if (handler) {
      try {
        handler(message.data);
      } catch (error) {
        console.error(`Error handling command ${message.command}:`, error);
      }
    } else {
      console.warn(`No handler for command: ${message.command}`);
    }
  };

  window.addEventListener('message', messageHandler);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', messageHandler);
  };
}

/**
 * Get state from VS Code
 * @returns {*} Persisted state
 */
export function getState() {
  return vscode.getState();
}

/**
 * Set state in VS Code
 * @param {*} state - State to persist
 */
export function setState(state) {
  vscode.setState(state);
}

/**
 * Update state in VS Code (merge with existing)
 * @param {Object} updates - State updates to merge
 */
export function updateState(updates) {
  const currentState = getState() || {};
  const newState = { ...currentState, ...updates };
  setState(newState);
}

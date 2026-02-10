# VS Code Live Collaboration Extension

This project is a Minimum Viable Product (MVP) of a VS Code extension that enables real-time collaboration for small teams.

## Features

*   **Real-time Sync:** Code changes are synchronized instantly across all connected users.
*   **Presence:** See a list of connected users.
*   **Chat:** A simple text-based chat is available within a VS Code webview.

## Architecture Overview

This project follows a simple client-server model:

*   **Server (`/server`):** A lightweight Node.js server that acts as the central hub. It uses the `y-websocket` library to manage WebSocket connections and broadcast changes. It is responsible for storing and distributing the shared document data (CRDTs) to all connected clients.

*   **Client (`/extension`):** The VS Code extension is the client. When activated, it establishes a WebSocket connection to the server. It uses Yjs to:
    1.  Create a shared document (`Y.Doc`).
    2.  Bind the content of the active VS Code text editor to a shared text object (`Y.Text`).
    3.  Listen for local changes in the editor and apply them to the `Y.Text` object.
    4.  Listen for remote changes from the `Y.Text` object and apply them to the editor's content.
    5.  Share presence information (like username and color) using the `awareness` protocol.

The use of Yjs (a CRDT implementation) is crucial as it automatically handles merging changes from multiple users without conflicts, ensuring a consistent state across all clients.

## Project Structure

*   `/server`: A simple Node.js WebSocket server using `y-websocket`.
*   `/extension`: The VS Code extension source code.

## How to Run & Test

Follow these steps to run the server and test the extension locally.

### 1. Run the Server

The collaboration server is the central hub that manages connections.

\`\`\`bash
# Navigate to the server directory
cd server

# Start the server (it will run on ws://localhost:1234)
npm start
\`\`\`

### 2. Run the Extension

You need to run the extension in a development environment (an "Extension Development Host" window).

\`\`\`bash
# Navigate to the extension directory
cd extension

# Compile the TypeScript code
npm run compile
\`\`\`

After compiling:

1.  Open the `extension` folder in VS Code.
2.  Press `F5` to open a new window with the extension loaded (the Extension Development Host).

### 3. Test the Collaboration

To test the real-time collaboration, you need to simulate two users:

1.  **First User:** The window that opened when you pressed `F5` is your first user.
2.  **Second User:** Open a new VS Code window (`File > New Window`). In this new window, open the `extension` folder again. Press `F5` again. This will open a *second* Extension Development Host window.

Now you have two independent windows acting as two different users connected to the same server.

**What to test:**

*   **User List:** In the "Collaboration" view in the activity bar, you should see two users listed.
*   **Text Sync:** Open the same file in both windows (e.g., `extension/src/extension.ts`). Type in one window and watch the changes appear instantly in the other.
*   **Chat:** Use the command palette (`Ctrl+Shift+P`) to run "Open Chat" in both windows. Chat functionality is not fully implemented in this MVP, but the window should open.

import * as vscode from 'vscode';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { UserListProvider } from './userListProvider';

/**
 * A map to store the binding between a file URI and its Yjs document (`Y.Text`)
 * and the decorations for remote users' selections.
 */
const documentBindings = new Map<string, { ytext: Y.Text; decorations: vscode.TextEditorDecorationType[] }>();

/** The WebSocket provider instance that connects to the collaboration server. */
let provider: WebsocketProvider | null = null;

/** The root Yjs document. */
let ydoc: Y.Doc | null = null;

/** The Webview panel for the chat interface. */
let chatPanel: vscode.WebviewPanel | null = null;

/**
 * This is the main activation function for the extension.
 * It's called by VS Code when the extension is activated (e.g., on startup).
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "live-collaboration" is now active!');

    // 1. Initialize Yjs and WebSocket Provider
    ydoc = new Y.Doc();
    provider = new WebsocketProvider('ws://localhost:1234', 'default-room', ydoc);

    provider.on('status', (event: { status: string }) => {
        vscode.window.setStatusBarMessage(`Collaboration: ${event.status}`, 3000);
    });

    // Register the TreeDataProvider for the connected users list.
    const userListProvider = new UserListProvider(provider.awareness);
    vscode.window.registerTreeDataProvider('collaboration-users', userListProvider);

    // Set local user information in the awareness state (for presence).
    const username = `User-${Math.floor(Math.random() * 1000)}`;
    provider.awareness.setLocalStateField('user', {
        name: username,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    });

    // 2. Register command to open the chat window
    const openChatCommand = vscode.commands.registerCommand('live-collaboration.openChat', () => {
        if (chatPanel) {
            chatPanel.reveal(vscode.ViewColumn.Two);
        } else {
            chatPanel = vscode.window.createWebviewPanel(
                'chat', 'Collaboration Chat', vscode.ViewColumn.Two, {}
            );
            // The webview's HTML content is loaded from a separate file/function.
            chatPanel.webview.html = getChatWebviewContent();
            chatPanel.onDidDispose(() => {
                chatPanel = null;
            });
        }
    });
    context.subscriptions.push(openChatCommand);


    // 3. Handle document changes and synchronization
    /** A flag to prevent processing local changes that were triggered by remote updates. */
    let applyingRemoteChange = false;

    /**
     * Observes a Y.Text object for remote changes and applies them to the VS Code editor.
     * @param ytext The Y.Text object to observe.
     * @param editor The VS Code TextEditor to apply changes to.
     */
    const observeYText = (ytext: Y.Text, editor: vscode.TextEditor) => {
        ytext.observe(event => {
            // Only apply changes that did not originate from the local client.
            if (!applyingRemoteChange && event.transaction.local === false) {
                const edit = new vscode.WorkspaceEdit();
                // Reconstruct the changes from the Yjs delta format.
                event.changes.delta.forEach(delta => {
                    let position = 0;
                    if (delta.retain) {
                        position += delta.retain;
                    }
                    if (delta.delete) {
                        const start = editor.document.positionAt(position);
                        const end = editor.document.positionAt(position + delta.delete);
                        edit.delete(editor.document.uri, new vscode.Range(start, end));
                    }
                    if (delta.insert) {
                        const start = editor.document.positionAt(position);
                        edit.insert(editor.document.uri, start, delta.insert as string);
                    }
                });

                applyingRemoteChange = true;
                vscode.workspace.applyEdit(edit).then(() => {
                    applyingRemoteChange = false;
                });
            }
        });
    };

    // Bind the initially active document when the extension loads.
    if (vscode.window.activeTextEditor) {
        bindDocument(vscode.window.activeTextEditor);
    }

    // Bind new documents when they become active.
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            bindDocument(editor);
        }
    }));

    // Listen for local text changes and apply them to the Yjs document.
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (applyingRemoteChange) {
            return; // Ignore changes that are being applied from remote.
        }

        const binding = documentBindings.get(event.document.uri.toString());
        if (!binding) return;

        const { ytext } = binding;

        // Use a single Yjs transaction to apply all content changes atomically.
        ydoc?.transact(() => {
            event.contentChanges.forEach(change => {
                const offset = change.rangeOffset;
                const length = change.rangeLength;
                const text = change.text;

                if (length > 0) {
                    ytext.delete(offset, length);
                }
                if (text.length > 0) {
                    ytext.insert(offset, text);
                }
            });
        }, 'local'); // Provide 'local' as the origin to identify this transaction.
    }));

    /**
     * Binds a VS Code TextEditor to a Y.Text object for synchronization.
     * @param editor The VS Code TextEditor to bind.
     */
    function bindDocument(editor: vscode.TextEditor) {
        const docUri = editor.document.uri.toString();
        if (documentBindings.has(docUri)) return; // Already bound.

        // Get a Y.Text object for the document's URI. This will be created if it doesn't exist.
        const ytext = ydoc!.getText(docUri);
        documentBindings.set(docUri, { ytext, decorations: [] });

        // If the shared document is empty, initialize it with the editor's content.
        if (ytext.length === 0) {
            ytext.insert(0, editor.document.getText());
        } else {
            // If the shared document has content, overwrite the local editor's content.
            const syncedText = ytext.toString();
            if (editor.document.getText() !== syncedText) {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                const edit = new vscode.WorkspaceEdit();
                edit.replace(editor.document.uri, fullRange, syncedText);

                applyingRemoteChange = true;
                vscode.workspace.applyEdit(edit).then(() => {
                    applyingRemoteChange = false;
                });
            }
        }

        // Start observing the Y.Text for remote changes.
        observeYText(ytext, editor);
    }
}


/**
 * This function is called by VS Code when the extension is deactivated.
 * It's used to clean up resources like network connections.
 */
export function deactivate() {
    if (provider) {
        provider.disconnect();
    }
    if (ydoc) {
        ydoc.destroy();
    }
}

/**
 * Generates the HTML content for the chat webview.
 * @returns A string containing the HTML for the webview.
 */
function getChatWebviewContent(): string {
    // In a real application, this would likely be loaded from a separate HTML file.
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Collaboration Chat</title>
    </head>
    <body>
        <h1>Chat</h1>
        <p>Chat functionality is not yet implemented.</p>
    </body>
    </html>`;
}

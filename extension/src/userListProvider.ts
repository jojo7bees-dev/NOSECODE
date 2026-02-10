import * as vscode from 'vscode';
import { Awareness } from 'y-protocols/awareness';

/**
 * A TreeDataProvider that displays a list of users connected to the collaboration session.
 * It listens to changes in the 'awareness' state from the WebSocket provider.
 */
export class UserListProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    // An event emitter to notify VS Code that the tree data has changed.
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private awareness: Awareness;

    /**
     * @param awareness The Yjs awareness instance from the WebsocketProvider.
     */
    constructor(awareness: Awareness) {
        this.awareness = awareness;
        // Listen for changes in the awareness state (e.g., users joining/leaving).
        this.awareness.on('change', () => {
            this.refresh();
        });
    }

    /**
     * Triggers a refresh of the TreeView.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Returns the tree item for a given element.
     * @param element The tree item.
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns the children for a given element or the root of the tree.
     * @param element The parent element. If undefined, returns the root elements.
     */
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        // If an element is provided, it means we are getting children of a user item.
        // In our case, user items have no children.
        if (element) {
            return Promise.resolve([]);
        }

        // If no element is provided, we are at the root level.
        // We will display the list of connected users.
        const states = this.awareness.getStates();
        const users: vscode.TreeItem[] = [];
        states.forEach((state, clientID) => {
            // Check if the user's state has been set.
            if (state.user) {
                const userItem = new vscode.TreeItem(state.user.name);
                userItem.description = `(Client ID: ${clientID})`;
                // Use a colored SVG circle as the icon for the user.
                userItem.iconPath = this.createColorIcon(state.user.color);
                users.push(userItem);
            }
        });
        return Promise.resolve(users);
    }

    /**
     * Creates a colored SVG icon as a vscode.Uri.
     * @param color The hex color for the SVG icon.
     */
    private createColorIcon(color: string): vscode.Uri {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${color}" stroke="white" stroke-width="1"/></svg>`;
        const encodedSvg = Buffer.from(svg).toString('base64');
        return vscode.Uri.parse(`data:image/svg+xml;base64,${encodedSvg}`);
    }
}

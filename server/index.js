// Import required modules
const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

// Create a simple HTTP server to serve as a host for the WebSocket server.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Collaborative Server is running');
});

// Create a new WebSocket server and attach it to the HTTP server.
const wss = new WebSocket.Server({ server });

/**
 * Handles new WebSocket connections.
 * When a client connects, we use the `setupWSConnection` utility from `y-websocket`
 * to handle the Yjs synchronization protocol.
 */
wss.on('connection', (ws, req) => {
  console.log('New client connected');

  // For this MVP, all users are connected to a single, hardcoded room name.
  // In a more complex application, the room name would typically be part of the URL,
  // allowing for multiple collaboration sessions.
  const docName = 'default-room';

  // `setupWSConnection` handles all the Yjs-specific messaging,
  // document management, and awareness (presence) updates.
  setupWSConnection(ws, req, { docName });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Define the port for the server to listen on.
const PORT = process.env.PORT || 1234;

// Start the server.
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

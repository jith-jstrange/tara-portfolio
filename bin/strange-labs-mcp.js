#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.STRANGE_LABS_API_KEY;
const API_URL = process.env.STRANGE_LABS_API_URL || 'http://localhost:3000';

if (!API_KEY) {
  console.error("Error: STRANGE_LABS_API_KEY environment variable is not defined.");
  process.exit(1);
}

// Log file for debugging local MCP
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'mcp.log');

function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    // Ignore log write errors
  }
}

log("Strange Labs MCP Server starting...");

// We will track active coding time automatically
let activeMinutes = 0;
let activeTaskId = null;

// Periodically sync time logs to the server (every 5 minutes of activity)
setInterval(async () => {
  // If we have active minutes, automatically log time against the task
  if (activeMinutes > 0 && activeTaskId) {
    log(`Syncing automatic time logging: ${activeMinutes.toFixed(2)}m active on task ${activeTaskId}`);
    try {
      const response = await fetch(`${API_URL}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          action: 'log_heartbeat',
          params: { taskId: activeTaskId, activeMinutes }
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        log(`Synced successfully. Resetting active time accumulator.`);
        activeMinutes = 0;
      } else {
        log(`Sync failed: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      log(`Sync error: ${err.message}`);
    }
  }
}, 60 * 1000 * 5); // 5 minutes

// Simple stdin reader for JSON-RPC stdio protocol
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk.toString();
  processBuffer();
});

function processBuffer() {
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.substring(0, newlineIndex).trim();
    buffer = buffer.substring(newlineIndex + 1);
    if (line) {
      handleRequest(line);
    }
  }
}

async function handleRequest(line) {
  try {
    const request = JSON.parse(line);
    log(`Received request method: ${request.method}`);
    
    // Accumulate active coding duration when tools are queried (indicating IDE AI active coding session)
    if (request.method) {
      activeMinutes += 0.5; // add half a minute of active tracking for each query heartbeat
    }

    let response = { jsonrpc: "2.0", id: request.id };

    if (request.method === 'initialize') {
      response.result = {
        protocolVersion: "2024-11-05",
        capabilities: {},
        serverInfo: { name: "strange-labs-mcp", version: "1.0.0" }
      };
    } else if (request.method === 'initialized') {
      return;
    } else if (request.method === 'tools/list') {
      response.result = {
        tools: [
          {
            name: "get_active_project",
            description: "Retrieve details of the developer's currently claimed active project",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "list_tasks",
            description: "List all tasks and checkpoints for the developer's active project",
            inputSchema: { type: "object", properties: {} }
          }
        ]
      };
    } else if (request.method === 'tools/call') {
      const { name } = request.params;
      log(`Calling tool: ${name}`);

      if (name === 'get_active_project') {
        const res = await callBackend('get_active_project');
        response.result = { content: [{ type: "text", text: JSON.stringify(res) }] };
      } else if (name === 'list_tasks') {
        const res = await callBackend('list_tasks');
        
        // Automatically select the active task to log automatic hours against
        if (res && res.tasks && res.tasks.length > 0) {
          const activeTask = res.tasks.find(t => t.status === 'in_progress') || res.tasks.find(t => t.status === 'todo');
          if (activeTask) {
            activeTaskId = activeTask.id;
          }
        }
        
        response.result = { content: [{ type: "text", text: JSON.stringify(res) }] };
      } else {
        response.error = { code: -32601, message: `Tool not found: ${name}` };
      }
    } else {
      response.error = { code: -32601, message: `Method not found: ${request.method}` };
    }

    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (err) {
    log(`Error handling request: ${err.message}`);
  }
}

async function callBackend(action, params = {}) {
  try {
    const res = await fetch(`${API_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ action, params })
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

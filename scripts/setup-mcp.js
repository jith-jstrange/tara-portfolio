const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const API_URL = process.env.STRANGE_LABS_API_URL || 'http://localhost:3000';

async function main() {
  console.log("=========================================");
  console.log("   Strange Labs IDE Connect Tool (MCP)   ");
  console.log("=========================================\n");

  // 1. Generate a random session claim token
  const sessionToken = crypto.randomBytes(16).toString('hex');
  const claimUrl = `${API_URL}/developer/dashboard/mcp-auth?session=${sessionToken}`;

  console.log("To connect your IDE (Antigravity, Cursor, or VS Code), please open this link in your browser:");
  console.log(`\x1b[36m${claimUrl}\x1b[0m\n`);
  console.log("Waiting for authorization on the web portal... (Press Ctrl+C to cancel)");

  // 2. Poll the server until the session is approved
  const pollUrl = `${API_URL}/api/mcp/auth?session=${sessionToken}`;
  let apiKey = null;

  while (!apiKey) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    try {
      const response = await fetch(pollUrl);
      const data = await response.json();
      if (response.ok && data.approved) {
        apiKey = data.apiKey;
      }
    } catch (err) {
      // Ignore network errors during polling
    }
  }

  console.log("\n\x1b[32m✔ IDE connection successfully authorized!\x1b[0m");
  console.log(`Retrieved secure API key: ${apiKey.substring(0, 10)}*********************`);

  // 3. Configure the MCP settings for the developer's IDEs
  const mcpServerPath = path.resolve(__dirname, '..', 'bin', 'strange-labs-mcp.js');

  const mcpConfig = {
    command: "node",
    args: [mcpServerPath],
    env: {
      STRANGE_LABS_API_KEY: apiKey,
      STRANGE_LABS_API_URL: API_URL
    }
  };

  let configuredCount = 0;

  // Configuration writing helpers
  const homeDir = os.homedir();
  const platform = os.platform();

  // A. Cursor IDE Configuration
  let cursorPath = '';
  if (platform === 'win32') {
    cursorPath = path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalSettings.json');
  } else if (platform === 'darwin') {
    cursorPath = path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'globalSettings.json');
  } else {
    cursorPath = path.join(homeDir, '.config', 'Cursor', 'User', 'globalSettings.json');
  }

  try {
    if (fs.existsSync(path.dirname(cursorPath))) {
      let settings = {};
      if (fs.existsSync(cursorPath)) {
        try {
          settings = JSON.parse(fs.readFileSync(cursorPath, 'utf8'));
        } catch (e) {
          settings = {};
        }
      }
      if (!settings.mcpServers) settings.mcpServers = {};
      settings.mcpServers["strange-labs"] = mcpConfig;

      fs.writeFileSync(cursorPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`\x1b[32m✔ Successfully configured Cursor IDE settings!\x1b[0m (${cursorPath})`);
      configuredCount++;
    }
  } catch (err) {
    console.error(`Failed to configure Cursor: ${err.message}`);
  }

  // B. Antigravity IDE Configuration
  let antigravityPath = '';
  if (platform === 'win32') {
    antigravityPath = path.join(process.env.APPDATA || '', 'Antigravity', 'mcp.json');
  } else if (platform === 'darwin') {
    antigravityPath = path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'mcp.json');
  } else {
    antigravityPath = path.join(homeDir, '.config', 'Antigravity', 'mcp.json');
  }

  try {
    const parentDir = path.dirname(antigravityPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    let settings = {};
    if (fs.existsSync(antigravityPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(antigravityPath, 'utf8'));
      } catch (e) {
        settings = {};
      }
    }
    if (!settings.mcpServers) settings.mcpServers = {};
    settings.mcpServers["strange-labs"] = mcpConfig;

    fs.writeFileSync(antigravityPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`\x1b[32m✔ Successfully configured Antigravity IDE settings!\x1b[0m (${antigravityPath})`);
    configuredCount++;
  } catch (err) {
    console.error(`Failed to configure Antigravity: ${err.message}`);
  }

  // C. VS Code Configuration (we'll save to local settings for copy-pasting)
  const localConfigPath = path.resolve(__dirname, '..', 'strange-labs-mcp-config.json');
  try {
    fs.writeFileSync(localConfigPath, JSON.stringify({ "strange-labs": mcpConfig }, null, 2), 'utf8');
    console.log(`\x1b[32m✔ Wrote copy-pasteable configuration file:\x1b[0m ${localConfigPath}`);
  } catch (err) {
    console.error(`Failed to write local config: ${err.message}`);
  }

  console.log("\n=========================================");
  console.log("   🎉 Connection Setup Complete!         ");
  console.log("=========================================");
  console.log(`Your IDE has been configured with the Strange Labs MCP server.`);
  console.log("Work hours will log automatically while you code in your workspace.");
  console.log("Restart your IDE (Antigravity/Cursor) to load the new server tools.");
  console.log("=========================================");
}

main().catch(err => {
  console.error("Setup tool crash:", err);
});

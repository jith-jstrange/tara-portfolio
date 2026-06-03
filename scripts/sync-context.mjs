import { createServer } from "http";
import { parse } from "url";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load local environment variables
dotenv.config({ path: ".env.local" });

const PORT = 4100;
const SESSION_DIR = path.join(process.cwd(), ".strangelabs");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const LIVE_URL = "https://tara-portfolio-jstrange.netlify.app";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Error: Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

async function startLoginFlow() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url || "", true);
      const pathname = parsedUrl.pathname;

      if (pathname === "/callback") {
        const { access_token, refresh_token, email } = parsedUrl.query;

        if (access_token && refresh_token) {
          // Save session
          const sessionData = {
            access_token,
            refresh_token,
            email,
            updated_at: new Date().toISOString(),
          };
          fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));

          // HTML Response
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Strange Labs IDE Sync</title>
              <style>
                body {
                  background: #050505;
                  color: #f5f5f5;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                }
                .card {
                  background: rgba(255, 255, 255, 0.02);
                  border: 1px solid rgba(255, 255, 255, 0.06);
                  padding: 2.5rem;
                  border-radius: 1.25rem;
                  text-align: center;
                  backdrop-filter: blur(12px);
                  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                  max-width: 400px;
                }
                h1 {
                  color: #818cf8;
                  font-size: 1.75rem;
                  margin-top: 0;
                  margin-bottom: 0.75rem;
                }
                p {
                  color: #a3a3a3;
                  font-size: 0.95rem;
                  line-height: 1.5;
                  margin: 0.5rem 0;
                }
                .accent {
                  color: #c084fc;
                  font-weight: 500;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>✓ Authentication Successful!</h1>
                <p>Strange Labs has connected your IDE workspace to developer account <span class="accent">${email}</span>.</p>
                <p>You can close this tab and return to your terminal.</p>
              </div>
            </body>
            </html>
          `);

          console.log(`\n🔑 Successfully authenticated as ${email}`);
          server.close();
          resolve(sessionData);
        } else {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Authentication failed: Missing tokens.");
        }
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.listen(PORT, () => {
      const loginUrl = `${LIVE_URL}/developer/login?callback=http://localhost:${PORT}/callback`;
      console.log("----------------------------------------------------------------");
      console.log("⚡ Strange Labs IDE Context Sync");
      console.log("----------------------------------------------------------------");
      console.log(`Opening browser to login: ${loginUrl}\n`);
      
      // Open browser
      const openCommand = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
      exec(`${openCommand} "${loginUrl}"`);
    });
  });
}

async function syncContext() {
  let session;

  // Check if session file exists
  if (fs.existsSync(SESSION_FILE)) {
    try {
      session = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
      // Simple verification check (does session object have access_token)
      if (!session.access_token) {
        throw new Error("Invalid session file");
      }
    } catch {
      session = await startLoginFlow();
    }
  } else {
    session = await startLoginFlow();
  }

  console.log("⏳ Fetching active project context and tasks from Supabase...");

  // Initialize Supabase client with the developer's session token
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });

  // Get user details
  const { data: { user }, error: userError } = await supabase.auth.getUser(session.access_token);
  if (userError || !user) {
    console.error("❌ Authentication session has expired or is invalid. Restarting login flow...");
    fs.unlinkSync(SESSION_FILE);
    await syncContext();
    return;
  }

  // Fetch developer profile to get hourly rate
  const { data: profile } = await supabase
    .from("profiles")
    .select("hourly_rate, full_name")
    .eq("id", user.id)
    .single();

  const hourlyRate = profile?.hourly_rate || 500;
  const devName = profile?.full_name || user.email;

  // Fetch tasks assigned to the developer
  // Supabase RLS will restrict these queries automatically
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*, projects(title, description, status, estimated_hours, estimated_cost)")
    .eq("assigned_developer_id", user.id)
    .neq("status", "completed");

  if (tasksError) {
    console.error("❌ Error fetching tasks:", tasksError.message);
    process.exit(1);
  }

  if (!tasks || tasks.length === 0) {
    console.log("✨ No active tasks assigned to you. Codebase context remains unchanged.");
    process.exit(0);
  }

  console.log(`\n📥 Found ${tasks.length} active task(s) assigned to ${devName}.`);

  // Write DEVELOPMENT_CONTEXT.md
  const devContextPath = path.join(process.cwd(), "DEVELOPMENT_CONTEXT.md");
  const cursorRuleDir = path.join(process.cwd(), ".cursor", "rules");
  const cursorRulePath = path.join(cursorRuleDir, "project-context.mdc");

  // Group tasks by project
  const projectsMap = {};
  tasks.forEach((task) => {
    const projId = task.project_id;
    if (!projectsMap[projId]) {
      projectsMap[projId] = {
        title: task.projects?.title || "Untitled Project",
        description: task.projects?.description || "",
        status: task.projects?.status || "active",
        estimated_hours: task.projects?.estimated_hours || 0,
        estimated_cost: task.projects?.estimated_cost || 0,
        tasks: [],
      };
    }
    projectsMap[projId].tasks.push(task);
  });

  // Construct DEVELOPMENT_CONTEXT.md content
  let contextContent = `# Active Project Development Context\n`;
  contextContent += `Last Synced: ${new Date().toLocaleString("en-IN")}\n`;
  contextContent += `Developer: ${devName} (₹${hourlyRate}/hr)\n\n`;

  for (const [projId, proj] of Object.entries(projectsMap)) {
    contextContent += `## Project: ${proj.title}\n`;
    contextContent += `- **Status:** \`${proj.status}\`\n`;
    contextContent += `- **Scoped Hours:** ${proj.estimated_hours}h\n`;
    contextContent += `- **Budget Check:** ₹${proj.estimated_cost.toLocaleString("en-IN")}\n\n`;
    
    contextContent += `### Scoped Brief\n${proj.description}\n\n`;
    
    contextContent += `### Your Assigned Tasks\n`;
    proj.tasks.forEach((t) => {
      const statusIcon = t.status === "in_progress" ? "/" : " ";
      contextContent += `- [${statusIcon}] **${t.title}** - ${t.description || "No details provided."}\n`;
    });
    contextContent += `\n---\n\n`;
  }

  fs.writeFileSync(devContextPath, contextContent);
  console.log(`📝 Generated: ${devContextPath}`);

  // Ensure directories exist for .cursor/rules
  if (!fs.existsSync(cursorRuleDir)) {
    fs.mkdirSync(cursorRuleDir, { recursive: true });
  }

  // Construct .cursor/rules/project-context.mdc content
  const firstProject = Object.values(projectsMap)[0];
  const cursorRuleContent = `---
description: Custom project context rule updated by Strange Labs Sync Script.
globs: *
---
# Strange Labs Project Context
You are coding on tasks assigned to **${devName}** in the Strange Labs workspace.

## Active Projects Summary
${Object.entries(projectsMap).map(([id, p]) => `- **${p.title}** (Status: ${p.status}, Scoped: ${p.estimated_hours} hours)`).join("\n")}

Refer to [DEVELOPMENT_CONTEXT.md](file://${devContextPath}) for active checklists and briefs.
`;

  fs.writeFileSync(cursorRulePath, cursorRuleContent);
  console.log(`📝 Generated: ${cursorRulePath}`);
  console.log(`\n✅ Workspace successfully synchronized! Your IDE agent now has full context of client goals.`);
}

syncContext().catch((err) => {
  console.error("❌ Sync failed:", err);
});

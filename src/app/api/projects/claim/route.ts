import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    // Initialize user-specific Supabase client using their JWT token
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Validate the token and get user
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error("Token verification failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get developer profile and verify role
    const { data: developerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", user.id)
      .single();

    if (profileError || !developerProfile) {
      console.error("Profile fetch error:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (developerProfile.role !== "developer") {
      return NextResponse.json({ error: "Forbidden: Only developers can claim projects" }, { status: 403 });
    }

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing project ID" }, { status: 400 });
    }

    // Fetch project context
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("*, tasks(*)")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found error:", projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.assigned_developer_id) {
      return NextResponse.json({ error: "Project is already claimed by another developer" }, { status: 400 });
    }

    // Update the project to assign it to this developer
    const { error: updateProjectError } = await supabaseAdmin
      .from("projects")
      .update({ assigned_developer_id: user.id })
      .eq("id", projectId);

    if (updateProjectError) {
      console.error("Failed to assign project:", updateProjectError);
      return NextResponse.json({ error: "Failed to claim project" }, { status: 500 });
    }

    // Assign all tasks in the project to this developer
    const { error: updateTasksError } = await supabaseAdmin
      .from("tasks")
      .update({ assigned_developer_id: user.id })
      .eq("project_id", projectId);

    if (updateTasksError) {
      console.error("Failed to assign tasks:", updateTasksError);
      // Don't fail the request — the project itself was claimed successfully
    }

    // Update local workspace documentation files for IDE Sync (if running locally)
    try {
      const workspacePath = "/home/jith/Projects";
      if (fs.existsSync(workspacePath)) {
        const devContextPath = path.join(workspacePath, "DEVELOPMENT_CONTEXT.md");
        const cursorRuleDir = path.join(workspacePath, ".cursor", "rules");
        const cursorRulePath = path.join(cursorRuleDir, "project-context.mdc");

        const contextContent = `# Active Project Development Context
Last Updated: ${new Date().toISOString()}
Project ID: ${projectId}
Project Title: ${project.title}
Developer Assigned: ${developerProfile.full_name} (${developerProfile.email})

## Project Description
${project.description || "No description provided."}

## AI Budget Outlook
${project.budget_outlook || "No budget outlook generated."}

## Tasks Checklist
${(project.tasks || []).map((t: any) => `- [ ] ${t.title} - ${t.description || "No description"}`).join("\n")}
`;
        fs.writeFileSync(devContextPath, contextContent);

        if (!fs.existsSync(cursorRuleDir)) {
          fs.mkdirSync(cursorRuleDir, { recursive: true });
        }

        const cursorRuleContent = `---
description: Custom project context rule updated by Strange Labs AI Project Manager.
globs: *
---
# Strange Labs Project Context
You are currently coding on the project **${project.title}** (${projectId}) under the **Strange Labs** platform.

## Current Context
- **Assigned Developer:** ${developerProfile.full_name}
- **Hours Range:** ${project.estimated_hours_min} - ${project.estimated_hours_max} hours
- **Cost Range:** ₹${project.estimated_cost_min} - ₹${project.estimated_cost_max}
- **AI Budget Outlook:** ${project.budget_outlook?.substring(0, 150)}...

Refer to [DEVELOPMENT_CONTEXT.md](file:///home/jith/Projects/DEVELOPMENT_CONTEXT.md) for the active checklist and requirements.
`;
        fs.writeFileSync(cursorRulePath, cursorRuleContent);
      }
    } catch (fsError) {
      console.warn("Could not write local workspace files:", fsError);
    }

    // Send email notification to client
    try {
      if (project.client_id) {
        const { data: clientProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", project.client_id)
          .single();

        if (clientProfile && clientProfile.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const subject = `Strange Labs: Project Claimed by Developer - ${project.title}`;
          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #6366f1;">Strange Labs: Developer Assigned!</h2>
              <p>Hi ${clientProfile.full_name || "Client User"},</p>
              <p>We wanted to let you know that a developer has claimed your project and linked their IDE: <strong>${project.title}</strong>.</p>
              
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #111827;">Project & Developer Details</h3>
                <p style="color: #4b5563; font-size: 14px; margin: 5px 0;"><strong>Project:</strong> ${project.title}</p>
                <p style="color: #4b5563; font-size: 14px; margin: 5px 0;"><strong>Assigned Developer:</strong> ${developerProfile.full_name} (${developerProfile.email})</p>
                <p style="color: #4b5563; font-size: 14px; margin: 5px 0;"><strong>Status:</strong> Synced & Active in IDE</p>
              </div>

              <p>The developer is now starting work. You can log in to your dashboard to monitor logged hours and chat with your AI Project Manager to track progress.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/dashboard" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Progress</a>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">Strange Labs &copy; 2026. Built by jstrange.</p>
            </div>
          `;
          await sendEmail({ to: clientProfile.email, subject, html });
        }
      }
    } catch (emailError) {
      console.error("Failed to send claim email notification:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Secure project claim error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

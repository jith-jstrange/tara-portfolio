import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";

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
      return NextResponse.json({ error: "Forbidden: Only developers can claim tasks" }, { status: 403 });
    }

    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: "Missing task ID" }, { status: 400 });
    }

    // Fetch task and project context
    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("*, projects(title, client_id)")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      console.error("Task not found error:", taskError);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.assigned_developer_id) {
      return NextResponse.json({ error: "Task is already claimed by another developer" }, { status: 400 });
    }

    // Update the task to assign it to this developer
    const { error: updateError } = await supabaseAdmin
      .from("tasks")
      .update({ assigned_developer_id: user.id })
      .eq("id", taskId);

    if (updateError) {
      console.error("Failed to assign task:", updateError);
      return NextResponse.json({ error: "Failed to claim task" }, { status: 500 });
    }

    // Send email notification to client
    try {
      const projectObj = task.projects as any;
      if (projectObj && projectObj.client_id) {
        const { data: clientProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", projectObj.client_id)
          .single();

        if (clientProfile && clientProfile.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const subject = `Strange Labs: Task Claimed by Developer for ${projectObj.title}`;
          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #6366f1;">Strange Labs: Developer Assigned!</h2>
              <p>Hi ${clientProfile.full_name || "Client User"},</p>
              <p>We wanted to let you know that a developer has claimed a task for your project: <strong>${projectObj.title}</strong>.</p>
              
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #111827;">Task & Developer Details</h3>
                <p style="color: #4b5563; font-size: 14px; margin: 5px 0;"><strong>Task:</strong> ${task.title}</p>
                ${task.description ? `<p style="color: #4b5563; font-size: 14px; margin: 5px 0;"><strong>Description:</strong> ${task.description}</p>` : ""}
                <p style="color: #4b5563; font-size: 14px; margin: 5px 0;"><strong>Assigned Developer:</strong> ${developerProfile.full_name} (${developerProfile.email})</p>
              </div>

              <p>The developer is now starting work on this task. You can log in to your dashboard to monitor developer tasks, logged hours, and track progress.</p>
              
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
    console.error("Secure task claim error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

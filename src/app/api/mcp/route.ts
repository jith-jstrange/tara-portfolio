import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.split(" ")[1];

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    // Authenticate developer via their API key
    const { data: developer, error: authError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, hourly_rate")
      .eq("api_key", apiKey)
      .single();

    if (authError || !developer) {
      return NextResponse.json({ error: "Invalid API key or unauthorized" }, { status: 401 });
    }

    if (developer.role !== "developer") {
      return NextResponse.json({ error: "Forbidden: Only developers can access MCP features" }, { status: 403 });
    }

    const { action, params } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    switch (action) {
      case "get_active_project": {
        // Fetch active project assigned to this developer
        const { data: project, error } = await supabaseAdmin
          .from("projects")
          .select("*")
          .eq("assigned_developer_id", developer.id)
          .neq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("MCP get_active_project error:", error);
          return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ project });
      }

      case "list_tasks": {
        // Fetch tasks of the developer's active project
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("id")
          .eq("assigned_developer_id", developer.id)
          .neq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!project) {
          return NextResponse.json({ tasks: [] });
        }

        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: true });

        if (error) {
          return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({ tasks });
      }

      case "log_heartbeat": {
        const { taskId, activeMinutes } = params || {};
        if (!taskId || !activeMinutes) {
          return NextResponse.json({ error: "Missing required params: taskId and activeMinutes" }, { status: 400 });
        }

        const hoursLogged = Number((activeMinutes / 60).toFixed(4)); // convert minutes to fraction of hours

        // Fetch task to make sure it belongs to an active project for this developer
        const { data: task, error: taskFetchError } = await supabaseAdmin
          .from("tasks")
          .select("*, projects(id, assigned_developer_id)")
          .eq("id", taskId)
          .single();

        if (taskFetchError || !task) {
          return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const projObj = task.projects as any;
        if (projObj?.assigned_developer_id !== developer.id) {
          return NextResponse.json({ error: "Forbidden: You are not assigned to this project" }, { status: 403 });
        }

        // Insert time log
        const { error: logError } = await supabaseAdmin
          .from("time_logs")
          .insert({
            task_id: taskId,
            developer_id: developer.id,
            hours: hoursLogged,
            description: "Automatic IDE active coding heartbeat sync",
          });

        if (logError) {
          console.error("MCP time_log insert error:", logError);
          return NextResponse.json({ error: "Failed to insert time log" }, { status: 500 });
        }

        // Increment tasks table logged_hours
        const newLoggedHours = Number(task.logged_hours || 0) + hoursLogged;
        const { error: taskUpdateError } = await supabaseAdmin
          .from("tasks")
          .update({ logged_hours: newLoggedHours })
          .eq("id", taskId);

        if (taskUpdateError) {
          console.error("MCP task update error:", taskUpdateError);
        }

        return NextResponse.json({
          success: true,
          addedHours: hoursLogged,
          totalLoggedHours: newLoggedHours,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("MCP Route API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// GET: CLI polls to check session approval status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");

    if (!session) {
      return NextResponse.json({ error: "Missing session token parameter" }, { status: 400 });
    }

    const { data: sessionData, error } = await supabaseAdmin
      .from("mcp_sessions")
      .select("*, profiles(api_key)")
      .eq("session_token", session)
      .single();

    if (error || !sessionData) {
      return NextResponse.json({ approved: false, error: "Session not found" }, { status: 404 });
    }

    if (sessionData.status === "approved") {
      const profile = sessionData.profiles as any;
      return NextResponse.json({
        approved: true,
        apiKey: profile?.api_key || null,
      });
    }

    return NextResponse.json({ approved: false });
  } catch (error: any) {
    console.error("MCP Auth GET error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST: Developer approves connection from browser dashboard
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionToken } = await request.json();

    if (!sessionToken) {
      return NextResponse.json({ error: "Missing sessionToken" }, { status: 400 });
    }

    // Check if session exists (or create it if it doesn't)
    const { data: existingSession } = await supabaseAdmin
      .from("mcp_sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (existingSession) {
      // Update existing session
      const { error: updateError } = await supabaseAdmin
        .from("mcp_sessions")
        .update({
          developer_id: user.id,
          status: "approved"
        })
        .eq("session_token", sessionToken);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // Create session directly as approved
      const { error: insertError } = await supabaseAdmin
        .from("mcp_sessions")
        .insert({
          session_token: sessionToken,
          developer_id: user.id,
          status: "approved"
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Double check that the developer profile has an API key
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("api_key")
      .eq("id", user.id)
      .single();

    if (profile && !profile.api_key) {
      const newApiKey = `sl_dev_${Buffer.from(crypto.randomUUID()).toString("hex").substring(0, 32)}`;
      await supabaseAdmin
        .from("profiles")
        .update({ api_key: newApiKey })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("MCP Auth POST error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

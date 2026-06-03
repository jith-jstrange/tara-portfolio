import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabase";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { message, projectId, chatHistory } = await request.json();

    if (!message || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: message and projectId are required" },
        { status: 400 }
      );
    }

    // Fetch project details with associated tasks
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("*, tasks(*)")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Build project context for the system prompt
    const tasksSummary = project.tasks?.length
      ? project.tasks
          .map(
            (t: any) =>
              `- [${t.status}] ${t.title}: ${t.description || "No description"}${t.logged_hours ? ` (${t.logged_hours}h logged)` : ""}`
          )
          .join("\n")
      : "No tasks created yet.";

    const systemPrompt = `You are the Strange Labs AI Project Manager — a professional, knowledgeable, and friendly virtual PM built into the Strange Labs freelance platform.

## Your Knowledge
- Kerala web developer pricing: Junior developers ₹300-500/hr, Senior developers ₹800-1500/hr.
- Token markup rates: Input ₹1/10k tokens, Output ₹3/10k tokens.
- All estimates include a 10% platform buffer.

## Current Project Context
- **Project ID:** ${project.id}
- **Title:** ${project.title}
- **Status:** ${project.status}
- **Description:** ${project.description || "Not provided"}
- **Estimated Hours:** ${project.estimated_hours ?? "Not yet estimated"}
- **Estimated Cost:** ${project.estimated_cost ? `₹${project.estimated_cost}` : "Not yet estimated"}
- **Created:** ${project.created_at}

## Tasks
${tasksSummary}

## Guidelines
- Always respond in the context of this specific project.
- You can discuss project progress, timelines, billing, technical decisions, and scope.
- Be concise but thorough. Use bullet points or structured responses when appropriate.
- If asked about costs, base calculations on Kerala developer rates above.
- If the project status is "pending_estimation", encourage the client to submit for AI estimation.
- Never fabricate data — if information isn't available in the project context, say so.
- Be professional but approachable. Use a warm, collaborative tone.`;

    // Build conversation contents for Gemini
    const contents = [
      // Include chat history if provided
      ...(Array.isArray(chatHistory)
        ? chatHistory.map((msg: { role: string; content: string }) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }))
        : []),
      // Add the new user message
      {
        role: "user" as const,
        parts: [{ text: message }],
      },
    ];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({
      contents,
    });

    const reply = result.response.text();

    // Extract token usage
    const promptTokens =
      result.response.usageMetadata?.promptTokenCount || 0;
    const completionTokens =
      result.response.usageMetadata?.candidatesTokenCount || 0;

    // Cost calculation (Kerala markup standards)
    // Input: ₹1/10k tokens, Output: ₹3/10k tokens
    const costInr =
      (promptTokens * 1) / 10000 + (completionTokens * 3) / 10000;

    // Log token usage to Supabase
    const { error: tokenLogError } = await supabaseAdmin
      .from("token_logs")
      .insert({
        project_id: projectId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_inr: costInr,
      });

    if (tokenLogError) {
      console.error("Token logging error:", tokenLogError);
    }

    return NextResponse.json({
      reply,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        cost: costInr,
      },
    });
  } catch (error: any) {
    console.error("AI Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabase";
import * as fs from "fs";
import * as path from "path";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { message, projectId } = await request.json();

    if (!message || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: message and projectId are required" },
        { status: 400 }
      );
    }

    // 1. Fetch project details with associated tasks
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

    // 2. Insert new user message into DB
    const { error: userMsgError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        project_id: projectId,
        role: "user",
        content: message
      });

    if (userMsgError) {
      console.error("Failed to insert user message in DB:", userMsgError);
    }

    // 3. Fetch past chat history for this project from DB
    const { data: dbMessages } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

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
- Kerala web developer pricing: Junior developers ₹250-400/hr, Senior developers ₹700-1000/hr.
- Token markup rates: Input ₹1/10k tokens, Output ₹3/10k tokens.
- All estimates include a 10% platform buffer.

## Current Project Context
- **Project ID:** ${project.id}
- **Title:** ${project.title}
- **Status:** ${project.status}
- **Description:** ${project.description || "Not provided"}
- **Estimated Hours:** ${project.estimated_hours_min ? `${project.estimated_hours_min}-${project.estimated_hours_max}` : "Not yet estimated"}
- **Estimated Cost:** ${project.estimated_cost_min ? `₹${project.estimated_cost_min}-₹${project.estimated_cost_max}` : "Not yet estimated"}
- **Budget Target:** ${project.client_budget ? `₹${project.client_budget}` : "Not specified"}
- **AI Budget Outlook:** ${project.budget_outlook || "None"}

## Tasks
${tasksSummary}

## Conversational Scoping Guidelines
1. If the project status is "pending_estimation" (this is a draft project for scoping):
   - Guide the client through describing their project. Ask about their budget target, preferred category, and required features.
   - Keep it friendly, simple (suitable for a 10th-grade student), and ask only one or two clarifying questions at a time.
   - Once you have enough details, OR when the client explicitly asks for an estimate, you MUST generate a detailed project estimate.
   - To output an estimate, append a structured JSON block at the very end of your response enclosed inside \`[ESTIMATE_START]\` and \`[ESTIMATE_END]\` tags.
2. If the client asks to adjust a project (even an estimated or active one), you can output a new estimate block to recalculate the hours/costs.
3. The estimate block MUST be formatted exactly like this:
   \`\`\`
   [ESTIMATE_START]
   {
     "title": "A refined, professional name for the project",
     "category": "web_app" | "crm_saas" | "mobile_app" | "blog_wp",
     "developerGrade": "junior" | "senior",
     "clientBudget": number,
     "minHours": number,
     "maxHours": number,
     "tasks": [
       { "title": "Task title", "description": "Task description" }
     ],
     "projectSummary": "A high-level implementation plan summary",
     "budgetOutlook": "A simple, high-school friendly evaluation of budget sufficiency against Kerala junior/senior developer rates."
   }
   [ESTIMATE_END]
   \`\`\`
4. Ensure the JSON is valid and strict. Do not add formatting inside the JSON itself.`;

    // 4. Build conversation contents for Gemini
    const contents = (dbMessages || []).map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({
      contents,
    });

    let reply = result.response.text();

    // Extract token usage
    const promptTokens = result.response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
    const costInr = (promptTokens * 1) / 10000 + (completionTokens * 3) / 10000;

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

    // Check for inline estimate block
    let estimateData = null;
    const estimateStartTag = "[ESTIMATE_START]";
    const estimateEndTag = "[ESTIMATE_END]";

    if (reply.includes(estimateStartTag) && reply.includes(estimateEndTag)) {
      try {
        const startIndex = reply.indexOf(estimateStartTag) + estimateStartTag.length;
        const endIndex = reply.indexOf(estimateEndTag);
        const jsonString = reply.substring(startIndex, endIndex).trim();
        const parsed = JSON.parse(jsonString);

        // Calibrate cost ranges based on developer grade and Kerala rates
        const rateMin = parsed.developerGrade === "senior" ? 700 : 250;
        const rateMax = parsed.developerGrade === "senior" ? 1000 : 400;

        const baseCostMin = parsed.minHours * rateMin;
        const baseCostMax = parsed.maxHours * rateMax;
        const platformBufferMin = baseCostMin * 0.10;
        const platformBufferMax = baseCostMax * 0.10;

        const totalCostMin = Math.round(baseCostMin + platformBufferMin + costInr);
        const totalCostMax = Math.round(baseCostMax + platformBufferMax + costInr);

        // Update database project details
        const { error: projectUpdateError } = await supabaseAdmin
          .from("projects")
          .update({
            title: parsed.title,
            status: "estimated",
            client_budget: parsed.clientBudget || 0,
            estimated_hours_min: parsed.minHours,
            estimated_hours_max: parsed.maxHours,
            estimated_cost_min: totalCostMin,
            estimated_cost_max: totalCostMax,
            estimated_hours: parsed.maxHours, // fallback
            estimated_cost: totalCostMax, // fallback
            budget_outlook: parsed.budgetOutlook,
            description: parsed.projectSummary
          })
          .eq("id", projectId);

        if (!projectUpdateError) {
          // Delete old tasks if any (for re-estimations)
          await supabaseAdmin
            .from("tasks")
            .delete()
            .eq("project_id", projectId);

          // Insert new tasks
          const tasksToInsert = parsed.tasks.map((task: any) => ({
            project_id: projectId,
            title: task.title,
            description: task.description,
            status: "todo"
          }));

          await supabaseAdmin.from("tasks").insert(tasksToInsert);

          // Update IDE workspace documentation files (Sync)
          try {
            const workspacePath = "/home/jith/Projects";
            if (fs.existsSync(workspacePath)) {
              const devContextPath = path.join(workspacePath, "DEVELOPMENT_CONTEXT.md");
              const cursorRuleDir = path.join(workspacePath, ".cursor", "rules");
              const cursorRulePath = path.join(cursorRuleDir, "project-context.mdc");

              const contextContent = `# Active Project Development Context
Last Updated: ${new Date().toISOString()}
Project ID: ${projectId}
Project Title: ${parsed.title}
Developer Grade model: Kerala Standard (₹${rateMin}-₹${rateMax}/hr)

## Project Overview
${parsed.projectSummary}

## AI Budget Outlook
${parsed.budgetOutlook}

## Tasks Checklist
${parsed.tasks.map((t: any) => `- [ ] ${t.title} - ${t.description}`).join("\n")}
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
You are currently coding on the project **${parsed.title}** (${projectId}) under the **Strange Labs** platform.

## Current Context
- **Hours Range:** ${parsed.minHours} - ${parsed.maxHours} hours
- **Cost Range:** ₹${totalCostMin} - ₹${totalCostMax}
- **AI Budget Outlook:** ${parsed.budgetOutlook.substring(0, 150)}...

Refer to [DEVELOPMENT_CONTEXT.md](file:///home/jith/Projects/DEVELOPMENT_CONTEXT.md) for the active checklist and requirements.
`;
              fs.writeFileSync(cursorRulePath, cursorRuleContent);
            }
          } catch (fsError) {
            console.warn("Could not write local workspace files:", fsError);
          }

          // Structure the parsed estimate results for the frontend
          estimateData = {
            title: parsed.title,
            category: parsed.category,
            developerGrade: parsed.developerGrade,
            clientBudget: parsed.clientBudget,
            estimatedHoursMin: parsed.minHours,
            estimatedHoursMax: parsed.maxHours,
            estimatedCostMin: totalCostMin,
            estimatedCostMax: totalCostMax,
            projectSummary: parsed.projectSummary,
            budgetOutlook: parsed.budgetOutlook,
            tasks: parsed.tasks
          };
        } else {
          console.error("Error updating project in chat scoping:", projectUpdateError);
        }
      } catch (jsonErr) {
        console.error("Failed to parse estimate JSON block:", jsonErr);
      }

      // Strip the estimate JSON block from the text response
      reply = reply.split(estimateStartTag)[0] + "\n*(See the interactive scoping details card below)*";
    }

    // 5. Save assistant reply to DB
    const { error: asstMsgError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        project_id: projectId,
        role: "assistant",
        content: reply
      });

    if (asstMsgError) {
      console.error("Failed to insert assistant reply in DB:", asstMsgError);
    }

    return NextResponse.json({
      reply,
      estimate: estimateData,
      projectId,
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

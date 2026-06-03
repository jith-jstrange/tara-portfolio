import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabase";
import * as fs from "fs";
import * as path from "path";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { projectId, description, developerGrade } = await request.json();

    if (!projectId || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine hourly rate based on Kerala standards (junior vs senior/jstrange)
    // Junior: ₹300 - ₹500, Senior: ₹800 - ₹1500
    const hourlyRate = developerGrade === "senior" ? 1200 : 400;

    const systemPrompt = `
      You are an expert AI software architect and technical project manager.
      Analyze the project description and break it down into:
      1. An implementation plan overview.
      2. A structured list of tasks (with titles and descriptions).
      3. An estimation of hours required (separated into junior tasks and senior tasks).
      
      You must respond in STICT JSON format. No markdown blocks, no extra text.
      JSON structure:
      {
        "estimatedHours": number,
        "tasks": [
          {
            "title": "string",
            "description": "string",
            "recommendedDeveloper": "junior" | "senior"
          }
        ],
        "projectSummary": "string"
      }
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `Project Description: ${description}` }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    // Extract token details
    const promptTokens = result.response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
    
    // Cost calculation (Kerala markup standards)
    // Input: ₹1/10k tokens, Output: ₹3/10k tokens
    const costInr = (promptTokens * 1 / 10000) + (completionTokens * 3 / 10000);

    // Compute estimated cost: Hours * rate + 10% platform buffer + token cost
    const baseCost = parsedData.estimatedHours * hourlyRate;
    const platformBuffer = baseCost * 0.10;
    const totalEstimatedCost = Math.round(baseCost + platformBuffer + costInr);

    // Log tokens to Supabase
    const { error: tokenLogError } = await supabaseAdmin
      .from("token_logs")
      .insert({
        project_id: projectId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_inr: costInr
      });

    if (tokenLogError) {
      console.error("Token logging error:", tokenLogError);
    }

    // Update project with estimates
    const { error: projectUpdateError } = await supabaseAdmin
      .from("projects")
      .update({
        status: "estimated",
        estimated_hours: parsedData.estimatedHours,
        estimated_cost: totalEstimatedCost,
        description: `${description}\n\n=== AI Project Scope ===\n${parsedData.projectSummary}`
      })
      .eq("id", projectId);

    if (projectUpdateError) {
      return NextResponse.json({ error: projectUpdateError.message }, { status: 500 });
    }

    // Insert tasks into tasks table
    const tasksToInsert = parsedData.tasks.map((task: any) => ({
      project_id: projectId,
      title: task.title,
      description: task.description,
      status: "todo"
    }));

    const { error: tasksInsertError } = await supabaseAdmin
      .from("tasks")
      .insert(tasksToInsert);

    if (tasksInsertError) {
      console.error("Tasks insertion error:", tasksInsertError);
    }

    // Update IDE workspace documentation files if running locally
    try {
      const workspacePath = "/home/jith/Projects";
      if (fs.existsSync(workspacePath)) {
        const devContextPath = path.join(workspacePath, "DEVELOPMENT_CONTEXT.md");
        const cursorRuleDir = path.join(workspacePath, ".cursor", "rules");
        const cursorRulePath = path.join(cursorRuleDir, "project-context.mdc");

        // Write DEVELOPMENT_CONTEXT.md
        const contextContent = `# Active Project Development Context
Last Updated: ${new Date().toISOString()}
Project ID: ${projectId}
Developer Rate Model: Kerala Standard (₹${hourlyRate}/hr)

## Project Overview
${description}

## AI Scope & Implementation Plan
${parsedData.projectSummary}

## Tasks Checklist
${parsedData.tasks.map((t: any) => `- [ ] ${t.title} (${t.recommendedDeveloper} developer) - ${t.description}`).join("\n")}
`;
        fs.writeFileSync(devContextPath, contextContent);

        // Ensure directories exist for .cursor/rules
        if (!fs.existsSync(cursorRuleDir)) {
          fs.mkdirSync(cursorRuleDir, { recursive: true });
        }

        // Write .cursor/rules/project-context.mdc
        const cursorRuleContent = `---
description: Custom project context rule updated by Strange Labs AI Project Manager.
globs: *
---
# Strange Labs Project Context
You are currently coding on the project **${projectId}** under the **Strange Labs** platform.

## Current Context
- **Description:** ${description.substring(0, 200)}...
- **Hours Scoped:** ${parsedData.estimatedHours} hours
- **Developer Grade:** ${developerGrade} (₹${hourlyRate}/hr)

Refer to [DEVELOPMENT_CONTEXT.md](file:///home/jith/Projects/DEVELOPMENT_CONTEXT.md) for the active checklist and requirements.
`;
        fs.writeFileSync(cursorRulePath, cursorRuleContent);
      }
    } catch (fsError) {
      console.warn("Could not write local workspace files (likely running in production):", fsError);
    }

    return NextResponse.json({
      success: true,
      estimatedHours: parsedData.estimatedHours,
      estimatedCost: totalEstimatedCost,
      tasks: parsedData.tasks,
      projectSummary: parsedData.projectSummary
    });

  } catch (error: any) {
    console.error("Estimation API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

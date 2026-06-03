import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabase";
import * as fs from "fs";
import * as path from "path";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { projectId, description, developerGrade, clientBudget } = await request.json();

    if (!projectId || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine hourly rate range based on Kerala standards
    // Junior: ₹250 - ₹400, Senior: ₹700 - ₹1000
    const rateMin = developerGrade === "senior" ? 700 : 250;
    const rateMax = developerGrade === "senior" ? 1000 : 400;

    const budgetText = clientBudget 
      ? `The client's budget for this project is ₹${Number(clientBudget).toLocaleString("en-IN")}.` 
      : "No budget was specified by the client.";

    const systemPrompt = `
      You are an expert AI software architect and technical project manager for Strange Labs.
      Analyze the project description and the client's budget context.
      
      Client Budget Context: ${budgetText}

      Break the project down into:
      1. A high-level project summary plan.
      2. A structured list of tasks (with titles and descriptions).
      3. An estimation of hours required as a range (minHours and maxHours).
      4. A detailed "budgetOutlook". In this outlook:
         - Evaluate if the client's budget is sufficient, tight, or insufficient for the requested features.
         - Explain in a simple, friendly way (suitable for a high school student) what they can realistically expect to be built with their budget (e.g. the core MVP features).
         - Detail what features might need to be delayed or require extra budget.
         - If no budget was specified, suggest a standard, friendly budget range and what features that budget would cover.
      
      You must respond in STRICT JSON format. No markdown blocks, no extra text.
      JSON structure:
      {
        "minHours": number,
        "maxHours": number,
        "tasks": [
          {
            "title": "string",
            "description": "string",
            "recommendedDeveloper": "junior" | "senior"
          }
        ],
        "projectSummary": "string",
        "budgetOutlook": "string"
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

    // Compute estimated cost ranges: Hours * rate + 10% platform buffer + token cost
    const baseCostMin = parsedData.minHours * rateMin;
    const baseCostMax = parsedData.maxHours * rateMax;
    const platformBufferMin = baseCostMin * 0.10;
    const platformBufferMax = baseCostMax * 0.10;

    const totalEstimatedCostMin = Math.round(baseCostMin + platformBufferMin + costInr);
    const totalEstimatedCostMax = Math.round(baseCostMax + platformBufferMax + costInr);

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

    // Update project with estimates (saving min/max ranges and budget outlook)
    const { error: projectUpdateError } = await supabaseAdmin
      .from("projects")
      .update({
        status: "estimated",
        client_budget: clientBudget || 0,
        estimated_hours_min: parsedData.minHours,
        estimated_hours_max: parsedData.maxHours,
        estimated_cost_min: totalEstimatedCostMin,
        estimated_cost_max: totalEstimatedCostMax,
        estimated_hours: parsedData.maxHours, // fallback for legacy
        estimated_cost: totalEstimatedCostMax, // fallback for legacy
        budget_outlook: parsedData.budgetOutlook,
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
Developer Rate Model: Kerala Standard (₹${rateMin}-₹${rateMax}/hr)

## Project Overview
${description}

## AI Scope & Implementation Plan
${parsedData.projectSummary}

## AI Budget Outlook
${parsedData.budgetOutlook}

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
- **Hours Range:** ${parsedData.minHours} - ${parsedData.maxHours} hours
- **Developer Grade:** ${developerGrade} (₹${rateMin}-₹${rateMax}/hr)
- **AI Budget Outlook:** ${parsedData.budgetOutlook.substring(0, 150)}...

Refer to [DEVELOPMENT_CONTEXT.md](file:///home/jith/Projects/DEVELOPMENT_CONTEXT.md) for the active checklist and requirements.
`;
        fs.writeFileSync(cursorRulePath, cursorRuleContent);
      }
    } catch (fsError) {
      console.warn("Could not write local workspace files (likely running in production):", fsError);
    }

    return NextResponse.json({
      success: true,
      estimatedHoursMin: parsedData.minHours,
      estimatedHoursMax: parsedData.maxHours,
      estimatedCostMin: totalEstimatedCostMin,
      estimatedCostMax: totalEstimatedCostMax,
      tasks: parsedData.tasks,
      projectSummary: parsedData.projectSummary,
      budgetOutlook: parsedData.budgetOutlook
    });

  } catch (error: any) {
    console.error("Estimation API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

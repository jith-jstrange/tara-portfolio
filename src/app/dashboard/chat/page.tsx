"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  ChevronDown,
  Sparkles,
  MessageSquare,
  FileCheck,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  estimate?: any;
}

interface Project {
  id: string;
  title: string;
  status?: string;
  estimated_hours_min?: number;
  estimated_hours_max?: number;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  budget_outlook?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("new");
  const [activeProjectDetails, setActiveProjectDetails] = useState<Project | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchProjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("projects")
      .select("id, title, status, estimated_hours_min, estimated_hours_max, estimated_cost_min, estimated_cost_max, budget_outlook")
      .eq("client_id", session.user.id)
      .order("created_at", { ascending: false });

    const projectsList = [{ id: "new", title: "➕ New Project Scoping" }, ...(data || [])];
    setProjects(projectsList);
  }, []);

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId);
    setDropdownOpen(false);

    if (projectId === "new") {
      setMessages([
        {
          role: "assistant",
          content: "Hi! Tell me about the project you want to build. What is your idea? Mention features you need, and your target budget if you have one.",
          timestamp: new Date(),
        },
      ]);
      setActiveProjectDetails(null);
      return;
    }

    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (proj) {
      setActiveProjectDetails(proj);

      // Load chat history from DB
      const { data: dbHistory } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (dbHistory && dbHistory.length > 0) {
        setMessages(
          dbHistory.map((m) => ({
            role: m.role as any,
            content: m.content,
            timestamp: new Date(m.created_at),
          }))
        );
      } else {
        setMessages([
          {
            role: "assistant",
            content: `Welcome to your project "${proj.title}" workspace! Ask me about its status, estimates, or tell me if you'd like to adjust the features or budget.`,
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchProjects();
    };
    init();
  }, [fetchProjects]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Session expired. Please log in again.");
      return;
    }

    let targetProjectId = selectedProjectId;
    setLoading(true);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Append user message locally
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // 1. If it's a new scoping chat, create a draft project record first
      if (targetProjectId === "new") {
        const { data: draftProj, error: draftError } = await supabase
          .from("projects")
          .insert({
            title: "Conversational Scoping Project",
            status: "pending_estimation",
            client_id: session.user.id,
          })
          .select()
          .single();

        if (draftError || !draftProj) {
          throw new Error("Failed to initialize draft project: " + draftError?.message);
        }

        targetProjectId = draftProj.id;
        setSelectedProjectId(targetProjectId);
        setActiveProjectDetails(draftProj);

        // Add draft project to projects list dropdown
        setProjects((prev) => {
          const filtered = prev.filter((p) => p.id !== "new");
          return [{ id: "new", title: "➕ New Project Scoping" }, draftProj, ...filtered];
        });
      }

      // 2. Call the conversational PM Chat API
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          projectId: targetProjectId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process chat");
      }

      // Append assistant message
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
        estimate: data.estimate || undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If an estimate was created/updated, reload project details to reflect estimate status
      if (data.estimate) {
        const { data: updatedProj } = await supabase
          .from("projects")
          .select("*")
          .eq("id", targetProjectId)
          .single();
        if (updatedProj) {
          setActiveProjectDetails(updatedProj);
          // Update the title in the dropdown list
          setProjects((prev) =>
            prev.map((p) => (p.id === targetProjectId ? { ...p, title: updatedProj.title } : p))
          );
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I ran into an issue: " + err.message,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApproveProject = async () => {
    if (!activeProjectDetails) return;
    setApproving(true);
    try {
      const costMin = activeProjectDetails.estimated_cost_min || 0;

      const { error: projectError } = await supabase
        .from("projects")
        .update({ status: "active" })
        .eq("id", activeProjectDetails.id);

      if (projectError) throw projectError;

      const { error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          project_id: activeProjectDetails.id,
          amount: costMin,
          status: "unpaid",
        });

      if (invoiceError) throw invoiceError;

      // Reload project details
      const { data: updatedProj } = await supabase
        .from("projects")
        .select("*")
        .eq("id", activeProjectDetails.id)
        .single();

      if (updatedProj) {
        setActiveProjectDetails(updatedProj);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "🎉 Estimate approved! Your project is now active, and your initial invoice has been created. A notification has been dispatched to available developers to claim the project and connect their IDEs.",
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      alert("Failed to approve project: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] lg:h-screen">
      {/* Header with Project Selector */}
      <div className="shrink-0 px-5 py-3.5 border-b border-white/[0.06] bg-[#050505]/60 backdrop-blur-xl">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h1 className="text-sm font-semibold text-white font-[family-name:var(--font-display)]">
              AI Project Manager
            </h1>
          </div>

          {/* Project Dropdown */}
          <div className="relative">
            <button
              id="btn-project-selector"
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-gray-400 hover:text-white hover:border-white/15 transition-all"
            >
              <span className="truncate max-w-[180px]">
                {selectedProject?.title || "➕ New Project Scoping"}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#0a0a0a] border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden z-50"
                >
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProject(p.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors truncate ${
                        p.id === selectedProjectId
                          ? "text-indigo-400 bg-indigo-500/5"
                          : "text-gray-400"
                      }`}
                    >
                      {p.title}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
              )}

              <div className="flex flex-col gap-2 max-w-[75%]">
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-indigo-500/20 border border-indigo-500/20 text-white"
                      : "bg-white/[0.04] border border-white/[0.06] text-gray-300"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-indigo-300/50" : "text-gray-600"}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>

                {/* Inline Render of Scoping Estimate Card */}
                {msg.estimate && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md space-y-4"
                  >
                    <div className="flex items-center gap-2 text-indigo-400">
                      <FileCheck className="w-5 h-5 animate-pulse" />
                      <h3 className="text-sm font-semibold font-display">Conversational Estimate Generated</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          Hours Range
                        </div>
                        <div className="text-lg font-bold text-white mt-1">
                          {msg.estimate.estimatedHoursMin} - {msg.estimate.estimatedHoursMax} hrs
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <IndianRupee className="w-3.5 h-3.5 text-indigo-400" />
                          Estimated Cost
                        </div>
                        <div className="text-lg font-bold text-indigo-400 mt-1">
                          ₹{msg.estimate.estimatedCostMin.toLocaleString("en-IN")} - ₹{msg.estimate.estimatedCostMax.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-gray-300">AI Budget Outlook:</h4>
                      <p className="text-xs text-gray-400 leading-relaxed font-mono">{msg.estimate.budgetOutlook}</p>
                    </div>

                    {activeProjectDetails?.status === "estimated" && (
                      <button
                        type="button"
                        onClick={handleApproveProject}
                        disabled={approving}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50"
                      >
                        {approving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Approve Estimate & Start Project
                      </button>
                    )}
                  </motion.div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
              )}
            </motion.div>
          ))}

          {/* Dynamic bottom sticky card if project is estimated but card was scrolled up */}
          {activeProjectDetails?.status === "estimated" && !messages[messages.length - 1]?.estimate && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md space-y-4"
            >
              <div className="flex items-center gap-2 text-indigo-400">
                <FileCheck className="w-5 h-5" />
                <h3 className="text-sm font-semibold font-display">Active Scope Estimate</h3>
              </div>
              <p className="text-xs text-gray-400">
                This project has an active estimate. You can approve it to spawn the task checklist and let developers claim it.
              </p>
              <div className="flex justify-between text-xs text-gray-500 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <strong>Hours:</strong> {activeProjectDetails.estimated_hours_min} - {activeProjectDetails.estimated_hours_max} hrs
                </div>
                <div>
                  <strong>Cost Range:</strong> ₹{activeProjectDetails.estimated_cost_min?.toLocaleString("en-IN")} - ₹{activeProjectDetails.estimated_cost_max?.toLocaleString("en-IN")}
                </div>
              </div>
              <button
                type="button"
                onClick={handleApproveProject}
                disabled={approving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Approve Estimate & Start Project
              </button>
            </motion.div>
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="flex gap-3 items-start"
              >
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-2 focus-within:border-indigo-500/30 transition-all">
            <textarea
              ref={textareaRef}
              id="chat-input"
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedProjectId === "new" ? "Describe your new project idea..." : "Ask about this project..."}
              className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm resize-none focus:outline-none py-1.5 max-h-[150px]"
            />
            <motion.button
              id="btn-send-chat"
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity mb-0.5"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
          <p className="text-[10px] text-gray-700 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  ChevronDown,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Project {
  id: string;
  title: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("client_id", session.user.id)
        .order("created_at", { ascending: false });

      const projectsList = data || [];
      setProjects(projectsList);
      if (projectsList.length > 0) {
        setSelectedProjectId(projectsList[0].id);
      }
    };

    fetchProjects();
  }, []);

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

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          projectId: selectedProjectId || undefined,
        }),
      });

      const data = await res.json();

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.reply || data.error || "I couldn't process your request.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
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
              <span className="truncate max-w-[140px]">
                {selectedProject?.title || "No project"}
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
                  {projects.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-600">No projects found</div>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors truncate ${
                          p.id === selectedProjectId
                            ? "text-indigo-400 bg-indigo-500/5"
                            : "text-gray-400"
                        }`}
                      >
                        {p.title}
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-white/[0.06] flex items-center justify-center mb-5">
                <MessageSquare className="w-7 h-7 text-indigo-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2 font-[family-name:var(--font-display)]">
                AI Project Manager
              </h2>
              <p className="text-gray-500 text-sm max-w-sm">
                Ask about your project scope, task breakdowns, timelines, or anything related to your development workflow.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {["What's my project status?", "Break down remaining tasks", "Estimate timeline"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setInput(q);
                      textareaRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-gray-400 hover:text-white hover:border-white/15 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

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

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
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

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
              )}
            </motion.div>
          ))}

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
              placeholder="Ask about your project..."
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

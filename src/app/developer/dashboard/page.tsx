"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import {
  ListChecks,
  Clock,
  IndianRupee,
  FolderOpen,
  Play,
  Loader2,
  CheckCircle2,
  Layers,
  Terminal,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// -- Types --
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed";
  logged_hours: number;
  project_id: string;
  assigned_developer_id: string | null;
  projects: { title: string; status: string } | null;
}

interface Stats {
  assignedTasks: number;
  hoursThisWeek: number;
  totalEarnings: number;
  activeProjects: number;
}

// -- Helpers --
const formatTime = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const statusColors: Record<string, string> = {
  todo: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

interface AvailableProject {
  id: string;
  title: string;
  description: string | null;
  estimated_hours_min: number;
  estimated_hours_max: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
}

export default function DeveloperDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Developer");
  const [hourlyRate, setHourlyRate] = useState(500);
  const [stats, setStats] = useState<Stats>({
    assignedTasks: 0,
    hoursThisWeek: 0,
    totalEarnings: 0,
    activeProjects: 0,
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [claimingProjectId, setClaimingProjectId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [generatingKey, setGeneratingKey] = useState(false);

  // API Key & Clipboard state
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const copyToClipboard = (text: string, type: "key" | "cmd") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
  };

  const loadDashboardData = useCallback(async (uid: string, rateVal: number) => {
    setLoadingTasks(true);

    // 1. Fetch assigned tasks where project belongs to developer
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("id, title, description, status, logged_hours, project_id, assigned_developer_id, projects!inner(title, status, assigned_developer_id)")
      .eq("projects.assigned_developer_id", uid)
      .neq("status", "completed")
      .order("created_at", { ascending: false });

    const fetchedTasks = (tasksData as unknown as Task[]) || [];
    setTasks(fetchedTasks);

    // 2. Fetch available unassigned projects (status = active, assigned_developer_id = null)
    const { data: availableProjectsData } = await supabase
      .from("projects")
      .select("id, title, description, estimated_hours_min, estimated_hours_max, estimated_cost_min, estimated_cost_max")
      .is("assigned_developer_id", null)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setAvailableProjects((availableProjectsData as AvailableProject[]) || []);

    // 3. Stats calculations
    const { count: totalAssigned } = await supabase
      .from("tasks")
      .select("id, projects!inner(assigned_developer_id)", { count: "exact", head: true })
      .eq("projects.assigned_developer_id", uid)
      .neq("status", "completed");

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: weekLogs } = await supabase
      .from("time_logs")
      .select("hours")
      .eq("developer_id", uid)
      .gte("created_at", weekAgo.toISOString());

    const hoursThisWeek = (weekLogs || []).reduce((sum, l) => sum + Number(l.hours), 0);

    const { data: allLogs } = await supabase
      .from("time_logs")
      .select("hours")
      .eq("developer_id", uid);

    const totalHours = (allLogs || []).reduce((sum, l) => sum + Number(l.hours), 0);
    const totalEarnings = totalHours * rateVal;

    const activeProjectIds = new Set(fetchedTasks.map((t) => t.project_id));

    setStats({
      assignedTasks: totalAssigned || 0,
      hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
      totalEarnings: Math.round(totalEarnings),
      activeProjects: activeProjectIds.size,
    });

    setLoadingTasks(false);
  }, []);

  // Fetch user + profile and API key
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const uid = session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, hourly_rate, api_key")
        .eq("id", uid)
        .single();

      const rateVal = profile?.hourly_rate || 500;
      setUserName(profile?.full_name || "Developer");
      setHourlyRate(rateVal);
      setApiKey(profile?.api_key || "");

      await loadDashboardData(uid, rateVal);
    };

    init();
  }, [loadDashboardData]);

  // Timer logic
  // Automatic time logs are synced via the local MCP server running in developer IDEs.
  // Task status update
  const updateTaskStatus = async (taskId: string, newStatus: "in_progress" | "completed") => {
    setUpdatingTask(taskId);
    try {
      await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);

      if (newStatus === "completed") {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setStats((prev) => ({
          ...prev,
          assignedTasks: Math.max(0, prev.assignedTasks - 1),
        }));
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    }
    setUpdatingTask(null);
  };

  // Claim unassigned project
  const claimProject = async (projectId: string) => {
    if (!userId) return;
    setClaimingProjectId(projectId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Session expired. Please log in again.");
        return;
      }

      const response = await fetch("/api/projects/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to claim project");
      }

      // Success, reload all dashboard data
      await loadDashboardData(userId, hourlyRate);
    } catch (err: any) {
      alert("Failed to claim project: " + err.message);
    } finally {
      setClaimingProjectId(null);
    }
  };

  // Generate / Rotate Developer API Key
  const generateApiKey = async () => {
    if (!userId) return;
    setGeneratingKey(true);
    try {
      // Generate a simple, secure randomized key
      const newKey = "sl_dev_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const { error } = await supabase
        .from("profiles")
        .update({ api_key: newKey })
        .eq("id", userId);

      if (error) throw error;
      setApiKey(newKey);
    } catch (err: any) {
      alert("Failed to generate API Key: " + err.message);
    } finally {
      setGeneratingKey(false);
    }
  };


  const statCards = [
    {
      id: "stat-assigned",
      label: "Assigned Tasks",
      value: stats.assignedTasks,
      icon: <ListChecks className="w-5 h-5" />,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      id: "stat-hours",
      label: "Hours This Week",
      value: stats.hoursThisWeek,
      icon: <Clock className="w-5 h-5" />,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      id: "stat-earnings",
      label: "Total Earnings",
      value: `₹${stats.totalEarnings.toLocaleString("en-IN")}`,
      icon: <IndianRupee className="w-5 h-5" />,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    },
    {
      id: "stat-projects",
      label: "Active Projects",
      value: stats.activeProjects,
      icon: <FolderOpen className="w-5 h-5" />,
      color: "text-pink-400",
      bg: "bg-pink-500/10",
      border: "border-pink-500/20",
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
          Welcome back,{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {userName}
          </span>
        </h1>
        <p className="text-xs text-gray-500 mt-1 font-mono">
          strangelabs.online // developer dashboard
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <motion.div
            key={card.id}
            id={card.id}
            whileHover={{ scale: 1.02, y: -2 }}
            className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:border-white/10 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-9 h-9 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-white font-display">{card.value}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Tasks & Available Tasks Panels */}
        <div className="xl:col-span-2 space-y-6">
          {/* Active Tasks Board */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white font-display flex items-center space-x-2">
                <ListChecks className="w-4 h-4 text-purple-400" />
                <span>My Active Tasks</span>
              </h2>
              <span className="text-xs text-gray-500 font-mono">{tasks.length} tasks</span>
            </div>

            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-green-500/30 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-mono">No active tasks. Claim some below!</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{task.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {task.projects?.title || "Unknown Project"}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full border ${statusColors[task.status]}`}>
                        {statusLabels[task.status]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-[10px] text-gray-600 flex items-center space-x-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{task.logged_hours || 0}h logged</span>
                      </span>

                      <div className="flex items-center space-x-2">
                        {task.status === "todo" && (
                          <button
                            id={`task-start-${task.id}`}
                            type="button"
                            disabled={updatingTask === task.id}
                            onClick={() => updateTaskStatus(task.id, "in_progress")}
                            className="flex items-center space-x-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                          >
                            {updatingTask === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            <span>Start</span>
                          </button>
                        )}
                        {task.status === "in_progress" && (
                          <button
                            id={`task-complete-${task.id}`}
                            type="button"
                            disabled={updatingTask === task.id}
                            onClick={() => updateTaskStatus(task.id, "completed")}
                            className="flex items-center space-x-1 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                          >
                            {updatingTask === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            <span>Complete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Available Projects Board (NEW CLAIMS) */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white font-display flex items-center space-x-2">
                <Layers className="w-4 h-4 text-pink-400" />
                <span>Available Projects to Claim</span>
              </h2>
              <span className="text-xs text-gray-500 font-mono">{availableProjects.length} open</span>
            </div>

            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
                </div>
              ) : availableProjects.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-gray-600/30 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-mono">No available projects to claim right now.</p>
                </div>
              ) : (
                availableProjects.map((project) => (
                  <motion.div
                    key={`available-proj-${project.id}`}
                    layout
                    className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-white truncate">{project.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-gray-500 font-mono">
                        <span>Min Cost: ₹{project.estimated_cost_min?.toLocaleString("en-IN")}</span>
                        <span>Hours: {project.estimated_hours_min}-{project.estimated_hours_max}h</span>
                      </div>
                      {project.description && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">{project.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <motion.button
                        id={`btn-claim-project-${project.id}`}
                        type="button"
                        onClick={() => claimProject(project.id)}
                        disabled={claimingProjectId === project.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {claimingProjectId === project.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ListChecks className="w-3.5 h-3.5" />
                        )}
                        Claim Project & Sync IDE
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* IDE Integration Guide */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-base font-semibold text-white font-display flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>IDE Integration Guide</span>
              </h2>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-xs text-gray-400 leading-relaxed">
                Connect your local coding environment to automatically sync your files and track active coding time. Works with <strong className="text-white">Antigravity IDE</strong>, <strong className="text-white">Cursor</strong>, and <strong className="text-white">VS Code</strong>.
              </p>

              {/* API Key Management */}
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Developer API Key</span>
                </h3>
                
                {apiKey ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-gray-300 break-all select-all flex items-center justify-between">
                      <span className="truncate max-w-[180px]">{showApiKey ? apiKey : "••••••••••••••••••••••••••••••••"}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                          title={showApiKey ? "Hide Key" : "Show Key"}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(apiKey, "key")}
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                          title="Copy Key"
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400/80 font-mono">No active API key. Generate one to begin setup.</p>
                )}

                <button
                  type="button"
                  disabled={generatingKey}
                  onClick={generateApiKey}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {generatingKey ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  <span>{apiKey ? "Rotate / Regenerate API Key" : "Generate API Key"}</span>
                </button>
              </div>

              {/* Instructions Steps */}
              <div className="space-y-4 text-xs">
                <h3 className="font-semibold text-white">Setup Instructions</h3>
                
                <ol className="space-y-3 list-decimal list-inside text-gray-400">
                  <li className="leading-relaxed">
                    <span className="text-gray-300 font-medium">Claim a project</span> from the available list on the left.
                  </li>
                  <li className="leading-relaxed">
                    <span className="text-gray-300 font-medium">Open the workspace directory</span> of the project on your computer.
                  </li>
                  <li className="leading-relaxed">
                    <span className="text-gray-300 font-medium">Run the setup CLI script</span> inside your terminal in that workspace:
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 font-mono text-[11px] text-purple-300 break-all select-all flex items-center justify-between">
                        <span>node scripts/setup-mcp.js</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard("node scripts/setup-mcp.js", "cmd")}
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-2"
                          title="Copy Command"
                        >
                          {copiedCmd ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </li>
                  <li className="leading-relaxed">
                    <span className="text-gray-300 font-medium">Authorize connection:</span> The CLI will print a URL. Open it to link your IDE session automatically.
                  </li>
                </ol>
              </div>

              {/* Automatic hour notification banner */}
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400 flex gap-2.5 items-start">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-white">No Stopwatches Needed:</strong> Once connected, the local MCP server running inside your IDE tracks active coding time in the background and logs hours automatically.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

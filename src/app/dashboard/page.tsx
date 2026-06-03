"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import {
  FolderKanban,
  ListChecks,
  IndianRupee,
  FileWarning,
  Sparkles,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_hours: number;
  estimated_cost: number;
  created_at: string;
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  status: string;
  logged_hours: number;
  created_at: string;
  projects?: { title: string };
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
}

interface Stats {
  totalProjects: number;
  activeTasks: number;
  totalSpent: number;
  pendingInvoices: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 14 },
  },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending_estimation: { label: "Pending", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  estimated: { label: "Estimated", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  active: { label: "Active", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  completed: { label: "Completed", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
};

const taskStatusConfig: Record<string, { label: string; icon: typeof Clock }> = {
  todo: { label: "To Do", icon: Clock },
  in_progress: { label: "In Progress", icon: Loader2 },
  completed: { label: "Done", icon: CheckCircle2 },
};

export default function DashboardPage() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalProjects: 0,
    activeTasks: 0,
    totalSpent: 0,
    pendingInvoices: 0,
  });
  const [projectTaskCounts, setProjectTaskCounts] = useState<Record<string, { total: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);

  // New project form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateResult, setEstimateResult] = useState<{
    estimatedHours: number;
    estimatedCost: number;
    projectSummary: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (uid: string) => {
    // Fetch projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", uid)
      .order("created_at", { ascending: false });

    const projectsList = projectsData || [];
    setProjects(projectsList);

    // Fetch all tasks for user's projects
    const projectIds = projectsList.map((p) => p.id);
    let allTasks: Task[] = [];
    if (projectIds.length > 0) {
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*, projects(title)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      allTasks = tasksData || [];
    }

    // Compute task counts per project
    const counts: Record<string, { total: number; completed: number }> = {};
    allTasks.forEach((t) => {
      if (!counts[t.project_id]) counts[t.project_id] = { total: 0, completed: 0 };
      counts[t.project_id].total++;
      if (t.status === "completed") counts[t.project_id].completed++;
    });
    setProjectTaskCounts(counts);

    // Recent tasks (last 5)
    setRecentTasks(allTasks.slice(0, 5));

    // Fetch invoices
    let invoices: Invoice[] = [];
    if (projectIds.length > 0) {
      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("id, amount, status")
        .in("project_id", projectIds);
      invoices = invoiceData || [];
    }

    // Compute stats
    const totalSpent = invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const pendingInvoices = invoices.filter((i) => i.status === "unpaid").length;
    const activeTasks = allTasks.filter((t) => t.status !== "completed").length;

    setStats({
      totalProjects: projectsList.length,
      activeTasks,
      totalSpent,
      pendingInvoices,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const uid = session.user.id;
      setUserId(uid);
      setUserName(session.user.user_metadata?.full_name || "Client");
      await fetchDashboardData(uid);
    };
    init();
  }, [fetchDashboardData]);

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newTitle.trim() || !newDescription.trim()) return;

    setEstimating(true);
    setFormError(null);
    setEstimateResult(null);

    try {
      // Create the project first
      const { data: newProject, error: insertError } = await supabase
        .from("projects")
        .insert({
          title: newTitle.trim(),
          description: newDescription.trim(),
          client_id: userId,
          status: "pending_estimation",
        })
        .select()
        .single();

      if (insertError || !newProject) {
        setFormError(insertError?.message || "Failed to create project.");
        return;
      }

      // Call AI estimate API
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: newProject.id,
          description: newDescription.trim(),
          developerGrade: "senior",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Estimation failed.");
        return;
      }

      setEstimateResult({
        estimatedHours: data.estimatedHours,
        estimatedCost: data.estimatedCost,
        projectSummary: data.projectSummary,
      });

      setNewTitle("");
      setNewDescription("");

      // Refresh data
      await fetchDashboardData(userId);
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setEstimating(false);
    }
  };

  const statsCards = [
    { label: "Total Projects", value: stats.totalProjects, icon: FolderKanban, color: "text-indigo-400", glow: "from-indigo-500/10" },
    { label: "Active Tasks", value: stats.activeTasks, icon: ListChecks, color: "text-emerald-400", glow: "from-emerald-500/10" },
    { label: "Total Spent", value: `₹${stats.totalSpent.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-purple-400", glow: "from-purple-500/10" },
    { label: "Pending Invoices", value: stats.pendingInvoices, icon: FileWarning, color: "text-amber-400", glow: "from-amber-500/10" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl lg:text-3xl font-bold text-white font-[family-name:var(--font-display)] tracking-tight">
          Welcome back,{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {userName}
          </span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s your project overview</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 group"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${card.glow} to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold text-white font-[family-name:var(--font-display)]">
                  {card.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Submit New Project */}
      <motion.div variants={itemVariants}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)]">
              Submit New Project
            </h2>
          </div>

          <form onSubmit={handleEstimate} className="space-y-4">
            <div>
              <label htmlFor="project-title" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Project Title
              </label>
              <input
                id="project-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., E-commerce Platform"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>

            <div>
              <label htmlFor="project-description" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Project Description
              </label>
              <textarea
                id="project-description"
                required
                rows={4}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe your project requirements, features, tech stack preferences..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
              />
            </div>

            {formError && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {estimateResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-green-500/5 border border-green-500/20"
              >
                <p className="text-green-400 font-medium text-sm mb-2">✓ AI Estimate Complete</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Hours:</span>{" "}
                    <span className="text-white font-medium">{estimateResult.estimatedHours}h</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cost:</span>{" "}
                    <span className="text-white font-medium">₹{estimateResult.estimatedCost.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-2 line-clamp-2">{estimateResult.projectSummary}</p>
              </motion.div>
            )}

            <motion.button
              id="btn-get-estimate"
              type="submit"
              disabled={estimating}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {estimating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {estimating ? "Analyzing with AI..." : "Get AI Estimate"}
            </motion.button>
          </form>
        </div>
      </motion.div>

      {/* Active Projects */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-indigo-400" />
          Your Projects
        </h2>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <FolderKanban className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No projects yet. Submit one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => {
              const status = statusConfig[project.status] || statusConfig.pending_estimation;
              const taskCount = projectTaskCounts[project.id] || { total: 0, completed: 0 };
              const progress = taskCount.total > 0 ? (taskCount.completed / taskCount.total) * 100 : 0;

              return (
                <motion.div
                  key={project.id}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 hover:border-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm truncate pr-3">{project.title}</h3>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span>₹{Number(project.estimated_cost).toLocaleString("en-IN")}</span>
                    <span>{Number(project.estimated_hours)}h estimated</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{taskCount.completed}/{taskCount.total} tasks</span>
                      <span className="text-gray-500">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Recent Tasks */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-emerald-400" />
          Recent Tasks
        </h2>

        {recentTasks.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-gray-500 text-sm">No tasks yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            {recentTasks.map((task, idx) => {
              const tConf = taskStatusConfig[task.status] || taskStatusConfig.todo;
              const TaskIcon = tConf.icon;
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${
                    idx < recentTasks.length - 1 ? "border-b border-white/[0.04]" : ""
                  }`}
                >
                  <TaskIcon
                    className={`w-4 h-4 shrink-0 ${
                      task.status === "completed"
                        ? "text-green-400"
                        : task.status === "in_progress"
                        ? "text-blue-400 animate-spin"
                        : "text-gray-600"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{task.title}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {(task as any).projects?.title || "—"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{tConf.label}</span>
                  <ArrowRight className="w-3 h-3 text-gray-700 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

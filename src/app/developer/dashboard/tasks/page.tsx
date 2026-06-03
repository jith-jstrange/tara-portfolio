"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  CheckSquare,
  Clock,
  Play,
  CheckCircle2,
  Layers,
  Loader2,
  Folder,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
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

export default function TasksPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

  const fetchTasksData = useCallback(async (uid: string) => {
    // 1. Fetch assigned tasks (including completed ones to show full list)
    const { data: assignedData, error: assignedError } = await supabase
      .from("tasks")
      .select("id, title, description, status, logged_hours, project_id, assigned_developer_id, projects(title, status)")
      .eq("assigned_developer_id", uid)
      .order("created_at", { ascending: false });

    if (assignedError) console.error("Error fetching assigned tasks:", assignedError);
    else setTasks((assignedData as unknown as Task[]) || []);

    // 2. Fetch unassigned tasks from active projects
    const { data: availableData, error: availableError } = await supabase
      .from("tasks")
      .select("id, title, description, status, logged_hours, project_id, assigned_developer_id, projects(title, status)")
      .is("assigned_developer_id", null)
      .neq("status", "completed")
      .order("created_at", { ascending: false });

    if (availableError) {
      console.error("Error fetching available tasks:", availableError);
    } else {
      const activeAvailable = ((availableData as unknown as Task[]) || []).filter(
        (t) => t.projects?.status === "active"
      );
      setAvailableTasks(activeAvailable);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/developer/login";
        return;
      }
      const uid = session.user.id;
      setUserId(uid);
      await fetchTasksData(uid);
    };
    init();
  }, [fetchTasksData]);

  const updateTaskStatus = async (taskId: string, newStatus: "in_progress" | "completed") => {
    setUpdatingTaskId(taskId);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;

      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err: any) {
      alert("Failed to update task: " + err.message);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const claimTask = async (taskId: string) => {
    if (!userId) return;
    setClaimingTaskId(taskId);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_developer_id: userId })
        .eq("id", taskId);

      if (error) throw error;

      const claimed = availableTasks.find(t => t.id === taskId);
      if (claimed) {
        setAvailableTasks(prev => prev.filter(t => t.id !== taskId));
        setTasks(prev => [{ ...claimed, assigned_developer_id: userId, status: "todo" }, ...prev]);
      }
    } catch (err: any) {
      alert("Failed to claim task: " + err.message);
    } finally {
      setClaimingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter tasks
  const myActiveTasks = tasks.filter(t => t.status !== "completed");
  const myCompletedTasks = tasks.filter(t => t.status === "completed");

  return (
    <motion.div
      className="max-w-6xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl lg:text-3xl font-bold text-white font-[family-name:var(--font-display)] tracking-tight flex items-center gap-3">
          <CheckSquare className="w-7 h-7 text-purple-400" />
          Tasks Board
        </h1>
        <p className="text-gray-500 text-sm mt-1">Claim open project requirements and manage your execution status</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Developer Tasks Board */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Tasks Section */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white font-display flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>My Active Checklist</span>
              </h2>
              <span className="text-xs text-gray-500 font-mono">{myActiveTasks.length} tasks</span>
            </div>

            <div className="p-4 space-y-3">
              {myActiveTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-green-500/20 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-mono">No active tasks on your plate. Claim one from the sidebar!</p>
                </div>
              ) : (
                myActiveTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white">{task.title}</h3>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Folder className="w-3 h-3 text-purple-400/80" />
                          {task.projects?.title || "Unknown Project"}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{task.description}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[task.status]}`}>
                        {statusLabels[task.status]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
                      <span className="text-[10px] text-gray-600 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        {task.logged_hours || 0}h logged
                      </span>

                      <div className="flex items-center gap-2">
                        {task.status === "todo" && (
                          <button
                            id={`task-btn-start-${task.id}`}
                            type="button"
                            disabled={updatingTaskId === task.id}
                            onClick={() => updateTaskStatus(task.id, "in_progress")}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold transition-all"
                          >
                            {updatingTaskId === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            Start
                          </button>
                        )}
                        {task.status === "in_progress" && (
                          <button
                            id={`task-btn-complete-${task.id}`}
                            type="button"
                            disabled={updatingTaskId === task.id}
                            onClick={() => updateTaskStatus(task.id, "completed")}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-xs font-semibold transition-all"
                          >
                            {updatingTaskId === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Completed Tasks Section */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400 font-display flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-500" />
                <span>Completed Tasks</span>
              </h2>
              <span className="text-xs text-gray-500 font-mono">{myCompletedTasks.length} tasks</span>
            </div>

            <div className="p-4 space-y-2 max-h-[200px] overflow-y-auto">
              {myCompletedTasks.length === 0 ? (
                <p className="text-xs text-gray-600 italic text-center py-4">No completed tasks yet.</p>
              ) : (
                myCompletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-medium text-gray-400 line-through">{task.title}</h4>
                      <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                        <Folder className="w-2.5 h-2.5" />
                        {task.projects?.title || "—"}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono shrink-0">
                      {task.logged_hours || 0}h logged
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Side: Available Open Tasks to Claim */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white font-display flex items-center gap-2">
                <Layers className="w-4 h-4 text-pink-400" />
                <span>Available Tasks</span>
              </h2>
              <span className="text-xs text-gray-500 font-mono">{availableTasks.length} open</span>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {availableTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No open tasks available to claim right now.</p>
                </div>
              ) : (
                availableTasks.map((task) => (
                  <div
                    key={`open-${task.id}`}
                    className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:border-white/10 transition-all space-y-2.5"
                  >
                    <div>
                      <h4 className="font-semibold text-white text-xs">{task.title}</h4>
                      <p className="text-[10px] text-purple-400 flex items-center gap-0.5 mt-0.5 font-medium">
                        <Folder className="w-2.5 h-2.5" />
                        {task.projects?.title || "Project"}
                      </p>
                      {task.description && (
                        <p className="text-[11px] text-gray-600 line-clamp-2 mt-1.5">{task.description}</p>
                      )}
                    </div>

                    <motion.button
                      id={`btn-claim-tasks-${task.id}`}
                      type="button"
                      onClick={() => claimTask(task.id)}
                      disabled={claimingTaskId === task.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-[10px] font-bold transition-all disabled:opacity-50"
                    >
                      {claimingTaskId === task.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      Claim This Task
                    </motion.button>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

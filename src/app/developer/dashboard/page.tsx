"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import {
  ListChecks,
  Clock,
  IndianRupee,
  FolderOpen,
  Play,
  Pause,
  Square,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Circle,
  Timer,
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
  projects: { title: string } | null;
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
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [savingTime, setSavingTime] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
  };

  // Fetch user + data
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const uid = session.user.id;
      setUserId(uid);

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, hourly_rate")
        .eq("id", uid)
        .single();

      if (profile) {
        setUserName(profile.full_name || "Developer");
        setHourlyRate(profile.hourly_rate || 500);
      }

      // Fetch assigned tasks with project title
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("id, title, description, status, logged_hours, project_id, projects(title)")
        .eq("assigned_developer_id", uid)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      const fetchedTasks = (tasksData || []) as unknown as Task[];
      setTasks(fetchedTasks);

      // Count assigned tasks (all statuses)
      const { count: totalAssigned } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_developer_id", uid)
        .neq("status", "completed");

      // Hours logged this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekLogs } = await supabase
        .from("time_logs")
        .select("hours")
        .eq("developer_id", uid)
        .gte("created_at", weekAgo.toISOString());

      const hoursThisWeek = (weekLogs || []).reduce((sum, l) => sum + Number(l.hours), 0);

      // Total earnings from all time_logs
      const { data: allLogs } = await supabase
        .from("time_logs")
        .select("hours")
        .eq("developer_id", uid);

      const totalHours = (allLogs || []).reduce((sum, l) => sum + Number(l.hours), 0);
      const rate = profile?.hourly_rate || 500;
      const totalEarnings = totalHours * rate;

      // Active projects (distinct project_ids from non-completed tasks)
      const activeProjectIds = new Set(fetchedTasks.map((t) => t.project_id));

      setStats({
        assignedTasks: totalAssigned || 0,
        hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
        totalEarnings: Math.round(totalEarnings),
        activeProjects: activeProjectIds.size,
      });

      setLoadingTasks(false);
    };

    init();
  }, []);

  // Timer logic
  const startTimer = useCallback(() => {
    if (!selectedTaskId) return;
    setTimerRunning(true);
    setTimerPaused(false);
    intervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  }, [selectedTaskId]);

  const pauseTimer = () => {
    setTimerPaused(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resumeTimer = () => {
    setTimerPaused(false);
    intervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerRunning(false);
    setTimerPaused(false);

    if (timerSeconds < 60 || !userId || !selectedTaskId) {
      setTimerSeconds(0);
      return;
    }

    setSavingTime(true);
    const hours = Math.round((timerSeconds / 3600) * 100) / 100;

    try {
      // Insert time log
      await supabase.from("time_logs").insert({
        task_id: selectedTaskId,
        developer_id: userId,
        hours,
        description: `Timer session: ${formatTime(timerSeconds)}`,
      });

      // Update logged_hours on task
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) {
        const newHours = (task.logged_hours || 0) + hours;
        await supabase
          .from("tasks")
          .update({ logged_hours: newHours })
          .eq("id", selectedTaskId);

        // Update local state
        setTasks((prev) =>
          prev.map((t) =>
            t.id === selectedTaskId ? { ...t, logged_hours: newHours } : t
          )
        );

        // Update stats
        setStats((prev) => ({
          ...prev,
          hoursThisWeek: Math.round((prev.hoursThisWeek + hours) * 100) / 100,
          totalEarnings: prev.totalEarnings + Math.round(hours * hourlyRate),
        }));
      }
    } catch (err) {
      console.error("Failed to save time log:", err);
    }

    setSavingTime(false);
    setTimerSeconds(0);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
          Welcome back,{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {userName}
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s your development overview for today.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <motion.div
            key={card.id}
            id={card.id}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:border-white/10 transition-all`}
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
        {/* Active Tasks Board — 2 columns */}
        <motion.div variants={itemVariants} className="xl:col-span-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white font-display flex items-center space-x-2">
                <ListChecks className="w-4 h-4 text-purple-400" />
                <span>Active Tasks</span>
              </h2>
              <span className="text-xs text-gray-500">{tasks.length} tasks</span>
            </div>

            <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-10 h-10 text-green-500/30 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No active tasks. You&apos;re all caught up!</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
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
                      <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border ${statusColors[task.status]}`}>
                        {statusLabels[task.status]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-[11px] text-gray-600 flex items-center space-x-1">
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
                            className="flex items-center space-x-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
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
                            className="flex items-center space-x-1 text-xs font-medium text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
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
          </div>
        </motion.div>

        {/* Quick Timer Widget — 1 column */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-base font-semibold text-white font-display flex items-center space-x-2">
                <Timer className="w-4 h-4 text-pink-400" />
                <span>Quick Timer</span>
              </h2>
            </div>

            <div className="p-6 flex flex-col items-center">
              {/* Task selector */}
              <div className="w-full mb-6">
                <label htmlFor="timer-task-select" className="block text-xs font-medium text-gray-500 mb-2">
                  Select Task
                </label>
                <select
                  id="timer-task-select"
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  disabled={timerRunning}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-50"
                >
                  <option value="" className="bg-[#0a0a0a]">
                    -- Choose a task --
                  </option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id} className="bg-[#0a0a0a]">
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timer Display */}
              <div className="relative mb-6">
                <div className={`w-40 h-40 rounded-full border-2 flex items-center justify-center transition-colors ${
                  timerRunning && !timerPaused
                    ? "border-purple-500/50 shadow-lg shadow-purple-500/10"
                    : timerPaused
                    ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
                    : "border-white/10"
                }`}>
                  <span className="text-3xl font-bold text-white font-mono tracking-wider">
                    {formatTime(timerSeconds)}
                  </span>
                </div>
                {timerRunning && !timerPaused && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-purple-500/30"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>

              {/* Status */}
              <p className="text-xs text-gray-500 mb-4 flex items-center space-x-1.5">
                <Circle className={`w-2 h-2 ${
                  timerRunning && !timerPaused
                    ? "fill-green-400 text-green-400"
                    : timerPaused
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-600 text-gray-600"
                }`} />
                <span>
                  {timerRunning && !timerPaused
                    ? "Recording..."
                    : timerPaused
                    ? "Paused"
                    : "Ready"}
                </span>
              </p>

              {/* Controls */}
              <div className="flex items-center space-x-3">
                {!timerRunning ? (
                  <motion.button
                    id="timer-start"
                    type="button"
                    disabled={!selectedTaskId}
                    onClick={startTimer}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start</span>
                  </motion.button>
                ) : (
                  <>
                    {timerPaused ? (
                      <motion.button
                        id="timer-resume"
                        type="button"
                        onClick={resumeTimer}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-semibold"
                      >
                        <Play className="w-4 h-4" />
                        <span>Resume</span>
                      </motion.button>
                    ) : (
                      <motion.button
                        id="timer-pause"
                        type="button"
                        onClick={pauseTimer}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Pause</span>
                      </motion.button>
                    )}
                    <motion.button
                      id="timer-stop"
                      type="button"
                      onClick={stopTimer}
                      disabled={savingTime}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold disabled:opacity-50"
                    >
                      {savingTime ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>Stop</span>
                    </motion.button>
                  </>
                )}
              </div>

              {timerSeconds > 0 && timerSeconds < 60 && !timerRunning && (
                <p className="text-[11px] text-amber-500 mt-3">
                  Sessions under 1 minute are not saved.
                </p>
              )}

              {/* Rate info */}
              <div className="mt-6 w-full pt-4 border-t border-white/[0.04]">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Your rate</span>
                  <span className="text-gray-400 font-medium">₹{hourlyRate}/hr</span>
                </div>
                {timerRunning && (
                  <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
                    <span>Current session value</span>
                    <span className="text-green-400 font-medium">
                      ₹{Math.round((timerSeconds / 3600) * hourlyRate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";
import {
  Clock,
  Calendar,
  Folder,
  CheckSquare,
  FileText,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TimeLog {
  id: string;
  hours: number;
  description: string | null;
  created_at: string;
  tasks: {
    title: string;
    projects: {
      title: string;
    } | null;
  } | null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
};

export default function TimesheetPage() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);

  useEffect(() => {
    const fetchTimeLogs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/developer/login";
        return;
      }
      const uid = session.user.id;

      // Fetch time logs joined with task and project details
      const { data, error } = await supabase
        .from("time_logs")
        .select(`
          id,
          hours,
          description,
          created_at,
          tasks (
            title,
            projects (
              title
            )
          )
        `)
        .eq("developer_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching time logs:", error);
      } else {
        const logs = (data as unknown as TimeLog[]) || [];
        setTimeLogs(logs);

        // Sum total hours
        const total = logs.reduce((sum, log) => sum + Number(log.hours), 0);
        setTotalHours(Math.round(total * 100) / 100);

        // Sum this week hours
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const thisWeek = logs
          .filter(log => new Date(log.created_at) >= weekAgo)
          .reduce((sum, log) => sum + Number(log.hours), 0);
        setHoursThisWeek(Math.round(thisWeek * 100) / 100);
      }
      setLoading(false);
    };

    fetchTimeLogs();
  }, []);

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <Clock className="w-7 h-7 text-purple-400" />
          Developer Timesheet
        </h1>
        <p className="text-gray-500 text-sm mt-1">Review chronological logs of your registered development hours</p>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-mono">Hours Scoped This Week</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{hoursThisWeek}h</span>
            <span className="text-xs text-purple-400 flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Active Week
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-mono">Cumulative Hours Logged</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{totalHours}h</span>
            <span className="text-xs text-green-400">Total Scoped</span>
          </div>
        </div>
      </motion.div>

      {/* Logs Table */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h2 className="text-base font-semibold text-white font-[family-name:var(--font-display)]">Time Entries</h2>

        {timeLogs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No time logs submitted yet. Start working on tasks in your Dashboard to log hours!</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            {/* Table Header - Desktop */}
            <div className="hidden md:grid grid-cols-[1.5fr_1.5fr_1.5fr_2fr_1fr] gap-4 px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-white/[0.06] font-mono">
              <span>Date & Time</span>
              <span>Project</span>
              <span>Task</span>
              <span>Notes</span>
              <span className="text-right">Logged Hours</span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/[0.04]">
              {timeLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col md:grid md:grid-cols-[1.5fr_1.5fr_1.5fr_2fr_1fr] gap-3 md:gap-4 items-start md:items-center px-6 py-4 hover:bg-white/[0.01] transition-colors text-xs"
                >
                  {/* Mobile Date Row / Desktop Date Column */}
                  <div className="flex items-center gap-2 md:block text-gray-400">
                    <Calendar className="w-3.5 h-3.5 md:hidden text-purple-400" />
                    <span className="font-mono">{formatDate(log.created_at)}</span>
                  </div>

                  {/* Project Column */}
                  <div className="flex items-center gap-2 md:block text-white truncate max-w-[180px]">
                    <Folder className="w-3.5 h-3.5 md:hidden text-indigo-400" />
                    <span>{log.tasks?.projects?.title || "—"}</span>
                  </div>

                  {/* Task Column */}
                  <div className="flex items-center gap-2 md:block text-white truncate max-w-[180px]">
                    <CheckSquare className="w-3.5 h-3.5 md:hidden text-purple-400" />
                    <span>{log.tasks?.title || "—"}</span>
                  </div>

                  {/* Description / Notes Column */}
                  <div className="flex items-center gap-2 md:block text-gray-500 italic truncate max-w-[240px]">
                    <FileText className="w-3.5 h-3.5 md:hidden text-pink-400" />
                    <span>{log.description || "No notes provided"}</span>
                  </div>

                  {/* Logged Hours Column */}
                  <div className="w-full md:w-auto flex md:block items-center justify-between text-right font-mono text-purple-400 font-bold text-sm">
                    <span className="md:hidden text-xs text-gray-500 font-normal">Hours logged:</span>
                    <span>{log.hours}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

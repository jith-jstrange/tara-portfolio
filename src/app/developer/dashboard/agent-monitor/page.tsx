"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import {
  Activity,
  Database,
  Zap,
  RefreshCw,
  Server,
  CreditCard,
  Cpu,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  ListChecks,
  Receipt,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// -- Types --
interface TokenLog {
  id: string;
  project_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_inr: number;
  created_at: string;
  projects: { title: string } | null;
}

interface TableCount {
  name: string;
  count: number;
  icon: React.ReactNode;
}

interface SystemStatus {
  name: string;
  status: "healthy" | "warning" | "down" | "checking";
  detail: string;
  icon: React.ReactNode;
}

// -- Helpers --
const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const statusDotColor: Record<string, string> = {
  healthy: "bg-green-400 shadow-green-400/50",
  warning: "bg-amber-400 shadow-amber-400/50",
  down: "bg-red-400 shadow-red-400/50",
  checking: "bg-gray-400 animate-pulse",
};

const statusBadgeColor: Record<string, string> = {
  healthy: "text-green-400 bg-green-500/10 border-green-500/20",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  down: "text-red-400 bg-red-500/10 border-red-500/20",
  checking: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

export default function AgentMonitorPage() {
  // Token logs
  const [tokenLogs, setTokenLogs] = useState<TokenLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Token summary
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [avgCost, setAvgCost] = useState(0);

  // Bar chart data (last 7 days)
  const [barData, setBarData] = useState<{ label: string; value: number }[]>([]);

  // Database health
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // System status
  const [systemStatuses, setSystemStatuses] = useState<SystemStatus[]>([
    { name: "Supabase", status: "checking", detail: "Checking...", icon: <Database className="w-5 h-5" /> },
    { name: "Gemini API", status: "checking", detail: "Checking...", icon: <Cpu className="w-5 h-5" /> },
    { name: "Stripe", status: "warning", detail: "Test Mode", icon: <CreditCard className="w-5 h-5" /> },
  ]);

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
  };

  // -- Fetch token logs --
  const fetchTokenLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from("token_logs")
      .select("id, project_id, prompt_tokens, completion_tokens, cost_inr, created_at, projects(title)")
      .order("created_at", { ascending: false })
      .limit(50);

    const logs = (data || []) as unknown as TokenLog[];
    setTokenLogs(logs);

    // Summary calculations
    const total = logs.reduce((s, l) => s + l.prompt_tokens + l.completion_tokens, 0);
    const cost = logs.reduce((s, l) => s + Number(l.cost_inr), 0);
    const avg = logs.length > 0 ? cost / logs.length : 0;
    setTotalTokens(total);
    setTotalCost(Math.round(cost * 100) / 100);
    setAvgCost(Math.round(avg * 100) / 100);

    // Bar chart: aggregate tokens by day (last 7 days)
    const dayMap = new Map<string, number>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      dayMap.set(key, 0);
    }
    logs.forEach((log) => {
      const d = new Date(log.created_at);
      const key = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) || 0) + log.prompt_tokens + log.completion_tokens);
      }
    });
    setBarData(Array.from(dayMap.entries()).map(([label, value]) => ({ label, value })));

    setLoadingLogs(false);
  }, []);

  // -- Fetch table counts --
  const fetchTableCounts = useCallback(async () => {
    setLoadingCounts(true);

    const tables = [
      { name: "Projects", table: "projects", icon: <FileText className="w-4 h-4" /> },
      { name: "Tasks", table: "tasks", icon: <ListChecks className="w-4 h-4" /> },
      { name: "Time Logs", table: "time_logs", icon: <Clock className="w-4 h-4" /> },
      { name: "Invoices", table: "invoices", icon: <Receipt className="w-4 h-4" /> },
      { name: "Token Logs", table: "token_logs", icon: <Layers className="w-4 h-4" /> },
    ];

    const results: TableCount[] = [];
    for (const t of tables) {
      const { count } = await supabase
        .from(t.table)
        .select("id", { count: "exact", head: true });
      results.push({ name: t.name, count: count || 0, icon: t.icon });
    }

    setTableCounts(results);
    setLastRefresh(new Date());
    setLoadingCounts(false);
  }, []);

  // -- Check system status --
  const checkSystemStatus = useCallback(async () => {
    // Supabase check
    let supabaseStatus: SystemStatus;
    try {
      const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" });
      supabaseStatus = error
        ? { name: "Supabase", status: "down", detail: error.message, icon: <Database className="w-5 h-5" /> }
        : { name: "Supabase", status: "healthy", detail: "Connected", icon: <Database className="w-5 h-5" /> };
    } catch {
      supabaseStatus = { name: "Supabase", status: "down", detail: "Connection failed", icon: <Database className="w-5 h-5" /> };
    }

    // Gemini API check (based on last token_log)
    let geminiStatus: SystemStatus;
    const { data: lastLog } = await supabase
      .from("token_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastLog) {
      const lastTime = new Date(lastLog.created_at);
      const diffMinutes = (Date.now() - lastTime.getTime()) / 60000;
      if (diffMinutes < 60) {
        geminiStatus = { name: "Gemini API", status: "healthy", detail: `Last used ${Math.round(diffMinutes)}m ago`, icon: <Cpu className="w-5 h-5" /> };
      } else {
        geminiStatus = { name: "Gemini API", status: "warning", detail: `Last used ${Math.round(diffMinutes / 60)}h ago`, icon: <Cpu className="w-5 h-5" /> };
      }
    } else {
      geminiStatus = { name: "Gemini API", status: "warning", detail: "No activity recorded", icon: <Cpu className="w-5 h-5" /> };
    }

    // Stripe is always test mode in dev
    const stripeStatus: SystemStatus = {
      name: "Stripe",
      status: "warning",
      detail: "Test Mode",
      icon: <CreditCard className="w-5 h-5" />,
    };

    setSystemStatuses([supabaseStatus, geminiStatus, stripeStatus]);
  }, []);

  // Initial load
  useEffect(() => {
    fetchTokenLogs();
    fetchTableCounts();
    checkSystemStatus();
  }, [fetchTokenLogs, fetchTableCounts, checkSystemStatus]);

  // Max bar value for chart scaling
  const maxBarValue = Math.max(...barData.map((d) => d.value), 1);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* Header with scan-line effect */}
      <motion.div variants={itemVariants} className="relative mb-8 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
              Agent Monitor
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-11">
            Real-time observability dashboard for AI operations & system health.
          </p>
        </div>
        {/* Scan-line animation */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-purple-500/[0.03] via-transparent to-transparent pointer-events-none"
          animate={{ y: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      {/* Token Usage Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tokens</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-display font-mono">
            {totalTokens.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</span>
            <span className="text-indigo-400 text-xs font-bold">₹</span>
          </div>
          <p className="text-2xl font-bold text-white font-display font-mono">
            ₹{totalCost.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost/Request</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white font-display font-mono">
            ₹{avgCost.toLocaleString("en-IN")}
          </p>
        </div>
      </motion.div>

      {/* Token Usage Bar Chart */}
      <motion.div variants={itemVariants} className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
        <h2 className="text-sm font-semibold text-white font-display mb-4 flex items-center space-x-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>Token Usage (Last 7 Days)</span>
        </h2>
        <div className="flex items-end justify-between space-x-2 h-32">
          {barData.map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center space-y-2">
              <motion.div
                className="w-full rounded-t-md bg-gradient-to-t from-indigo-500/60 via-purple-500/40 to-pink-500/20 min-h-[4px]"
                initial={{ height: 0 }}
                animate={{
                  height: `${Math.max((bar.value / maxBarValue) * 100, 3)}%`,
                }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
              />
              <span className="text-[10px] text-gray-600 whitespace-nowrap">{bar.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* System Status Indicators */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white font-display flex items-center space-x-2">
                <Server className="w-4 h-4 text-green-400" />
                <span>System Status</span>
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {systemStatuses.map((sys) => (
                <div
                  key={sys.name}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-gray-400">{sys.icon}</div>
                    <div>
                      <p className="text-sm font-medium text-white">{sys.name}</p>
                      <p className="text-[11px] text-gray-500">{sys.detail}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${statusBadgeColor[sys.status]}`}>
                      {sys.status === "healthy" ? "Healthy" : sys.status === "warning" ? "Warning" : sys.status === "down" ? "Down" : "..."}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${statusDotColor[sys.status]}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Database Health Panel */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white font-display flex items-center space-x-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Database Health</span>
              </h2>
              <div className="flex items-center space-x-3">
                {lastRefresh && (
                  <span className="text-[10px] text-gray-600">
                    {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
                <button
                  id="db-refresh"
                  type="button"
                  onClick={fetchTableCounts}
                  disabled={loadingCounts}
                  className="text-gray-500 hover:text-purple-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCounts ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {loadingCounts ? (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                </div>
              ) : (
                tableCounts.map((tc) => (
                  <div
                    key={tc.name}
                    className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center"
                  >
                    <div className="text-gray-500 mb-1 flex items-center justify-center">
                      {tc.icon}
                    </div>
                    <p className="text-xl font-bold text-white font-mono">{tc.count}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{tc.name}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Token Usage Feed Table */}
      <motion.div variants={itemVariants} className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white font-display flex items-center space-x-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>Token Usage Feed</span>
          </h2>
          <button
            id="token-feed-refresh"
            type="button"
            onClick={fetchTokenLogs}
            disabled={loadingLogs}
            className="text-gray-500 hover:text-indigo-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  <span className="flex items-center justify-end space-x-1">
                    <ArrowUp className="w-3 h-3" />
                    <span>Prompt</span>
                  </span>
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  <span className="flex items-center justify-end space-x-1">
                    <ArrowDown className="w-3 h-3" />
                    <span>Completion</span>
                  </span>
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">Cost (₹)</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : tokenLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-600 text-sm">
                    <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    No token logs recorded yet.
                  </td>
                </tr>
              ) : (
                tokenLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-6 py-3 text-sm text-white truncate max-w-[200px]">
                      {log.projects?.title || "—"}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm text-indigo-400">
                      {log.prompt_tokens.toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm text-purple-400">
                      {log.completion_tokens.toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm text-green-400">
                      ₹{Number(log.cost_inr).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Recent AI Prompts Log */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white font-display flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-pink-400" />
            <span>Recent AI Activity Log</span>
          </h2>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
            </div>
          ) : tokenLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              No activity recorded.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {tokenLogs.slice(0, 20).map((log) => (
                <div
                  key={`log-${log.id}`}
                  className="px-6 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500/60 shrink-0" />
                      <div>
                        <p className="text-xs text-white font-medium">
                          {log.projects?.title || "Unknown Project"}
                        </p>
                        <p className="font-mono text-[10px] text-gray-600 mt-0.5">
                          {formatTimestamp(log.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-[11px] font-mono">
                      <span className="text-indigo-400/80">
                        <ArrowUp className="w-3 h-3 inline mr-0.5" />
                        {log.prompt_tokens.toLocaleString("en-IN")}
                      </span>
                      <span className="text-purple-400/80">
                        <ArrowDown className="w-3 h-3 inline mr-0.5" />
                        {log.completion_tokens.toLocaleString("en-IN")}
                      </span>
                      <span className="text-green-400/80">
                        ₹{Number(log.cost_inr).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

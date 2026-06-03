"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  FolderKanban,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ListChecks,
  User,
  Layers,
  FileText,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_hours_min: number;
  estimated_hours_max: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
  estimated_hours?: number;
  estimated_cost?: number;
  client_budget: number;
  budget_outlook: string | null;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  logged_hours: number;
  assigned_developer_id: string | null;
  profiles: { full_name: string } | null;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending_estimation: { label: "Pending Scope", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  estimated: { label: "Estimated", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  active: { label: "Active Project", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  completed: { label: "Completed", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
};

export default function ProjectsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectTasks, setProjectTasks] = useState<Record<string, Task[]>>({});
  const [projectInvoices, setProjectInvoices] = useState<Record<string, Invoice[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects(data as Project[] || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const uid = session.user.id;
      setUserId(uid);
      await fetchProjects(uid);
    };
    init();
  }, [fetchProjects]);

  const loadProjectDetails = async (projectId: string) => {
    if (projectTasks[projectId] && projectInvoices[projectId]) return;
    
    setLoadingDetails(prev => ({ ...prev, [projectId]: true }));
    try {
      // 1. Fetch tasks with assigned developer full name
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("id, title, description, status, logged_hours, assigned_developer_id, profiles(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      // Cast profiles relation to fit TypeScript interface
      const parsedTasks = (tasksData || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        logged_hours: t.logged_hours,
        assigned_developer_id: t.assigned_developer_id,
        profiles: t.profiles || null
      }));

      // 2. Fetch invoices
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("id, amount, status, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      setProjectTasks(prev => ({ ...prev, [projectId]: parsedTasks }));
      setProjectInvoices(prev => ({ ...prev, [projectId]: invoicesData || [] }));
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleToggleExpand = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
    } else {
      setExpandedProjectId(projectId);
      await loadProjectDetails(projectId);
    }
  };

  const handleApproveProject = async (projectId: string, costMin: number) => {
    setApprovingId(projectId);
    try {
      const { error: projectError } = await supabase
        .from("projects")
        .update({ status: "active" })
        .eq("id", projectId);

      if (projectError) throw projectError;

      const { error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          project_id: projectId,
          amount: costMin,
          status: "unpaid",
        });

      if (invoiceError) throw invoiceError;

      // Update local projects status list
      setProjects(prev =>
        prev.map(p => (p.id === projectId ? { ...p, status: "active" } : p))
      );
      
      // Load details for updated status
      setProjectTasks(prev => {
        const copy = { ...prev };
        delete copy[projectId];
        return copy;
      });
      setProjectInvoices(prev => {
        const copy = { ...prev };
        delete copy[projectId];
        return copy;
      });
      await loadProjectDetails(projectId);
    } catch (err: any) {
      alert("Failed to approve project: " + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handlePay = async (invoiceId: string) => {
    setPayingId(invoiceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Payment error: " + (data.error || "failed redirect"));
      }
    } catch (err: any) {
      alert("Failed to initiate payment: " + err.message);
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white font-[family-name:var(--font-display)] tracking-tight flex items-center gap-3">
            <FolderKanban className="w-7 h-7 text-indigo-400" />
            Projects Board
          </h1>
          <p className="text-gray-500 text-sm mt-1">Submit new project briefs and monitor task execution</p>
        </div>
      </motion.div>

      {/* Projects List */}
      <motion.div variants={itemVariants} className="space-y-4">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <FolderKanban className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No projects created yet. Go to your Dashboard to submit your first brief!</p>
          </div>
        ) : (
          projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.pending_estimation;
            const isExpanded = expandedProjectId === project.id;
            const costMin = project.estimated_cost_min || project.estimated_cost || 0;
            const costMax = project.estimated_cost_max || project.estimated_cost || 0;
            const hoursMin = project.estimated_hours_min || project.estimated_hours || 0;
            const hoursMax = project.estimated_hours_max || project.estimated_hours || 0;
            const isPendingScope = project.status === "pending_estimation";

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:border-white/10 transition-all overflow-hidden"
              >
                {/* Project Header Row */}
                <div
                  onClick={() => handleToggleExpand(project.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.01] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-semibold text-base truncate">{project.title}</h3>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">ID: {project.id.slice(0, 8).toUpperCase()} // Submitted {new Date(project.created_at).toLocaleDateString("en-IN")}</p>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end shrink-0">
                    <div className="text-right text-xs font-mono text-gray-400">
                      {isPendingScope ? (
                        <span className="text-amber-400/80 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Awaiting AI pm...
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-white font-medium">₹{costMin.toLocaleString()} - ₹{costMax.toLocaleString()}</p>
                          <p className="text-gray-500">{hoursMin}h - {hoursMax}h scoped</p>
                        </div>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* Expanded Details Pane */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="border-t border-white/[0.06] bg-[#050505]/40"
                    >
                      <div className="p-6 space-y-6">
                        {/* Description & Outlook */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 space-y-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-indigo-400" />
                              Project Requirements
                            </h4>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                              {project.description}
                            </p>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-indigo-400" />
                              AI Project Outlook
                            </h4>
                            {project.budget_outlook ? (
                              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-gray-300 leading-relaxed space-y-2">
                                <p>{project.budget_outlook}</p>
                                {project.client_budget > 0 && (
                                  <p className="text-[10px] text-indigo-400 font-mono">
                                    Target budget set by client: ₹{Number(project.client_budget).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-gray-500 text-center">
                                Outlining scope requirements...
                              </div>
                            )}

                            {/* Approval Action */}
                            {project.status === "estimated" && (
                              <motion.button
                                id={`btn-approve-pane-${project.id}`}
                                type="button"
                                onClick={() => handleApproveProject(project.id, costMin)}
                                disabled={approvingId === project.id}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/15 transition-all disabled:opacity-50"
                              >
                                {approvingId === project.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Approve Estimate & Start Project
                              </motion.button>
                            )}
                          </div>
                        </div>

                        {/* Loading indicator for tasks/invoices */}
                        {loadingDetails[project.id] ? (
                          <div className="flex justify-center items-center py-8">
                            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-white/[0.04]">
                            {/* Tasks Board Checklist */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <ListChecks className="w-4 h-4 text-emerald-400" />
                                Project Tasks Checklist
                              </h4>
                              
                              {!projectTasks[project.id] || projectTasks[project.id].length === 0 ? (
                                <p className="text-xs text-gray-500 italic">No tasks scoped yet.</p>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {projectTasks[project.id].map((task) => (
                                    <div
                                      key={task.id}
                                      className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] flex items-start justify-between gap-3 text-xs"
                                    >
                                      <div>
                                        <p className="font-semibold text-white">{task.title}</p>
                                        {task.description && (
                                          <p className="text-gray-500 text-[11px] mt-0.5">{task.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                                          <span className="flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5" />
                                            {task.logged_hours || 0}h logged
                                          </span>
                                          {task.profiles && (
                                            <span className="flex items-center gap-0.5 text-indigo-400/80">
                                              <User className="w-2.5 h-2.5" />
                                              {task.profiles.full_name}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                                        task.status === "completed"
                                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                                          : task.status === "in_progress"
                                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                                          : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                      }`}>
                                        {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "Working" : "Pending"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Invoices List */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <IndianRupee className="w-4 h-4 text-purple-400" />
                                Billing & Payments
                              </h4>

                              {!projectInvoices[project.id] || projectInvoices[project.id].length === 0 ? (
                                <p className="text-xs text-gray-500 italic">No invoices issued yet. Invoice is created once the project is approved.</p>
                              ) : (
                                <div className="space-y-2">
                                  {projectInvoices[project.id].map((inv) => (
                                    <div
                                      key={inv.id}
                                      className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div>
                                        <p className="font-semibold text-white">₹{Number(inv.amount).toLocaleString("en-IN")}</p>
                                        <p className="text-gray-500 text-[10px] mt-0.5">Inv: #{inv.id.slice(0, 8).toUpperCase()} // {new Date(inv.created_at).toLocaleDateString("en-IN")}</p>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                                          inv.status === "paid"
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-red-500/10 text-red-400 border-red-500/20"
                                        }`}>
                                          {inv.status === "paid" ? "Paid" : "Unpaid"}
                                        </span>

                                        {inv.status === "unpaid" && (
                                          <motion.button
                                            id={`btn-pay-details-${inv.id}`}
                                            type="button"
                                            onClick={() => handlePay(inv.id)}
                                            disabled={payingId === inv.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-[10px] font-medium shadow-md shadow-indigo-500/10"
                                          >
                                            {payingId === inv.id ? (
                                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                            ) : (
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            )}
                                            Pay
                                          </motion.button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </motion.div>
    </motion.div>
  );
}

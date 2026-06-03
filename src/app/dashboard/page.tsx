"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Globe,
  Settings,
  Smartphone,
  BookOpen,
  Plus,
  Minus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_hours: number;
  estimated_cost: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
  client_budget: number;
  budget_outlook: string | null;
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
  pending_estimation: { label: "Pending Scope", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  estimated: { label: "Estimated", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  active: { label: "Active Project", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  completed: { label: "Completed", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
};

const taskStatusConfig: Record<string, { label: string; icon: typeof Clock }> = {
  todo: { label: "To Do", icon: Clock },
  in_progress: { label: "In Progress", icon: Loader2 },
  completed: { label: "Done", icon: CheckCircle2 },
};

// Wizard Config Data
const categories = [
  { id: "web_app", name: "Web App / Headless Shop", desc: "Next.js, React, Headless Shopify, Netlify", icon: Globe, baseMin: 15, baseMax: 25 },
  { id: "crm_saas", name: "CRM / Custom SaaS", desc: "Complex database systems, dashboards, secure portals", icon: Settings, baseMin: 30, baseMax: 55 },
  { id: "mobile_app", name: "Mobile App (iOS/Android)", desc: "React Native custom mobile application", icon: Smartphone, baseMin: 25, baseMax: 40 },
  { id: "blog_wp", name: "WordPress / Blog CMS", desc: "WordPress or headless blogs, simple catalogs", icon: BookOpen, baseMin: 10, baseMax: 18 },
];

const features = [
  { id: "auth", name: "User Auth & Profiles", hours: 4, desc: "Secure logins and user workspace profile forms" },
  { id: "stripe", name: "Stripe Checkout & Billing", hours: 8, desc: "Accept card payments and recurring subscriptions" },
  { id: "gemini", name: "Gemini AI Integrations", hours: 10, desc: "Smart AI chats, auto scoping, and technical advice" },
  { id: "charts", name: "Interactive Charts & Stats", hours: 6, desc: "Observability feeds and cost markup visualizations" },
  { id: "resend", name: "Resend SMS & Email Alerts", hours: 4, desc: "Automatic email alerts on milestones and checkout payments" },
  { id: "motion", name: "Premium Animations", hours: 5, desc: "Smooth micro-animations using motion.dev parameters" },
  { id: "uploads", name: "Netlify Storage Blobs", hours: 4, desc: "Let users upload and manage images or files securely" },
];

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

  // Conversational Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [newTitle, setNewTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("web_app");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [newDescription, setNewDescription] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateResult, setEstimateResult] = useState<{
    estimatedHoursMin: number;
    estimatedHoursMax: number;
    estimatedCostMin: number;
    estimatedCostMax: number;
    projectSummary: string;
    budgetOutlook: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (uid: string) => {
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", uid)
      .order("created_at", { ascending: false });

    const projectsList = (projectsData as Project[]) || [];
    setProjects(projectsList);

    const projectIds = projectsList.map((p) => p.id);
    let allTasks: Task[] = [];
    if (projectIds.length > 0) {
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*, projects(title)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      allTasks = (tasksData as unknown as Task[]) || [];
    }

    const counts: Record<string, { total: number; completed: number }> = {};
    allTasks.forEach((t) => {
      if (!counts[t.project_id]) counts[t.project_id] = { total: 0, completed: 0 };
      counts[t.project_id].total++;
      if (t.status === "completed") counts[t.project_id].completed++;
    });
    setProjectTaskCounts(counts);

    setRecentTasks(allTasks.slice(0, 5));

    let invoices: Invoice[] = [];
    if (projectIds.length > 0) {
      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("id, amount, status")
        .in("project_id", projectIds);
      invoices = invoiceData || [];
    }

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

  // Live calculation helpers
  const getLiveHoursMin = () => {
    const cat = categories.find(c => c.id === selectedCategory) || categories[0];
    const featHours = features.filter(f => selectedFeatures.includes(f.id)).reduce((sum, f) => sum + f.hours, 0);
    return cat.baseMin + featHours;
  };

  const getLiveHoursMax = () => {
    const cat = categories.find(c => c.id === selectedCategory) || categories[0];
    const featHours = features.filter(f => selectedFeatures.includes(f.id)).reduce((sum, f) => sum + f.hours, 0);
    return cat.baseMax + featHours;
  };

  const getLiveCostMin = () => {
    const hrs = getLiveHoursMin();
    return Math.round(hrs * 700 * 1.10); // rate * platform fee buffer
  };

  const getLiveCostMax = () => {
    const hrs = getLiveHoursMax();
    return Math.round(hrs * 1000 * 1.10); // rate * platform fee buffer
  };

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newTitle.trim()) return;

    setEstimating(true);
    setFormError(null);
    setEstimateResult(null);

    const categoryInfo = categories.find(c => c.id === selectedCategory);
    const featuresList = features
      .filter(f => selectedFeatures.includes(f.id))
      .map(f => `- ${f.name}: ${f.desc}`)
      .join("\n");

    const combinedDesc = `Category: ${categoryInfo?.name}
Features Checklist:
${featuresList || "- None selected"}

Additional Requirements & Notes:
${newDescription.trim() || "No additional custom notes provided."}`;

    try {
      // Create project brief
      const { data: newProject, error: insertError } = await supabase
        .from("projects")
        .insert({
          title: newTitle.trim(),
          description: combinedDesc,
          client_id: userId,
          status: "pending_estimation",
          client_budget: newBudget ? Number(newBudget) : 0,
        })
        .select()
        .single();

      if (insertError || !newProject) {
        setFormError(insertError?.message || "Failed to create project.");
        return;
      }

      // Call AI PM estimation engine
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: newProject.id,
          description: combinedDesc,
          developerGrade: "senior",
          clientBudget: newBudget ? Number(newBudget) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "AI estimation failed.");
        return;
      }

      setEstimateResult({
        estimatedHoursMin: data.estimatedHoursMin,
        estimatedHoursMax: data.estimatedHoursMax,
        estimatedCostMin: data.estimatedCostMin,
        estimatedCostMax: data.estimatedCostMax,
        projectSummary: data.projectSummary,
        budgetOutlook: data.budgetOutlook,
      });

      // Clear wizard
      setNewTitle("");
      setNewDescription("");
      setNewBudget("");
      setSelectedFeatures([]);
      setWizardStep(6); // jump to display results step

      // Refresh listings
      await fetchDashboardData(userId);
    } catch {
      setFormError("An unexpected error occurred during scoping.");
    } finally {
      setEstimating(false);
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

      setEstimateResult(null);
      setWizardStep(1); // reset wizard

      if (userId) {
        await fetchDashboardData(userId);
      }
    } catch (err: any) {
      alert("Failed to approve project: " + err.message);
    } finally {
      setApprovingId(null);
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
        <p className="text-gray-500 text-sm mt-1 font-mono text-xs">strangelabs.online // client portal</p>
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

      {/* Interactive project architect step wizard & Live calculator row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Step Wizard Column */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Interactive Project Architect
              </h2>
            </div>
            <span className="text-xs text-gray-500 font-mono">Step {wizardStep} of 5</span>
          </div>

          {/* Wizard step renderer */}
          <AnimatePresence mode="wait">
            <motion.div
              key={wizardStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="min-h-[220px] flex flex-col justify-between"
            >
              {/* STEP 1: TITLE */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Hello! I am your AI project architect. Let&apos;s design your software scope together. First, <span className="text-white font-semibold">what is the title of your project?</span>
                  </p>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Headless E-commerce Store"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                  />
                </div>
              )}

              {/* STEP 2: CATEGORY SELECTION */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Excellent. Next, <span className="text-white font-semibold">what kind of application are we building?</span> Select a base template:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 hover:bg-white/[0.03] ${
                            selectedCategory === cat.id
                              ? "bg-indigo-500/5 border-indigo-500/40 text-white"
                              : "bg-white/[0.01] border-white/[0.06] text-gray-400"
                          }`}
                        >
                          <CatIcon className={`w-5 h-5 shrink-0 mt-0.5 ${selectedCategory === cat.id ? "text-indigo-400" : ""}`} />
                          <div>
                            <p className="text-xs font-bold text-white uppercase tracking-wider mb-0.5">{cat.name}</p>
                            <p className="text-[11px] text-gray-500 leading-normal">{cat.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: FEATURES SELECTION */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Now, <span className="text-white font-semibold">select the features</span> you need. Notice how the cost calculator on the side updates in real-time:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[250px] overflow-y-auto pr-1">
                    {features.map((feat) => {
                      const isSelected = selectedFeatures.includes(feat.id);
                      return (
                        <div
                          key={feat.id}
                          onClick={() => toggleFeature(feat.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs hover:bg-white/[0.03] ${
                            isSelected
                              ? "bg-indigo-500/5 border-indigo-500/40 text-white"
                              : "bg-white/[0.01] border-white/[0.06] text-gray-400"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-white truncate">{feat.name}</p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{feat.desc}</p>
                          </div>
                          <span className={`shrink-0 font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold"
                              : "bg-white/[0.04] border-white/[0.06] text-gray-600"
                          }`}>
                            +{feat.hours}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: ADDITIONAL REQUIREMENTS */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Got it. Please describe any <span className="text-white font-semibold">custom details or preferences</span> for your features:
                  </p>
                  <textarea
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe specific API requirements, styling requests, layouts, wordpress themes, etc..."
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none font-mono"
                  />
                </div>
              )}

              {/* STEP 5: BUDGETING & REVIEW */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Finally, <span className="text-white font-semibold">what is your target budget (INR)?</span> We will analyze if this fits your chosen scope:
                  </p>
                  <div className="space-y-4">
                    <input
                      type="number"
                      value={newBudget}
                      onChange={(e) => setNewBudget(e.target.value)}
                      placeholder="e.g., 20000"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                    />
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-gray-500 leading-normal">
                      <span className="text-indigo-400 font-semibold block mb-1">Final Scoping Overview:</span>
                      - Category: {categories.find(c => c.id === selectedCategory)?.name} <br />
                      - Features: {selectedFeatures.length} selected ({features.filter(f => selectedFeatures.includes(f.id)).map(f => f.name).join(", ") || "None"}) <br />
                      - Live Scoped Cost: ₹{getLiveCostMin().toLocaleString()} - ₹{getLiveCostMax().toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: ESTIMATE DISPLAY */}
              {wizardStep === 6 && estimateResult && (
                <div className="space-y-4">
                  <p className="text-sm text-green-400 font-semibold flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    AI Estimator Summary Completed!
                  </p>
                  
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 space-y-4 text-xs leading-normal">
                    <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-3 font-mono">
                      <div>
                        <span className="text-gray-500">Estimated hours:</span> <br />
                        <span className="text-white font-bold text-sm">{estimateResult.estimatedHoursMin}h - {estimateResult.estimatedHoursMax}h</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Estimated cost:</span> <br />
                        <span className="text-white font-bold text-sm">₹{estimateResult.estimatedCostMin.toLocaleString()} - ₹{estimateResult.estimatedCostMax.toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-400 block mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        AI Budget Outlook
                      </span>
                      <p className="text-gray-300 leading-relaxed">{estimateResult.budgetOutlook}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation controls */}
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 mt-6">
                {wizardStep > 1 && wizardStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(prev => prev - 1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {wizardStep < 5 && (
                  <button
                    type="button"
                    disabled={wizardStep === 1 && !newTitle.trim()}
                    onClick={() => setWizardStep(prev => prev + 1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all disabled:opacity-30"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {wizardStep === 5 && (
                  <motion.button
                    id="btn-scoping-wizard"
                    type="button"
                    disabled={estimating}
                    onClick={handleEstimate}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25"
                  >
                    {estimating ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {estimating ? "Analyzing requirements..." : "Analyze Scope with AI"}
                  </motion.button>
                )}

                {wizardStep === 6 && (
                  <div className="flex items-center gap-3 w-full justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEstimateResult(null);
                        setWizardStep(1);
                      }}
                      className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Reset Wizard
                    </button>
                    {projects.length > 0 && projects[0].status === "estimated" && (
                      <motion.button
                        id="btn-approve-wizard"
                        type="button"
                        onClick={() => handleApproveProject(projects[0].id, projects[0].estimated_cost_min)}
                        disabled={approvingId === projects[0].id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/10"
                      >
                        {approvingId === projects[0].id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Approve Estimate & Start Project
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Live Estimator Dashboard Widget (Right Column) */}
        {wizardStep < 6 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 space-y-4 shrink-0">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-mono flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              Live Pricing Estimator
            </h3>

            <div className="space-y-4">
              {/* Cost Range display */}
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/15">
                <span className="text-[10px] text-gray-500 font-mono block mb-1">Estimated Cost Range (INR)</span>
                <p className="text-2xl font-bold text-white font-mono">
                  ₹{getLiveCostMin().toLocaleString()} - ₹{getLiveCostMax().toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-600 leading-relaxed mt-1">Calculated based on standard Kerala rates for selected options + platform buffer.</p>
              </div>

              {/* Hour Range display */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                  <span className="text-[10px] text-gray-500 block mb-0.5">Min Hours</span>
                  <span className="text-sm font-bold text-white">{getLiveHoursMin()} hrs</span>
                </div>
                <div className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                  <span className="text-[10px] text-gray-500 block mb-0.5">Max Hours</span>
                  <span className="text-sm font-bold text-white">{getLiveHoursMax()} hrs</span>
                </div>
              </div>

              {/* Selected breakdown list */}
              <div className="pt-4 border-t border-white/[0.04]">
                <span className="text-[10px] text-gray-500 font-mono block mb-2">Estimator Checklist:</span>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 text-[11px] text-gray-400">
                  <div className="flex justify-between items-center text-white font-medium border-b border-white/5 pb-1">
                    <span>{categories.find(c => c.id === selectedCategory)?.name}</span>
                    <span>Base</span>
                  </div>
                  {features.filter(f => selectedFeatures.includes(f.id)).map(f => (
                    <div key={`roll-${f.id}`} className="flex justify-between items-center">
                      <span>{f.name}</span>
                      <span className="font-mono text-[10px] text-purple-400 font-medium">+{f.hours}h</span>
                    </div>
                  ))}
                  {selectedFeatures.length === 0 && (
                    <p className="text-[10px] text-gray-600 italic">No additional features selected.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Projects List */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-indigo-400" />
          Your Projects
        </h2>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <FolderKanban className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No projects yet. Complete the Interactive Architect above to submit one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => {
              const status = statusConfig[project.status] || statusConfig.pending_estimation;
              const taskCount = projectTaskCounts[project.id] || { total: 0, completed: 0 };
              const progress = taskCount.total > 0 ? (taskCount.completed / taskCount.total) * 100 : 0;

              const costMin = project.estimated_cost_min || project.estimated_cost || 0;
              const costMax = project.estimated_cost_max || project.estimated_cost || 0;
              const hoursMin = project.estimated_hours_min || project.estimated_hours || 0;
              const hoursMax = project.estimated_hours_max || project.estimated_hours || 0;

              const isPendingScope = project.status === "pending_estimation";

              return (
                <motion.div
                  key={project.id}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 hover:border-white/10 transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-white font-semibold text-sm truncate pr-3">{project.title}</h3>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 font-mono">
                      {isPendingScope ? (
                        <span>Scoping requirements...</span>
                      ) : (
                        <>
                          <span>₹{costMin.toLocaleString("en-IN")} - ₹{costMax.toLocaleString("en-IN")}</span>
                          <span>{hoursMin}h - {hoursMax}h estimated</span>
                        </>
                      )}
                    </div>

                    {project.client_budget > 0 && (
                      <p className="text-xs text-indigo-400/80 mb-3 font-mono">
                        Target Budget: ₹{Number(project.client_budget).toLocaleString("en-IN")}
                      </p>
                    )}

                    {project.budget_outlook && (
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px] text-gray-400 leading-relaxed mb-4">
                        <span className="font-semibold text-indigo-400 block mb-1">AI Budget Analysis:</span>
                        {project.budget_outlook}
                      </div>
                    )}
                  </div>

                  <div>
                    {!isPendingScope && (
                      <div className="space-y-1.5 mb-2">
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
                    )}

                    {project.status === "estimated" && (
                      <motion.button
                        id={`btn-approve-${project.id}`}
                        type="button"
                        onClick={() => handleApproveProject(project.id, costMin)}
                        disabled={approvingId === project.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {approvingId === project.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {approvingId === project.id ? "Activating project..." : "Approve Estimate & Start Project"}
                      </motion.button>
                    )}
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

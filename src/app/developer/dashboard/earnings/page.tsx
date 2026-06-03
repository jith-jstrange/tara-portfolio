"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import {
  Wallet,
  IndianRupee,
  Clock,
  FolderOpen,
  TrendingUp,
  Award,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EarningsByProject {
  projectTitle: string;
  hours: number;
  earnings: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } },
};

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(500);
  const [totalHours, setTotalHours] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [projectEarnings, setProjectEarnings] = useState<EarningsByProject[]>([]);

  const fetchEarningsData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/developer/login";
      return;
    }
    const uid = session.user.id;

    // 1. Fetch developer profile for rate
    const { data: profile } = await supabase
      .from("profiles")
      .select("hourly_rate")
      .eq("id", uid)
      .single();

    const rate = profile?.hourly_rate || 500;
    setHourlyRate(rate);

    // 2. Fetch all time logs
    const { data: logsData, error: logsError } = await supabase
      .from("time_logs")
      .select(`
        hours,
        tasks (
          projects (
            title
          )
        )
      `)
      .eq("developer_id", uid);

    if (logsError) {
      console.error("Error fetching time logs for earnings:", logsError);
    } else {
      const logs = logsData || [];
      
      // Compute totals
      const totalHrs = logs.reduce((sum, log) => sum + Number(log.hours), 0);
      setTotalHours(Math.round(totalHrs * 100) / 100);
      setTotalEarnings(Math.round(totalHrs * rate));

      // Group by project
      const groups: Record<string, number> = {};
      logs.forEach((log: any) => {
        const title = log.tasks?.projects?.title || "Internal Tasks";
        groups[title] = (groups[title] || 0) + Number(log.hours);
      });

      const list: EarningsByProject[] = Object.keys(groups).map(title => ({
        projectTitle: title,
        hours: Math.round(groups[title] * 100) / 100,
        earnings: Math.round(groups[title] * rate),
      })).sort((a, b) => b.earnings - a.earnings);

      setProjectEarnings(list);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEarningsData();
  }, [fetchEarningsData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statsCards = [
    {
      label: "Total Earnings",
      value: `₹${totalEarnings.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-green-400",
      glow: "from-green-500/10",
    },
    {
      label: "Total Logged Hours",
      value: `${totalHours} hrs`,
      icon: Clock,
      color: "text-purple-400",
      glow: "from-purple-500/10",
    },
    {
      label: "Hourly Billing Rate",
      value: `₹${hourlyRate}/hr`,
      icon: Wallet,
      color: "text-indigo-400",
      glow: "from-indigo-500/10",
    },
  ];

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
          <Wallet className="w-7 h-7 text-green-400" />
          Earnings Ledger
        </h1>
        <p className="text-gray-500 text-sm mt-1">Monitor your accumulated freelance payouts and rates</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
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
                <p className="text-2xl font-bold text-white font-mono font-[family-name:var(--font-display)]">
                  {card.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Project Earnings Breakdown */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h2 className="text-base font-semibold text-white font-[family-name:var(--font-display)]">Earnings by Project</h2>

        {projectEarnings.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <FolderOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No project earnings recorded yet. Claim tasks and submit hours to generate ledger rows.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectEarnings.map((pe, idx) => (
              <motion.div
                key={pe.projectTitle}
                whileHover={{ y: -2 }}
                className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/10 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white truncate max-w-[200px]">{pe.projectTitle}</h3>
                    <Award className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
                    <span>Hours Logged:</span>
                    <span className="text-white">{pe.hours}h</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500">Accumulated Pay:</span>
                  <span className="text-green-400 font-bold text-sm">₹{pe.earnings.toLocaleString("en-IN")}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

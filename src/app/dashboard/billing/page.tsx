"use client";

import { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";
import {
  CreditCard,
  IndianRupee,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Receipt,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Invoice {
  id: string;
  project_id: string;
  amount: number;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
  projects: { title: string } | null;
}

interface BillingSummary {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
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

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<BillingSummary>({
    totalBilled: 0,
    totalPaid: 0,
    outstanding: 0,
  });
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", session.user.id);

      const projectIds = (projectsData || []).map((p) => p.id);

      if (projectIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*, projects(title)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });

      const invoicesList = (invoicesData as Invoice[]) || [];
      setInvoices(invoicesList);

      const totalBilled = invoicesList.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalPaid = invoicesList
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      setSummary({
        totalBilled,
        totalPaid,
        outstanding: totalBilled - totalPaid,
      });

      setLoading(false);
    };

    fetchInvoices();
  }, []);

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
      }
    } catch {
      console.error("Payment initiation failed");
    } finally {
      setPayingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const shortId = (id: string) => id.slice(0, 8).toUpperCase();

  const summaryCards = [
    {
      label: "Total Billed",
      value: `₹${summary.totalBilled.toLocaleString("en-IN")}`,
      icon: Receipt,
      color: "text-indigo-400",
      glow: "from-indigo-500/10",
    },
    {
      label: "Total Paid",
      value: `₹${summary.totalPaid.toLocaleString("en-IN")}`,
      icon: CheckCircle2,
      color: "text-emerald-400",
      glow: "from-emerald-500/10",
    },
    {
      label: "Outstanding",
      value: `₹${summary.outstanding.toLocaleString("en-IN")}`,
      icon: Clock,
      color: summary.outstanding > 0 ? "text-amber-400" : "text-gray-500",
      glow: summary.outstanding > 0 ? "from-amber-500/10" : "from-gray-500/5",
    },
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
      className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl lg:text-3xl font-bold text-white font-[family-name:var(--font-display)] tracking-tight flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-indigo-400" />
          Billing & Invoices
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage your payments and view invoice history</p>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {summaryCards.map((card) => {
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

      {/* Invoices Table */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)] mb-4">
          Invoice History
        </h2>

        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No invoices yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            {/* Table Header - Desktop */}
            <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_0.8fr_1fr_0.8fr] gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-white/[0.04]">
              <span>Invoice ID</span>
              <span>Project</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Date</span>
              <span>Action</span>
            </div>

            {/* Table Rows */}
            {invoices.map((invoice, idx) => (
              <motion.div
                key={invoice.id}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                className={`group transition-colors ${
                  idx < invoices.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}
              >
                {/* Desktop Row */}
                <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_0.8fr_1fr_0.8fr] gap-4 items-center px-6 py-4">
                  <span className="text-sm text-gray-400 font-mono">
                    #{shortId(invoice.id)}
                  </span>
                  <span className="text-sm text-white truncate">
                    {invoice.projects?.title || "—"}
                  </span>
                  <span className="text-sm text-white font-medium">
                    ₹{Number(invoice.amount).toLocaleString("en-IN")}
                  </span>
                  <span>
                    {invoice.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                        <Clock className="w-3 h-3" />
                        Unpaid
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(invoice.created_at)}
                  </span>
                  <span>
                    {invoice.status === "unpaid" ? (
                      <motion.button
                        id={`btn-pay-${invoice.id}`}
                        type="button"
                        onClick={() => handlePay(invoice.id)}
                        disabled={payingId === invoice.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-medium shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
                      >
                        {payingId === invoice.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        Pay Now
                      </motion.button>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </span>
                </div>

                {/* Mobile Row */}
                <div className="md:hidden px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-mono">#{shortId(invoice.id)}</span>
                    {invoice.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                        <Clock className="w-3 h-3" />
                        Unpaid
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white font-medium">{invoice.projects?.title || "—"}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">
                      ₹{Number(invoice.amount).toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(invoice.created_at)}</span>
                  </div>
                  {invoice.status === "unpaid" && (
                    <motion.button
                      id={`btn-pay-mobile-${invoice.id}`}
                      type="button"
                      onClick={() => handlePay(invoice.id)}
                      disabled={payingId === invoice.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/10 disabled:opacity-50"
                    >
                      {payingId === invoice.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Pay Now
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

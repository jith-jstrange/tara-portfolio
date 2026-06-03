"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  CheckSquare,
  Clock,
  Wallet,
  Activity,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { id: "nav-dashboard", label: "Dashboard", href: "/developer/dashboard", icon: <LayoutGrid className="w-4 h-4" /> },
  { id: "nav-tasks", label: "Tasks", href: "/developer/dashboard/tasks", icon: <CheckSquare className="w-4 h-4" /> },
  { id: "nav-timesheet", label: "Timesheet", href: "/developer/dashboard/timesheet", icon: <Clock className="w-4 h-4" /> },
  { id: "nav-earnings", label: "Earnings", href: "/developer/dashboard/earnings", icon: <Wallet className="w-4 h-4" /> },
  { id: "nav-agent-monitor", label: "Agent Monitor", href: "/developer/dashboard/agent-monitor", icon: <Activity className="w-4 h-4" /> },
];

export default function DeveloperDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [developerName, setDeveloperName] = useState("Developer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/developer/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", session.user.id)
          .single();

        if (profileError || !profile || profile.role !== "developer") {
          await supabase.auth.signOut();
          router.push("/developer/login");
          return;
        }

        setDeveloperName(profile.full_name || "Developer");
        setLoading(false);
      } catch {
        router.push("/developer/login");
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/developer/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full"
        />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-display">Strange Labs</h2>
                <p className="text-[10px] text-gray-500 tracking-wide">DEV PORTAL</p>
              </div>
            </div>
            <button
              id="sidebar-close"
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Developer info */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/20 flex items-center justify-center text-sm font-semibold text-purple-300">
              {developerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{developerName}</p>
              <p className="text-[11px] text-green-400 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                <span>Online</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <motion.a
              key={item.id}
              id={item.id}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
                setSidebarOpen(false);
              }}
              whileHover={{ x: 2 }}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.href)
                  ? "bg-white/[0.08] text-white border border-white/10"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              <span className={isActive(item.href) ? "text-purple-400" : ""}>{item.icon}</span>
              <span>{item.label}</span>
              {isActive(item.href) && (
                <ChevronRight className="w-3 h-3 ml-auto text-purple-400" />
              )}
            </motion.a>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            id="nav-logout"
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-xl">
          <button
            id="sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Terminal className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white font-display">Strange Labs</span>
          </div>
          <div className="w-5" /> {/* Spacer for balance */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

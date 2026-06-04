"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle, Terminal, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function MCPAuthPage() {
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get("session");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [developerName, setDeveloperName] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = `/developer/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }

      // Verify developer role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "developer") {
        setError("Only registered developers can approve IDE connection requests.");
        setLoading(false);
        return;
      }

      setDeveloperName(profile.full_name || "Developer");
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleApprove = async () => {
    if (!sessionToken) return;
    setApproving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expired. Please log in again.");
      }

      const response = await fetch("/api/mcp/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to authorize IDE pairing");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-sm text-gray-500 font-mono">Verifying authorization session...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-6 lg:p-8 space-y-6 text-center shadow-2xl"
      >
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto">
          <Terminal className="w-8 h-8 text-purple-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white font-display">
            Link Your Local IDE
          </h1>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
            Authorize connection to configure the Model Context Protocol (MCP) server for **Antigravity**, **Cursor**, or **VS Code**.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-left space-y-2 font-mono text-gray-400">
          <div className="flex justify-between">
            <span>Developer:</span>
            <span className="text-white font-semibold">{developerName}</span>
          </div>
          <div className="flex justify-between">
            <span>Session Key:</span>
            <span className="text-purple-400 font-semibold">{sessionToken?.substring(0, 12)}...</span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs flex items-center gap-2 text-left leading-normal font-mono">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs space-y-2 font-mono"
          >
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-bold text-sm">Connection Authorized!</p>
            <p className="text-[11px] text-gray-500">You can close this window now and return to your terminal script.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={!sessionToken || approving}
              onClick={handleApprove}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-50"
            >
              {approving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Approve IDE Connection"
              )}
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 text-xs transition-all font-mono"
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

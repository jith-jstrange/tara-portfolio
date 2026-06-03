"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Terminal, Eye, EyeOff, ArrowRight, Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "signin" | "signup";

export default function DeveloperLoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [hourlyRate, setHourlyRate] = useState(500);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 120, damping: 14 },
    },
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setHourlyRate(500);
    setError(null);
    setSuccess(null);
  };

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
    resetForm();
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Verify role is developer
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== "developer") {
        await supabase.auth.signOut();
        throw new Error("This portal is for developers only. Please use the client login.");
      }

      router.push("/developer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "developer",
            hourly_rate: hourlyRate,
          },
        },
      });

      if (authError) throw authError;

      setSuccess("Account created! Check your email for verification, then sign in.");
      setActiveTab("signin");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#030303] px-6">
      {/* Background radial glows */}
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-pink-600/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

      <motion.div
        className="relative z-10 w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Branding */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400 text-xs font-semibold tracking-wide mb-4 backdrop-blur-sm">
            <Terminal className="w-3.5 h-3.5" />
            <span>Developer Portal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
          </div>
          <h1 className="text-3xl font-bold text-white font-display tracking-tight">
            Strange Labs
          </h1>
          <p className="text-sm text-gray-500 mt-1">Developer Authentication</p>
        </motion.div>

        {/* Glass card */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-8 shadow-2xl shadow-black/40"
        >
          {/* Tabs */}
          <div className="flex rounded-xl bg-white/[0.03] border border-white/5 p-1 mb-8">
            <button
              id="dev-tab-signin"
              type="button"
              onClick={() => handleTabSwitch("signin")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "signin"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Sign In
            </button>
            <button
              id="dev-tab-signup"
              type="button"
              onClick={() => handleTabSwitch("signup")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "signup"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error / Success Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {activeTab === "signin" ? (
              <motion.form
                key="signin-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignIn}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="dev-signin-email" className="block text-sm font-medium text-gray-400 mb-2">
                    Email
                  </label>
                  <input
                    id="dev-signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="developer@strangelabs.online"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="dev-signin-password" className="block text-sm font-medium text-gray-400 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="dev-signin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm pr-12"
                    />
                    <button
                      id="dev-toggle-password-signin"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  id="dev-signin-submit"
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="signup-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignUp}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="dev-signup-name" className="block text-sm font-medium text-gray-400 mb-2">
                    Full Name
                  </label>
                  <input
                    id="dev-signup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Jithin Jayakumar"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="dev-signup-email" className="block text-sm font-medium text-gray-400 mb-2">
                    Email
                  </label>
                  <input
                    id="dev-signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="developer@strangelabs.online"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="dev-signup-password" className="block text-sm font-medium text-gray-400 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="dev-signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm pr-12"
                    />
                    <button
                      id="dev-toggle-password-signup"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="dev-signup-rate" className="block text-sm font-medium text-gray-400 mb-2">
                    Hourly Rate (₹)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="dev-signup-rate"
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      min={100}
                      max={5000}
                      step={50}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Kerala range: Junior ₹300–500 · Senior ₹800–1500
                  </p>
                </div>

                <motion.button
                  id="dev-signup-submit"
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Create Developer Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Client link */}
          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm text-gray-500 hover:text-purple-400 transition-colors"
            >
              Are you a client? Sign in here →
            </a>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center text-xs text-gray-600 mt-6"
        >
          © 2026 Strange Labs · strangelabs.online
        </motion.p>
      </motion.div>
    </main>
  );
}

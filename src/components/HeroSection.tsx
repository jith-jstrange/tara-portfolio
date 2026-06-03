"use client";

import { motion, Variants } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";

export default function HeroSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
      },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#030303] px-6 pt-24">
      {/* Background radial glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Grid overlay for tech look */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

      <motion.div
        className="relative max-w-5xl mx-auto text-center z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Floating tech badge */}
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-xs font-semibold tracking-wide mb-6 backdrop-blur-sm"
          whileHover={{ scale: 1.05 }}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Antigravity IDE Connected</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-none mb-6"
        >
          Strange Labs
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI-Powered Freelance
          </span>
          <br />
          Development Hub
        </motion.h1>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          Welcome to <strong className="text-white font-semibold">Strange Labs</strong> — where AI meets freelance development. Submit your project, get instant AI-powered estimates, track progress in real-time, and pay seamlessly. Built by{" "}
          <span className="text-indigo-400 font-semibold">jstrange</span> from Kerala, India.
        </motion.p>

        {/* Call to Actions */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <motion.a
            id="hero-start-project"
            href="/login"
            className="group flex items-center space-x-2 px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition-all shadow-lg shadow-white/10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>Start a Project</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </motion.a>
          <motion.a
            id="hero-developer-portal"
            href="/developer/login"
            className="flex items-center space-x-2 px-8 py-4 rounded-full border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-all backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>Developer Portal</span>
          </motion.a>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto"
        >
          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:border-white/10 transition-all">
            <h3 className="text-white font-semibold text-base mb-2">🤖 AI Project Manager</h3>
            <p className="text-sm text-gray-400">
              Gemini-powered scoping, estimation, and communication. Get instant project breakdowns.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:border-white/10 transition-all">
            <h3 className="text-white font-semibold text-base mb-2">⚡ Real-time Tracking</h3>
            <p className="text-sm text-gray-400">
              Live task boards, time logging, and milestone tracking for complete transparency.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:border-white/10 transition-all">
            <h3 className="text-white font-semibold text-base mb-2">💳 Seamless Payments</h3>
            <p className="text-sm text-gray-400">
              Stripe-integrated billing with Kerala-standard developer rates and transparent pricing.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

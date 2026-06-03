"use client";

import { motion } from "framer-motion";
import { Cpu, Globe, Server, Database, GitBranch, Layers, Sparkles } from "lucide-react";

export default function SkillsSection() {
  const categories = [
    {
      title: "Frontend Engineering",
      icon: Globe,
      description: "Crafting highly responsive and accessible user interfaces.",
      skills: ["React 19", "Next.js 16 (App Router)", "TypeScript", "Tailwind CSS v4", "Framer Motion", "HTML5 / CSS3"],
    },
    {
      title: "Netlify Platform",
      icon: Server,
      description: "Leveraging modern hosting infrastructure primitives.",
      skills: ["Serverless & Edge Functions", "Netlify Blobs (KV Store)", "Netlify Database (Postgres)", "Image CDN Optimization", "File-Based Uploads"],
    },
    {
      title: "DevOps & Tooling",
      icon: GitBranch,
      description: "Managing pipelines, repositories, and local emulation.",
      skills: ["Git & GitHub Integrations", "Netlify CLI", "MCP Configuration", "Vite & Build plugins", "NPM & Package Managers"],
    },
    {
      title: "AI Integration",
      icon: Cpu,
      description: "Incorporating autonomous agent coding into workflows.",
      skills: ["Antigravity SDK / Agent", "Model Context Protocol", "AI Context Files (.mdc)", "Agent Runner Recipes"],
    },
  ];

  return (
    <section id="skills" className="relative py-24 bg-[#050505] px-6">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400 text-xs font-semibold tracking-wide mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Core Capabilities</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold text-white mb-4"
          >
            My Tech Toolbox
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 max-w-xl mx-auto text-base"
          >
            A curated list of modern web development tools and platforms I use to build premium experiences.
          </motion.p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {categories.map((category, idx) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 rounded-3xl border border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <category.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">{category.title}</h3>
                  <p className="text-xs text-gray-500">{category.description}</p>
                </div>
              </div>

              {/* Skills Tags */}
              <div className="flex flex-wrap gap-2.5 mt-6">
                {category.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3.5 py-1.5 rounded-full border border-white/5 bg-white/[0.02] text-xs text-gray-400 hover:text-white hover:border-indigo-400/30 hover:bg-indigo-450/5 transition-all cursor-default"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

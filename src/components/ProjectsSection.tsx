"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowUpRight, ExternalLink, ShoppingBag, FolderGit2, Star, Eye } from "lucide-react";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export default function ProjectsSection() {
  const projects = [
    {
      title: "Blakmarket",
      subtitle: "Flagship E-Commerce Platform",
      description: "An elegant, premium e-commerce platform custom-built with high-performance frameworks to offer shoppers a swift, secure interface.",
      tech: ["Next.js", "React", "Postgres", "Tailwind CSS", "Netlify Edge"],
      status: "Live & Active",
      url: "https://blakmarket.in",
      github: null,
      icon: ShoppingBag,
      featured: true,
    },
    {
      title: "Tara Portfolio",
      subtitle: "Next-Gen AI Portfolio",
      description: "A premium developer portfolio website designed for direct interaction with AI code agents. Built fully utilizing Netlify primitives.",
      tech: ["React 19", "Next.js 16", "Tailwind CSS v4", "Framer Motion", "MCP"],
      status: "Active Development",
      url: "#",
      github: "https://github.com/jith-jstrange/tara-portfolio",
      icon: FolderGit2,
      featured: false,
    },
    {
      title: "Project Aether",
      subtitle: "Upcoming AI-Driven Analytics",
      description: "A serverless dashboard leveraging Netlify Database and Blobs to aggregate metrics from local development environments and runtimes.",
      tech: ["Next.js", "Netlify Blobs", "Netlify Database", "Chart.js"],
      status: "Upcoming (Q3 2026)",
      url: null,
      github: null,
      icon: Star,
      featured: false,
    },
    {
      title: "Lumina Studio",
      subtitle: "Upcoming Glassmorphic UI Library",
      description: "An interactive library of premium CSS/Tailwind components featuring rich fluid animations, custom scroll effects, and accessibility metrics.",
      tech: ["React", "Tailwind CSS", "Framer Motion", "A11y Auditor"],
      status: "Upcoming (Q4 2026)",
      url: null,
      github: null,
      icon: Eye,
      featured: false,
    },
  ];

  return (
    <section id="projects" className="relative py-24 bg-[#030303] px-6">
      {/* Background Glows */}
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-xs font-semibold tracking-wide mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Showcase</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold text-white mb-4"
          >
            My Projects
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 max-w-xl mx-auto text-base"
          >
            Explore live applications and upcoming developments created with clean code and advanced tooling.
          </motion.p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project, idx) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`p-8 rounded-3xl border transition-all flex flex-col justify-between ${
                project.featured
                  ? "border-indigo-500/20 bg-gradient-to-br from-indigo-950/10 via-white/[0.01] to-white/[0.01]"
                  : "border-white/5 bg-white/[0.01]"
              } hover:border-white/10`}
              whileHover={{ y: -6 }}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  {/* Icon */}
                  <div className="p-3 rounded-2xl bg-white/5 text-white">
                    <project.icon className="w-6 h-6" />
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      project.status.includes("Live")
                        ? "bg-green-500/10 text-green-400 border border-green-500/10"
                        : project.status.includes("Upcoming")
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-1">{project.title}</h3>
                <h4 className="text-sm text-indigo-400 font-medium mb-4">{project.subtitle}</h4>
                <p className="text-sm text-gray-400 leading-relaxed mb-6">{project.description}</p>
              </div>

              <div>
                {/* Tech tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {project.tech.map((t) => (
                    <span key={t} className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-md">
                      {t}
                    </span>
                  ))}
                </div>

                {/* Links */}
                <div className="flex items-center space-x-4">
                  {project.url && (
                    <a
                      href={project.url}
                      target={project.url.startsWith("http") ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-sm font-semibold text-white hover:text-indigo-300 transition-colors"
                    >
                      <span>Visit Site</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  )}
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                      <GithubIcon className="w-4 h-4" />
                      <span>Source Code</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

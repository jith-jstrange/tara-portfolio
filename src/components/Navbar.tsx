"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Code, Briefcase, User, Mail, Sparkles, LogIn, Terminal } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { name: "About", href: "#about", icon: User },
    { name: "Skills", href: "#skills", icon: Code },
    { name: "Projects", href: "#projects", icon: Briefcase },
    { name: "Contact", href: "#contact", icon: Mail },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      <nav
        className={`mx-auto max-w-7xl px-6 py-4 transition-all duration-300 ${
          scrolled
            ? "my-4 mx-4 md:mx-auto rounded-full border border-white/10 bg-black/40 backdrop-blur-md shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.a
            href="#"
            className="flex items-center space-x-2 text-white font-bold tracking-tight"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <div className="flex flex-col leading-tight">
              <span className="text-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Strange Labs
              </span>
              <span className="text-[10px] text-gray-500 font-medium tracking-wider">
                by jstrange
              </span>
            </div>
          </motion.a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <motion.a
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors relative py-1"
                whileHover={{ y: -1 }}
              >
                {item.name}
              </motion.a>
            ))}
            <div className="flex items-center space-x-3">
              <motion.a
                id="navbar-client-portal"
                href="/login"
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center space-x-1.5"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Client Portal</span>
              </motion.a>
              <motion.a
                id="navbar-developer-portal"
                href="/developer/login"
                className="px-4 py-2 text-xs font-semibold text-gray-300 border border-white/10 bg-white/5 rounded-full hover:bg-white/10 hover:text-white transition-all flex items-center space-x-1.5 backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Developer</span>
              </motion.a>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              id="navbar-mobile-toggle"
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-white/10 bg-black/90 backdrop-blur-lg"
          >
            <div className="px-6 py-4 space-y-4">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-3 text-gray-300 hover:text-white py-2 border-b border-white/5 last:border-0"
                >
                  <item.icon className="w-4 h-4 text-indigo-400" />
                  <span>{item.name}</span>
                </a>
              ))}

              {/* Portal Links */}
              <div className="pt-2 space-y-3">
                <a
                  id="navbar-mobile-client-portal"
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Client Portal</span>
                </a>
                <a
                  id="navbar-mobile-developer-portal"
                  href="/developer/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-gray-300 border border-white/10 bg-white/5 rounded-full hover:bg-white/10 hover:text-white transition-all"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Developer Portal</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

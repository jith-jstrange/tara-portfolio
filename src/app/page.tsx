import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import SkillsSection from "@/components/SkillsSection";
import ProjectsSection from "@/components/ProjectsSection";
import ContactSection from "@/components/ContactSection";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#030303] text-white selection:bg-indigo-500/30 selection:text-white antialiased overflow-x-hidden">
      <Navbar />
      <main className="flex-grow">
        <HeroSection />
        <SkillsSection />
        <ProjectsSection />
        <ContactSection />
      </main>
      <footer className="border-t border-white/5 bg-[#030303] py-8 px-6 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Jithin Jayakumar Sheela. All rights reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Powered by</span>
            <a href="https://netlify.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 font-semibold transition-colors">
              Netlify
            </a>
            <span>&</span>
            <span className="text-purple-400 font-semibold">Antigravity IDE</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

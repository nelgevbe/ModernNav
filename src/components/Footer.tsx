import React from "react";
import { Link as LinkIcon, Github } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { FooterLink } from "../types";

interface FooterProps {
  isDark: boolean;
  github?: string;
  links?: FooterLink[];
}

export const Footer: React.FC<FooterProps> = ({ isDark, github, links }) => {
  const { t } = useLanguage();

  return (
    <footer
      className={`relative z-10 py-5 text-center text-[11px] flex flex-col md:flex-row justify-center items-center gap-4 border-t backdrop-blur-sm transition-colors duration-500 ${
        isDark
          ? "text-white/30 border-white/5 bg-black/10"
          : "text-slate-500 border-black/5 bg-white/20"
      }`}
    >
      <div className="flex flex-wrap justify-center gap-y-2 gap-x-6 px-4">
        {links?.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--theme-primary)] cursor-pointer transition-colors"
          >
            <LinkIcon size={12} /> {link.title}
          </a>
        ))}
        {github && (
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--theme-primary)] cursor-pointer transition-colors"
          >
            <Github size={12} /> {t("about_us") || "GitHub"}
          </a>
        )}
      </div>
      <div className="flex items-center shrink-0">
        <p>
          {t("copyright")} © {new Date().getFullYear()} ModernNav
          <span className="mx-2 opacity-50">|</span>
          <span className="opacity-80">{t("powered_by")}</span>
        </p>
        <a
          href="https://github.com/lyan0220/ModernNav"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 font-semibold hover:text-[var(--theme-primary)] transition-colors"
        >
          Lyan
        </a>
      </div>
    </footer>
  );
};

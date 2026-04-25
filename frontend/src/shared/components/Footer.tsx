import { Code2, Server } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-white/5 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">

          <div className="flex items-center gap-2 text-xs sm:text-sm text-white/40">
            <Code2 size={13} strokeWidth={2} className="text-white/30" />
            <span>Developed by</span>
            <a
              href="https://github.com/PixlGalaxy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white/70 hover:text-yellow-400 transition-colors"
            >
              PixlGalaxy
            </a>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-white/40">
            <Server size={13} strokeWidth={2} className="text-white/30" />
            <span>Hosted On:</span>
            <a
              href="https://ItzGalaxy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white/70 hover:text-yellow-400 transition-colors"
            >
              ItzGalaxy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

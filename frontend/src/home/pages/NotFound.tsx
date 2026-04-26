import { Link } from 'react-router-dom';
import { Home, Wine } from 'lucide-react';
import { HomeNavbar } from '../navbar/HomeNavbar';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid relative overflow-hidden">
      <title>DrinkHub - 404</title>
      <meta name="description" content="Page not found - The room or page you're looking for doesn't exist." />

      <HomeNavbar />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center fade-up">
          <div className="mb-6 sm:mb-8 flex justify-center">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-yellow-500 via-orange-500 to-yellow-600
                          flex items-center justify-center shadow-2xl shadow-yellow-500/40 animate-float">
              <Wine size={56} className="text-white sm:hidden" strokeWidth={1.5} />
              <Wine size={80} className="text-white hidden sm:block" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-6xl sm:text-8xl font-black text-white mb-3 sm:mb-4 tracking-tight">
            404
          </h1>
          <p className="text-white/60 text-lg sm:text-3xl mb-2 sm:mb-3">
            Woah, looks like you've taken a wrong turn!
          </p>

          <p className="text-white/40 text-base sm:text-lg mb-8 sm:mb-12 max-w-md mx-auto">
            The page you're looking for might have expired or you are too drunk to write the correct path. 
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300
                         active:scale-[0.98] text-black font-bold px-6 sm:px-8 py-3 sm:py-4
                         rounded-xl transition-all shadow-lg shadow-yellow-400/20 text-base sm:text-lg"
            >
              <Home size={20} strokeWidth={2.5} />
              Back to Home
            </Link>
          </div>

          <div className="mt-12 sm:mt-16 pt-8 sm:pt-12 border-t border-white/10">
            <p className="text-white/30 text-xs sm:text-sm">
              Lost? Head to the main page and start a new game or join an existing one with a room code!
            </p>
          </div>
        </div>
      </div>

      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -z-10 opacity-20" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -z-10 opacity-20" />
    </div>
  );
};

export default NotFound;

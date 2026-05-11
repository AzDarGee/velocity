import { Clock, Moon, Sun, Shield, Activity } from "lucide-react";
import { UserButton } from "../auth/AuthUI";

interface HeaderProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  setIsHistoryOpen: (open: boolean) => void;
  setIsAdminModalOpen: (open: boolean) => void;
  isAdmin: boolean;
  mediaFilesCount: number;
  handleNewPost: () => void;
  appMode: 'narrative' | 'media';
  setAppMode: (mode: 'narrative' | 'media') => void;
}

export function Header({
  theme,
  setTheme,
  setIsHistoryOpen,
  setIsAdminModalOpen,
  isAdmin,
  mediaFilesCount,
  handleNewPost,
  appMode,
  setAppMode
}: HeaderProps) {
  return (
    <header id="onboarding-header" className={`border-b ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-[#141414] bg-white'} sticky top-0 z-20 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className={`p-2 border-2 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all`}
            title="View History"
          >
            <Clock className="w-5 h-5" />
          </button>
          
          <Logo theme={theme} onClick={handleNewPost} />

          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-[-0.05em] uppercase italic leading-none hover:tracking-normal transition-all duration-300">
              Velocity
            </h1>
            <p className="text-[9px] uppercase font-mono tracking-[0.2em] opacity-40 mt-0.5">
              Synthesis_Protocol <span className="text-yellow-600 font-bold">v1.2</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          
          <div className="hidden lg:flex items-center gap-6">
            <div className={`flex rounded-none overflow-hidden border ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'} font-mono text-[10px] uppercase tracking-widest font-bold`}>
              <button 
                onClick={() => setAppMode('narrative')}
                className={`px-4 py-2 transition-colors ${appMode === 'narrative' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Narrative
              </button>
              <button 
                onClick={() => setAppMode('media')}
                className={`px-4 py-2 border-l ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'} transition-colors ${appMode === 'media' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Media Studio
              </button>
            </div>

            <div className={`flex items-center gap-3 px-3 py-1.5 border ${theme === 'dark' ? 'border-[#333] bg-white/5' : 'border-[#141414] bg-black/5'} font-mono text-[10px]`}>
              <div className="flex items-center gap-2 pr-3 border-r border-current/20">
                <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                <span className="opacity-60 uppercase tracking-tighter">System_Live</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold">{mediaFilesCount}</span>
                <span className="opacity-40 uppercase tracking-tighter">In_Queue</span>
              </div>
            </div>
            
            {isAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className={`p-2 border-2 transition-all flex items-center gap-2 group ${
                  theme === 'dark'
                    ? 'border-indigo-500/30 text-indigo-400 hover:bg-white hover:text-black hover:border-white'
                    : 'border-indigo-600/30 text-indigo-600 hover:bg-black hover:text-white hover:border-black'
                }`}
                title="Admin Panel"
              >
                <Shield className="w-5 h-5" />
                <span className="hidden xl:block text-[10px] font-bold uppercase tracking-widest">Admin</span>
              </button>
            )}
            
            <UserButton theme={theme} />
          </div>

          {/* Fallback for smaller desktops or tablet */}
          <div className="flex lg:hidden items-center gap-3">
             {isAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className={`p-2 border-2 ${theme === 'dark' ? 'border-[#333] text-indigo-400' : 'border-[#141414] text-indigo-600'}`}
              >
                <Shield className="w-5 h-5" />
              </button>
            )}
            <UserButton theme={theme} />
          </div>
        </div>
      </div>
    </header>
  );
}

function Logo({ theme, onClick }: { theme: 'light' | 'dark', onClick: () => void }) {
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className={`w-10 h-10 border-2 relative overflow-hidden ${theme === 'dark' ? 'border-[#F8F8F7] bg-white' : 'border-[#141414] bg-black'} flex items-center justify-center transition-all duration-300 group-hover:skew-x-[-12deg] group-hover:scale-110 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]`}>
        <span className={`${theme === 'dark' ? 'text-black' : 'text-white'} font-mono text-xl font-black italic relative z-10 transition-transform group-hover:translate-x-0.5`}>V</span>
        <div className={`absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 opacity-20 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`} />
      </div>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: 'light' | 'dark', setTheme: (t: 'light' | 'dark') => void }) {
  return (
    <button 
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className={`p-2 border-2 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all`}
      aria-label="Toggle Theme"
    >
      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}


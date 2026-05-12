import { Clock, Moon, Sun, Shield, Activity } from "lucide-react";
import { UserButton } from "../auth/AuthUI";

interface HeaderProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  setIsHistoryOpen: (open: boolean) => void;
  setIsAdminModalOpen: (open: boolean) => void;
  isAdmin: boolean;
  userPlan?: string | null;
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
  userPlan,
  mediaFilesCount,
  handleNewPost,
  appMode,
  setAppMode
}: HeaderProps) {
  return (
    <header id="onboarding-header" className={`border-b ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-[#141414] bg-white'} sticky top-0 z-[60] transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-24 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className={`flex p-1.5 md:p-2 border-2 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all shrink-0`}
            title="View History"
          >
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          
          <div className="hidden lg:flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <Logo theme={theme} onClick={handleNewPost} />

            <div className="flex flex-col min-w-0">
              <h1 className="text-lg md:text-2xl font-black tracking-[-0.05em] uppercase italic leading-none hover:tracking-normal transition-all duration-300 truncate">
                Velocity
              </h1>
              <p className="hidden xs:block text-[6px] md:text-[9px] uppercase font-mono tracking-[0.1em] md:tracking-[0.2em] opacity-40 mt-0.5 truncate">
                Synthesis_Protocol <span className="text-yellow-600 font-bold hidden md:inline">v1.2</span>
              </p>
            </div>
          </div>
        </div>

        {/* Mode Hub - More responsive layout */}
        <div className="flex items-center">
          <div className={`flex rounded-none overflow-hidden border-2 ${theme === 'dark' ? 'border-[#333] bg-black' : 'border-[#141414] bg-white'} font-mono text-[9px] md:text-[11px] uppercase font-black`}>
            <button 
              onClick={() => setAppMode('narrative')}
              className={`px-2.5 md:px-6 py-2 transition-all flex items-center gap-2 ${appMode === 'narrative' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'opacity-40 hover:opacity-100'}`}
            >
              <Activity className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline tracking-widest">Narrative</span>
              <span className="sm:hidden block">WRITE</span>
            </button>
            <button 
              onClick={() => setAppMode('media')}
              disabled={!isAdmin && userPlan !== 'media'}
              className={`px-2.5 md:px-6 py-2 border-l-2 ${theme === 'dark' ? 'border-[#333]' : 'border-[#141414]'} transition-all flex items-center gap-2 ${appMode === 'media' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'opacity-40 hover:opacity-100'} ${!isAdmin && userPlan !== 'media' ? 'opacity-20 cursor-not-allowed hover:bg-transparent hover:opacity-20 hover:text-inherit' : ''}`}
            >
              <Shield className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline tracking-widest">Media Studio</span>
              <span className="sm:hidden block">STUDIO</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6 shrink-0 flex-1 justify-end">
          <div className="hidden md:block">
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
          
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 border border-current/10 font-mono text-[10px]">
            <div className="flex items-center gap-2 pr-3 border-r border-current/20">
              <Activity className="w-3 h-3 text-green-500 animate-pulse" />
              <span className="opacity-60 uppercase tracking-tighter">Live</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold">{mediaFilesCount}</span>
              <span className="opacity-40 uppercase tracking-tighter">Queue</span>
            </div>
          </div>
          
          <UserButton 
            theme={theme} 
            setTheme={setTheme}
            setIsHistoryOpen={setIsHistoryOpen}
            setIsAdminModalOpen={setIsAdminModalOpen}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );
}

function Logo({ theme, onClick }: { theme: 'light' | 'dark', onClick: () => void }) {
  return (
    <div className="group cursor-pointer shrink-0" onClick={onClick}>
      <div className={`w-8 h-8 md:w-10 md:h-10 border-2 relative overflow-hidden ${theme === 'dark' ? 'border-[#F8F8F7] bg-white' : 'border-[#141414] bg-black'} flex items-center justify-center transition-all duration-300 group-hover:skew-x-[-12deg] group-hover:scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]`}>
        <span className={`${theme === 'dark' ? 'text-black' : 'text-white'} font-mono text-sm md:text-xl font-black italic relative z-10 transition-transform group-hover:translate-x-0.5`}>V</span>
        <div className={`absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 opacity-20 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`} />
      </div>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: 'light' | 'dark', setTheme: (t: 'light' | 'dark') => void }) {
  return (
    <button 
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className={`p-1.5 md:p-2 border-2 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all`}
      aria-label="Toggle Theme"
    >
      {theme === 'light' ? <Moon className="w-4 h-4 md:w-5 md:h-5" /> : <Sun className="w-4 h-4 md:w-5 md:h-5" />}
    </button>
  );
}


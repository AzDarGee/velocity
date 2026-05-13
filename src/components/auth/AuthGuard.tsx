import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AuthUI } from './AuthUI';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children, theme }: { children: React.ReactNode, theme: 'light' | 'dark' }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-mono text-xs uppercase tracking-[0.4em] ${theme === 'dark' ? 'bg-[#0A0A0A] text-white' : 'bg-[#E4E3E0] text-black'}`}>
        <div className="flex flex-col items-center gap-6">
          <div className="grid grid-cols-2 gap-2">
            <div className={`w-4 h-4 animate-bounce [animation-delay:-0.3s] ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
            <div className={`w-4 h-4 animate-bounce [animation-delay:-0.15s] ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
            <div className={`w-4 h-4 animate-bounce [animation-delay:-0.2s] ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
            <div className={`w-4 h-4 animate-bounce ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
          </div>
          <span>Verifying_Credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-[#E4E3E0]'}`}>
        <AuthUI theme={theme} />
      </div>
    );
  }

  return <>{children}</>;
}

import { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, runTransaction } from 'firebase/firestore';
import { LogIn, UserPlus, Github, Mail, Lock, User as UserIcon, Loader2, LogOut, AlertCircle, Coins, CreditCard, ChevronRight, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

async function ensureUserProfile(user: FirebaseUser) {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email || 'unknown@example.com',
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        credits: 0
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

export function AuthUI({ theme }: { theme: 'light' | 'dark' }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        await ensureUserProfile(userCredential.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-md mx-auto p-8 space-y-8">
      <div className="text-center space-y-2">
        <div className={`w-16 h-16 mx-auto border-2 relative overflow-hidden ${theme === 'dark' ? 'border-white bg-white text-black' : 'border-black bg-black text-white'} flex items-center justify-center transition-all duration-300 hover:skew-x-[-12deg] mb-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]`}>
          <span className="font-mono text-3xl font-black italic relative z-10">V</span>
        </div>
        <h2 className="text-3xl font-black tracking-tighter uppercase italic">
          Velocity
        </h2>
        <p className="text-[10px] uppercase font-mono tracking-[0.3em] opacity-40">
          Synthesis_Protocol <span className="font-bold text-yellow-600">v1.2</span>
        </p>
      </div>

      <div className="w-full space-y-4">
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className={`w-full py-4 border-2 flex items-center justify-center gap-3 transition-all font-mono text-xs uppercase tracking-widest
            ${theme === 'dark' 
              ? 'border-white bg-white text-black hover:bg-transparent hover:text-white' 
              : 'border-black bg-black text-white hover:bg-transparent hover:text-black'}`}
        >
          <Mail className="w-4 h-4" />
          Continue with Google
        </button>

        <div className="relative py-4">
          <div className={`absolute inset-0 flex items-center ${theme === 'dark' ? 'opacity-20' : 'opacity-10'}`}>
            <div className={`w-full border-t ${theme === 'dark' ? 'border-white' : 'border-black'}`}></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest opacity-40">
            <span className={theme === 'dark' ? 'bg-[#0A0A0A] px-2' : 'bg-[#E4E3E0] px-2'}>Or Sequential Access</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60 px-1">Identity_Label</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input
                  type="text"
                  placeholder="DISPLAY_NAME"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className={`w-full pl-12 pr-4 py-3 border font-mono text-xs outline-none transition-all
                    ${theme === 'dark' 
                      ? 'bg-[#1A1A1A] border-[#333] text-white focus:border-white' 
                      : 'bg-white border-black text-black focus:bg-gray-50'}`}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60 px-1">Network_Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input
                type="email"
                placeholder="EMAIL_ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full pl-12 pr-4 py-3 border font-mono text-xs outline-none transition-all
                  ${theme === 'dark' 
                    ? 'bg-[#1A1A1A] border-[#333] text-white focus:border-white' 
                    : 'bg-white border-black text-black focus:bg-gray-50'}`}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60 px-1">Security_Cipher</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full pl-12 pr-4 py-3 border font-mono text-xs outline-none transition-all
                  ${theme === 'dark' 
                    ? 'bg-[#1A1A1A] border-[#333] text-white focus:border-white' 
                    : 'bg-white border-black text-black focus:bg-gray-50'}`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 border-2 font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all
              ${theme === 'dark' 
                ? 'border-white text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] active:shadow-none' 
                : 'border-black text-black hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none'}`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
            {isLogin ? 'Grant_Access' : 'Register_Identity'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] uppercase font-mono tracking-widest opacity-60 hover:opacity-100 transition-opacity underline decoration-dotted underline-offset-4"
          >
            {isLogin ? 'Request_New_Identity' : 'Existing_Authorization_Found'}
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 border-l-4 font-mono text-[10px] leading-tight
              ${theme === 'dark' ? 'bg-red-900/20 border-red-500 text-red-200' : 'bg-red-50 border-red-500 text-red-700'}`}
          >
            <div className="flex items-center gap-2 mb-1 font-bold uppercase tracking-widest">
              <AlertCircle className="w-3 h-3" />
              Access_Denied.log
            </div>
            {error}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function UserButton({ theme }: { theme: 'light' | 'dark' }) {
  const user = auth.currentUser;
  const [showTopUp, setShowTopUp] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => {
    if (!user) return;
    
    // Explicitly check for user profile and create if missing
    ensureUserProfile(user).catch(console.error);
    
    // Check for payment success
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('session_id');
    const payment = urlParams.get('payment');
    
    if (payment === 'success' && urlSessionId) {
      console.log('Verifying payment session...');
      fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: urlSessionId, userId: user.uid })
      }).then(res => res.json()).then(async data => {
        if (data.success && data.creditsToAdd) {
        try {
          const userRef = doc(db, 'users', user.uid);
          let actuallyAdded = false;
          await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const fulfilled = userData.fulfilled_sessions || [];
              if (!fulfilled.includes(data.sessionId)) {
                transaction.update(userRef, {
                  credits: (userData.credits || 0) + data.creditsToAdd,
                  fulfilled_sessions: [...fulfilled, data.sessionId]
                });
                actuallyAdded = true;
              }
            }
          });
          if (actuallyAdded) alert(`Payment verified! ${data.creditsToAdd} credits have been added.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }).catch(console.error);
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setCredits(doc.data().credits || 0);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleOpen = () => setShowTopUp(true);
    window.addEventListener('open-topup', handleOpen);
    return () => window.removeEventListener('open-topup', handleOpen);
  }, []);

  if (!user) return null;

  const handleBuy = async (packId: string) => {
    const checkoutWindow = window.open('', '_blank');
    if (!checkoutWindow) {
      alert("Popup blocker prevented checkout. Please open the app in a new tab or allow popups.");
      return;
    }
    checkoutWindow.document.write('<div style="font-family: monospace; padding: 20px;">Loading secure checkout...</div>');
    
    setIsBuying(packId);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId,
          userId: user.uid,
          userEmail: user.email
        })
      });
      const data = await response.json();
      if (data.url) {
        checkoutWindow.location.href = data.url;
      } else {
        checkoutWindow.close();
        alert('Payment initialization failed: ' + data.error);
      }
    } catch (err) {
      checkoutWindow.close();
      console.error(err);
    } finally {
      setIsBuying(null);
    }
  };

  const handleSyncCredits = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/stripe/sync-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (data.success && data.validSessions) {
        let totalAdded = 0;
        try {
          const userRef = doc(db, 'users', user.uid);
          await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const fulfilled = userData.fulfilled_sessions || [];
              let currentCredits = userData.credits || 0;
              let hasUpdates = false;

              for (const session of data.validSessions) {
                if (!fulfilled.includes(session.sessionId)) {
                  currentCredits += session.creditsToAdd;
                  fulfilled.push(session.sessionId);
                  totalAdded += session.creditsToAdd;
                  hasUpdates = true;
                }
              }

              if (hasUpdates) {
                transaction.update(userRef, {
                  credits: currentCredits,
                  fulfilled_sessions: fulfilled
                });
              }
            }
          });
        } catch (err) {
           handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }

        if (totalAdded > 0) alert(`Synced ${totalAdded} credits!`);
        else alert('No new successful purchases found.');
      } else {
        alert('Failed to sync: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Network error syncing credits.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-4 pl-8 border-l border-[#333]/20">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setShowTopUp(true)}
          className={`flex items-center gap-3 px-4 py-2 border-2 transition-all group
            ${theme === 'dark' 
              ? 'border-yellow-900/50 bg-yellow-900/10 hover:border-yellow-500' 
              : 'border-yellow-200 bg-yellow-50 hover:border-yellow-500'}`}
        >
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase font-mono tracking-tighter opacity-40">Credits_Bank</span>
            <span className="text-xs font-mono font-bold flex items-center gap-2">
              <Coins className={`w-3 h-3 ${credits !== null && credits < 10 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`} />
              {credits !== null ? credits : '...'}
            </span>
          </div>
          <div className={`p-1 border ${theme === 'dark' ? 'border-yellow-900/50 group-hover:bg-yellow-500 active:bg-yellow-600' : 'border-yellow-200 group-hover:bg-yellow-500 active:bg-yellow-600'} group-hover:text-black transition-colors`}>
            <CreditCard className="w-3 h-3" />
          </div>
        </button>

        <button 
          onClick={() => setShowProfile(true)}
          className="flex flex-col items-end text-left hover:opacity-70 transition-opacity"
        >
          <span className="text-[10px] uppercase font-mono tracking-tighter opacity-40">Active_User</span>
          <span className="text-xs font-mono font-bold truncate max-w-[120px]">{user.displayName || user.email}</span>
        </button>
      </div>

      <button 
        onClick={() => signOut(auth)}
        className={`p-2 border ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-black hover:bg-black hover:text-white'} transition-all`}
        title="Terminate_Session"
      >
        <LogOut className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm border-2 p-6 font-mono
                ${theme === 'dark' 
                  ? 'bg-black border-[#F8F8F7] shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] text-white' 
                  : 'bg-white border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] text-[#141414]'}`}
            >
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-dashed border-current/20">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-widest">User_Profile</h2>
                  <p className="text-[10px] opacity-50 mt-1 uppercase">ID: {user.uid}</p>
                </div>
                <button 
                  onClick={() => setShowProfile(false)}
                  className="p-2 hover:bg-current/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded flex items-center justify-center text-xl font-bold border-2
                    ${theme === 'dark' ? 'bg-[#333] border-white text-white' : 'bg-gray-100 border-black text-black'}`}>
                    {user.email?.[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold truncate max-w-[200px]">{user.displayName || 'Anonymous User'}</div>
                    <div className="text-xs opacity-60 truncate max-w-[200px]">{user.email}</div>
                  </div>
                </div>

                <div className={`p-4 border ${theme === 'dark' ? 'bg-white/5 border-white/20' : 'bg-black/5 border-black/20'}`}>
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-2">Available_Credits</div>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold flex items-center gap-2">
                       <Coins className={`w-5 h-5 ${credits !== null && credits < 10 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`} />
                       {credits !== null ? credits : '...'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        title="Sync Missing Purchases"
                        onClick={handleSyncCredits}
                        disabled={isSyncing}
                        className={`px-3 py-1 text-xs font-bold border uppercase tracking-wider
                          ${theme === 'dark' ? 'hover:bg-white hover:text-black border-white' : 'hover:bg-black hover:text-white border-black'} transition-colors disabled:opacity-50`}
                      >
                        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync'}
                      </button>
                      <button
                        onClick={() => {
                          setShowProfile(false);
                          setShowTopUp(true);
                        }}
                        className={`px-3 py-1 text-xs font-bold border uppercase tracking-wider
                          ${theme === 'dark' ? 'hover:bg-white hover:text-black border-white' : 'hover:bg-black hover:text-white border-black'} transition-colors`}
                      >
                        Top Up
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showTopUp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative max-w-2xl w-full border-2 overflow-hidden flex flex-col p-8 space-y-8
                ${theme === 'dark' ? 'bg-[#0A0A0A] border-white/20' : 'bg-[#E4E3E0] border-black'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold tracking-tighter uppercase italic">Credit_Expansion_Protocol</h3>
                  <p className="text-[10px] font-mono tracking-widest opacity-40 uppercase">Upgrade synthesis capacity via secure terminal</p>
                </div>
                <button 
                  onClick={() => setShowTopUp(false)}
                  className={`p-2 transition-colors ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                >
                  <AlertCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'pack-50', name: 'Starter', credits: 50, price: '$1' },
                  { id: 'pack-200', name: 'Content', credits: 200, price: '$1', tag: 'Best Value' },
                  { id: 'pack-500', name: 'Pro', credits: 500, price: '$1' },
                  { id: 'pack-1000', name: 'Enterprise', credits: 1000, price: '$1' }
                ].map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => handleBuy(pack.id)}
                    disabled={isBuying !== null}
                    className={`p-6 border-2 flex flex-col items-start gap-4 transition-all relative group
                      ${theme === 'dark' 
                        ? 'border-[#333] bg-[#141414] hover:border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]' 
                        : 'border-black bg-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                      active:shadow-none active:translate-x-[2px] active:translate-y-[2px] overflow-hidden`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest opacity-40">{pack.name}_Unit</span>
                        <div className="text-2xl font-bold font-mono">{pack.credits} <span className="text-xs italic opacity-60">CRD</span></div>
                      </div>
                      <div className={`text-xl font-bold font-mono ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'}`}>
                        {pack.price}
                      </div>
                    </div>
                    
                    {pack.tag && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-yellow-500 text-black text-[8px] font-mono font-bold uppercase tracking-widest rotate-6">
                        {pack.tag}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {isBuying === pack.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Initializing_Checkout
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3 h-3" />
                          Authorize_Stripe_Transfer
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className={`p-4 border-l-2 font-mono text-[10px] leading-relaxed opacity-60
                ${theme === 'dark' ? 'border-white/20' : 'border-black/20'}`}>
                Note: Each generation cycle consumes 5.0 credits. Transactions handled via Stripe secure relay. 
                Credits are applied immediately upon confirmation of successful relay.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

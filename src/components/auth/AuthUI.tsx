import { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  deleteUser,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, runTransaction, writeBatch, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { LogIn, UserPlus, Github, Mail, Lock, User as UserIcon, Loader2, LogOut, AlertCircle, Coins, CreditCard, ChevronRight, Check, X, Trash2, Activity, History as HistoryIcon, Wallet, Wand2, Star, Sparkles, Settings, Clock, Shield, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

// Cache strictly handles ongoing operations to prevent race conditions (e.g. AuthUI and UserButton calling concurrently)
const ensureUserProfilePromises = new Map<string, Promise<void>>();

async function ensureUserProfile(user: FirebaseUser) {
  if (ensureUserProfilePromises.has(user.uid)) {
    return ensureUserProfilePromises.get(user.uid);
  }

  const promise = (async () => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: user.email || 'unknown@example.com',
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          credits: 50
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  })();

  ensureUserProfilePromises.set(user.uid, promise);

  try {
    await promise;
  } finally {
    ensureUserProfilePromises.delete(user.uid);
  }
}

export function AuthUI({ theme }: { theme: 'light' | 'dark' }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, returnUrl: window.location.origin })
      });
      const data = await response.json();
      if (data.success) {
        setResetSent(true);
      } else {
        throw new Error(data.error || "Failed to send password reset email.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Please add this app URL to your Firebase Console > Authentication > Settings > Authorized domains.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing. Please try again.');
      } else {
        setError(err.message || 'Google sign-in failed. You may need to verify your Firebase OAuth configuration.');
      }
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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          // Send custom verification email via Resend if unverified on login
          try {
            await fetch('/api/auth/send-verification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userCredential.user.email, returnUrl: window.location.origin })
            });
            setError("Security check: Your email signature is unverified. A fresh verification link has been transmitted to your inbox. Please authorize to unlock all synthesis protocols.");
          } catch (vErr) {
            console.error("Verification email failed to send on login:", vErr);
          }
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        await ensureUserProfile(userCredential.user);
        
        // Send custom verification email via Resend
        try {
          await fetch('/api/auth/send-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, returnUrl: window.location.origin })
          });
        } catch (vErr) {
          console.error("Verification email failed to send, but user was created:", vErr);
        }
      }
    } catch (err: any) {
      try {
        const parsed = JSON.parse(err.message);
        setError(`Database Error: ${parsed.error || 'Access Denied'}`);
      } catch {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] w-full max-w-md mx-auto p-8 space-y-8 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
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
        <p className={`text-[9px] font-mono opacity-50 text-center uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Note: If sign in fails, ensure popups are allowed or open the app in a new tab.</p>

        <div className="relative py-4">
          <div className={`absolute inset-0 flex items-center ${theme === 'dark' ? 'opacity-20' : 'opacity-10'}`}>
            <div className={`w-full border-t ${theme === 'dark' ? 'border-white' : 'border-black'}`}></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest opacity-40">
            <span className={theme === 'dark' ? 'bg-[#0A0A0A] px-2' : 'bg-[#E4E3E0] px-2'}>Or Sequential Access</span>
          </div>
        </div>

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
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

            {resetSent ? (
               <div className={`p-4 border font-mono text-[10px] tracking-widest uppercase ${theme === 'dark' ? 'bg-green-900/20 border-green-500 text-green-200' : 'bg-green-50 border-green-500 text-green-700'}`}>
                 <Check className="w-4 h-4 inline-block mr-2" />
                 Transmission_Sent. If the account exists, you will receive a reset link shortly.
               </div>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 border-2 font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all
                  ${theme === 'dark' 
                    ? 'border-white text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] active:shadow-none' 
                    : 'border-black text-black hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none'}`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Init_Reset_Sequence
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setResetSent(false);
              }}
              className="w-full text-[10px] uppercase font-mono tracking-widest opacity-60 hover:opacity-100 transition-opacity"
            >
              Back_to_Checkpoint
            </button>
          </form>
        ) : (
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

            {isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-[9px] uppercase font-mono tracking-widest opacity-40 hover:opacity-100 transition-opacity underline decoration-dotted underline-offset-4"
                >
                  Forgot_Security_Cipher?
                </button>
              </div>
            )}

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
        )}

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

interface UserButtonProps {
  theme: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
  setIsHistoryOpen?: (open: boolean) => void;
  setIsAdminModalOpen?: (open: boolean) => void;
  isAdmin?: boolean;
  triggerOnboarding?: () => void;
}

export function UserButton({ 
  theme, 
  setTheme, 
  setIsHistoryOpen, 
  setIsAdminModalOpen, 
  isAdmin: isAdminProp,
  triggerOnboarding
}: UserButtonProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(isAdminProp || false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  
  const [topUpMode, setTopUpMode] = useState<'packs' | 'subs' | 'tier' | 'media'>('packs');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isPurgingHistory, setIsPurgingHistory] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  
  useEffect(() => {
    if (!user || !showProfile) return;
    
    setIsLoadingActivity(true);
    const q = query(
      collection(db, 'users', user.uid, 'activity'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActivity(activityData);
      setIsLoadingActivity(false);
    }, (err) => {
      console.error("Activity fetch failed:", err);
      setIsLoadingActivity(false);
    });
    
    return () => unsubscribe();
  }, [user, showProfile]);

  useEffect(() => {
    if (!user || !showProfile) return;
    
  }, [user, showProfile]);

  useEffect(() => {
    if (!user) return;
    
    // Explicitly check for user profile and create if missing
    ensureUserProfile(user).catch(console.error);

    // Check admin status
    if (user.email === 'ashdarji1@gmail.com' || user.email === 'ashishdarji88@gmail.com' || user.email === 'saanskarastudios@gmail.com') {
      setIsAdmin(true);
    } else {
      getDoc(doc(db, 'admins', user.uid))
        .then(adminDoc => setIsAdmin(adminDoc.exists()))
        .catch(() => setIsAdmin(false));
    }
    
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
                
                // Log activity
                const activityRef = doc(collection(db, 'users', user.uid, 'activity'));
                transaction.set(activityRef, {
                  type: 'purchase',
                  description: data.packName || `Credit Synthesis Protocol`,
                  cost: -data.creditsToAdd,
                  timestamp: serverTimestamp(),
                  metadata: { sessionId: data.sessionId }
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
        setUserPlan(doc.data().plan || null);
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
    const packNames: Record<string, string> = {
      'pack-50': 'Starter Expansion',
      'pack-200': 'Content Protocol',
      'pack-500': 'Pro Synthesis',
      'pack-1000': 'Enterprise Relay',
      'sub-weekly': 'Weekly Access',
      'sub-monthly': 'Monthly Protocol',
      'sub-yearly': 'Yearly Archive',
      'tier-basic-mo': 'Basic Tier (Mo)',
      'tier-basic-yr': 'Basic Tier (Yr)',
      'tier-pro-mo': 'Pro Tier (Mo)',
      'tier-pro-yr': 'Pro Tier (Yr)',
      'tier-unlimited-mo': 'Max Tier (Mo)',
      'tier-unlimited-yr': 'Max Tier (Yr)',
    };
    const packName = packNames[packId] || 'Credit Top-Up';

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
          userEmail: user.email,
          packName // Pass pack name for better metadata
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
                
                // Log activity if sessions were added
                for (const session of data.validSessions) {
                  const fulfilledBefore = userData.fulfilled_sessions || [];
                  if (!fulfilledBefore.includes(session.sessionId)) {
                     const activityRef = doc(collection(db, 'users', user.uid, 'activity'));
                     transaction.set(activityRef, {
                        type: 'purchase',
                        description: `Credit Protocol Sync`,
                        cost: -session.creditsToAdd,
                        timestamp: serverTimestamp(),
                        metadata: { sessionId: session.sessionId, sync: true }
                     });
                  }
                }
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

  const handlePurgeOwnHistory = async () => {
    if (!user) return;
    setIsPurgingHistory(true);
    try {
      const q = query(collection(db, 'generations'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("No generation history found to purge.");
        setShowPurgeConfirm(false);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert(`History purged! Successfully removed ${snapshot.size} records.`);
      setShowPurgeConfirm(false);
    } catch (error) {
      console.error("Purge history failed:", error);
      alert("Failed to purge history.");
      handleFirestoreError(error, OperationType.DELETE, `generations_purge_self/${user.uid}`);
    } finally {
      setIsPurgingHistory(false);
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 md:pl-8 md:border-l md:border-[#333]/20">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Credits Badge - Mobile Friendly */}
        <button 
          onClick={() => setShowTopUp(true)}
          className={`flex items-center gap-2 md:gap-3 px-2 md:px-4 py-1.5 md:py-2 border-2 transition-all group
            ${theme === 'dark' 
              ? 'border-yellow-900/50 bg-yellow-900/10 hover:border-yellow-500' 
              : 'border-yellow-200 bg-yellow-50 hover:border-yellow-500'}`}
        >
          <div className="flex flex-col items-start">
            <span className="text-[7px] md:text-[10px] uppercase font-mono tracking-tighter opacity-40 leading-none">Credits</span>
            <span className="text-[10px] md:text-xs font-mono font-bold flex items-center gap-1.5 leading-none mt-0.5">
              <Coins className={`w-2.5 h-2.5 md:w-3 md:h-3 ${credits !== null && credits < 10 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`} />
              {credits !== null ? credits : '...'}
            </span>
          </div>
          <div className={`p-0.5 md:p-1 border hidden sm:block ${theme === 'dark' ? 'border-yellow-900/50 group-hover:bg-yellow-500 active:bg-yellow-600' : 'border-yellow-200 group-hover:bg-yellow-500 active:bg-yellow-600'} group-hover:text-black transition-colors`}>
            <CreditCard className="w-2.5 h-2.5 md:w-3 md:h-3" />
          </div>
        </button>

        {/* Profile Trigger */}
        <button 
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity group"
        >
          <div className={`w-8 h-8 md:w-auto md:h-auto rounded-none flex items-center justify-center border-2 
            ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-white border-black'} md:border-0 md:bg-transparent`}>
            <UserIcon className="w-4 h-4 md:hidden" />
            <div className="hidden md:flex flex-col items-end text-left">
              <div className="flex items-center gap-1 opacity-40">
                {isAdmin && <span className="text-[8px] border border-yellow-500/50 text-yellow-500 px-1 font-black uppercase tracking-tighter">Admin</span>}
                <span className="text-[10px] uppercase font-mono tracking-tighter">Active_User</span>
              </div>
              <span className="text-xs font-mono font-bold truncate max-w-[120px] group-hover:text-yellow-500 transition-colors">
                {user?.displayName || user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </button>
      </div>

      <button 
        onClick={async () => {
          try {
            await signOut(auth);
          } catch (error) {
            console.error("Sign out error:", error);
          }
        }}
        className={`p-2 border flex items-center justify-center ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-black hover:bg-black hover:text-white'} transition-all`}
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
              className={`w-full max-w-sm border-2 p-4 md:p-6 font-mono max-h-[90vh] overflow-y-auto
                ${theme === 'dark' 
                  ? 'bg-black border-[#F8F8F7] shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] text-white' 
                  : 'bg-white border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] text-[#141414]'}`}
            >
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-dashed border-current/20">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-widest">User_Profile</h2>
                  {isAdmin && <p className="text-[10px] opacity-50 mt-1 uppercase">ID: {user?.uid}</p>}
                </div>
                <button 
                  onClick={() => setShowProfile(false)}
                  className="p-2 hover:bg-current/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">Identity_Vectors</div>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded flex items-center justify-center text-xl font-bold border-2 relative
                      ${theme === 'dark' ? 'bg-[#333] border-white text-white' : 'bg-gray-100 border-black text-black'}`}>
                      {user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                         <div className="text-sm font-bold truncate max-w-[200px]">{user?.displayName || 'Anonymous User'}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-xs opacity-60 truncate max-w-[150px]">{user?.email}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-dashed border-current/10">
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">System_Controls</div>
                  <div className="grid grid-cols-2 gap-2">
                    {setIsHistoryOpen && (
                      <button 
                         onClick={() => { setShowProfile(false); setIsHistoryOpen(true); }}
                         className={`p-3 border-2 flex flex-col gap-2 items-center justify-center ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all`}
                      >
                        <Clock className="w-4 h-4" />
                        <span className="text-[8px] uppercase font-bold tracking-widest">History</span>
                      </button>
                    )}
                    {triggerOnboarding && (
                      <button 
                         onClick={() => { setShowProfile(false); triggerOnboarding(); }}
                         className={`p-3 border-2 flex flex-col gap-2 items-center justify-center border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all`}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[8px] uppercase font-bold tracking-widest">Wizard</span>
                      </button>
                    )}
                    {setIsAdminModalOpen && isAdmin && (
                      <button 
                         onClick={() => { setShowProfile(false); setIsAdminModalOpen(true); }}
                         className={`p-3 border-2 flex flex-col gap-2 items-center justify-center border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all`}
                      >
                        <Shield className="w-4 h-4" />
                        <span className="text-[8px] uppercase font-bold tracking-widest">Admin</span>
                      </button>
                    )}
                    {setTheme && (
                      <button 
                         onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                         className={`p-3 border-2 flex flex-col gap-2 items-center justify-center ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all col-span-2`}
                      >
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        <span className="text-[8px] uppercase font-bold tracking-widest">Appearance: {theme.toUpperCase()}</span>
                      </button>
                    )}
                  </div>
                </div>
                {/* Verification Alert if needed */}
                {!user?.emailVerified && user?.email && (
                  <div className={`p-4 border border-dashed ${theme === 'dark' ? 'bg-yellow-900/10 border-yellow-500/30 text-yellow-200' : 'bg-yellow-50 border-yellow-500/30 text-yellow-800'}`}>
                    <div className="flex items-center gap-2 mb-2 font-black text-[10px] uppercase tracking-widest">
                       <AlertCircle className="w-3 h-3" />
                       Action_Required.sh
                    </div>
                    <p className="text-[10px] leading-relaxed mb-4 opacity-80">
                      Your Identity_Signature has not been verified. Some features may be restricted until connection is secured.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/send-verification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: user?.email, returnUrl: window.location.origin })
                          });
                          alert("Verification link sent to " + user?.email);
                        } catch (err) {
                           console.error(err);
                           alert("Failed to send verification link.");
                        }
                      }}
                      className={`w-full py-2 border font-mono text-[9px] uppercase tracking-widest transition-all
                        ${theme === 'dark' ? 'border-yellow-500/50 hover:bg-yellow-500 hover:text-black' : 'border-yellow-500/50 hover:bg-yellow-500 hover:text-white'}`}
                    >
                      Resend_Verification_Protocol
                    </button>
                  </div>
                )}

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
                          const scrollElement = document.getElementById('topup-content');
                          if (scrollElement) scrollElement.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`px-3 py-1 text-xs font-bold border uppercase tracking-wider
                          ${theme === 'dark' ? 'hover:bg-white hover:text-black border-white' : 'hover:bg-black hover:text-white border-black'} transition-colors`}
                      >
                        Top Up
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-dashed border-current/10">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">Synthesis_Ledger_Archive</div>
                    <HistoryIcon className="w-3 h-3 opacity-20" />
                  </div>
                  
                  <div className={`max-h-[250px] overflow-y-auto pr-2 space-y-2 font-mono scrollbar-thin ${theme === 'dark' ? 'scrollbar-thumb-white/10' : 'scrollbar-thumb-black/10'}`}>
                    {isLoadingActivity && activity.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 opacity-20 italic text-[10px]">
                        <Loader2 className="w-4 h-4 animate-spin mb-2" />
                        Scanning_Blocks...
                      </div>
                    ) : activity.length === 0 ? (
                      <div className="py-12 text-center opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-current/10">
                        No_Transactions_Recorded
                      </div>
                    ) : (
                      activity.map((item) => (
                        <div 
                          key={item.id} 
                          className={`p-3 border border-current/10 flex items-center justify-between group transition-all transform hover:-translate-y-0.5 ${theme === 'dark' ? 'hover:bg-white/5 hover:border-white/30' : 'hover:bg-black/5 hover:border-black/30'}`}
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase truncate max-w-[140px] md:max-w-[180px]">
                              {item.description || item.type?.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2 text-[8px] opacity-40 uppercase">
                              <span>{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Pending'}</span>
                              {item.metadata?.packId && <span className="px-1 border border-current/20">{item.metadata.packId}</span>}
                              {item.metadata?.prompt && <span className="truncate italic">"{item.metadata.prompt}"</span>}
                            </div>
                          </div>
                          <div className={`text-[10px] font-bold shrink-0 ${item.type === 'purchase' || (item.cost < 0) ? 'text-green-500' : 'text-orange-500'}`}>
                            {item.cost > 0 ? `-${item.cost}` : `+${Math.abs(item.cost)}`}
                             <span className="text-[8px] ml-1 opacity-60 italic uppercase tracking-tighter">REQ</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                  <div className="pt-4 border-t border-dashed border-current/10 flex flex-col gap-3 mt-4">
                    <button
                      onClick={() => setShowPurgeConfirm(true)}
                      className={`w-full py-2 border-2 text-[10px] font-mono uppercase tracking-widest transition-all ${
                         theme === 'dark'
                            ? 'border-white/20 text-white opacity-60 hover:opacity-100 hover:border-white hover:bg-white/5'
                            : 'border-black/20 text-black opacity-60 hover:opacity-100 hover:border-black hover:bg-black/5'
                      }`}
                    >
                      Purge_History
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className={`w-full py-2 border-2 text-[10px] font-mono uppercase tracking-widest transition-all ${
                         theme === 'dark'
                            ? 'border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white'
                            : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                      }`}
                    >
                      Delete_Account
                    </button>
                 </div>
               </div>
             </motion.div>
          </div>
        )}

        {showPurgeConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className={`relative max-w-sm w-full p-8 border-2 flex flex-col gap-6 text-center ${theme === 'dark' ? 'bg-[#0A0A0A] border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.1)]' : 'bg-white border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <Trash2 className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Purge History</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  This will permanently delete all your generation results. Media assets will remain in your library.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handlePurgeOwnHistory}
                  disabled={isPurgingHistory}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    theme === 'dark' 
                      ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700' 
                      : 'bg-amber-600 text-white border-amber-600 hover:bg-black'
                  }`}
                >
                  {isPurgingHistory && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isPurgingHistory ? "Executing_Wipe..." : "Confirm_Purge"}
                </button>
                <button 
                  onClick={() => setShowPurgeConfirm(false)}
                  disabled={isPurgingHistory}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all ${
                    theme === 'dark' 
                      ? 'border-white text-white hover:bg-white hover:text-black' 
                      : 'border-black text-black hover:bg-black hover:text-white'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className={`relative max-w-sm w-full p-8 border-2 flex flex-col gap-6 text-center ${theme === 'dark' ? 'bg-[#0A0A0A] border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'bg-white border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Final Warning</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  This will permanently delete your account, wipe your data securely, and cannot be undone. Are you absolutely sure?
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                     setIsDeletingAccount(true);
                     try {
                        const currentUser = auth.currentUser;
                        if (currentUser) {
                           await deleteUser(currentUser);
                           localStorage.clear();
                           sessionStorage.clear();
                           window.location.reload();
                        }
                     } catch (e: any) {
                        if (e.code === 'auth/requires-recent-login' || (e.message && e.message.includes('auth/requires-recent-login'))) {
                           alert("For security reasons, you must log out and log back in before deleting your account. Please log in again to verify your identity.");
                        } else {
                           alert(e.message || "Failed to delete account. You may need to sign in again to perform this action.");
                        }
                     } finally {
                        setIsDeletingAccount(false);
                     }
                  }}
                  disabled={isDeletingAccount}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all ${
                    theme === 'dark' 
                      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
                      : 'bg-red-600 text-white border-red-600 hover:bg-black'
                  }`}
                >
                  {isDeletingAccount ? "Purging_User_Data..." : "Confirm_Deletion"}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeletingAccount}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all ${
                    theme === 'dark' 
                      ? 'border-white text-white hover:bg-white hover:text-black' 
                      : 'border-black text-black hover:bg-black hover:text-white'
                  }`}
                >
                  Abort
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showTopUp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              id="topup-content"
              className={`relative max-w-2xl w-full border-2 flex flex-col p-4 md:p-8 space-y-4 md:space-y-8 my-auto
                ${theme === 'dark' ? 'bg-[#0A0A0A] border-white/20' : 'bg-[#E4E3E0] border-black'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-bold tracking-tighter uppercase italic">Credit_Expansion_Protocol</h3>
                  <p className="text-[8px] md:text-[10px] font-mono tracking-widest opacity-40 uppercase">Upgrade synthesis capacity via secure terminal</p>
                </div>
                <button 
                  onClick={() => setShowTopUp(false)}
                  className={`p-2 transition-colors ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                >
                  <AlertCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className={`flex p-1 gap-1 border ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'} overflow-x-auto no-scrollbar`}>
                <button
                  onClick={() => setTopUpMode('packs')}
                  className={`flex-1 min-w-[100px] py-2.5 text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    topUpMode === 'packs' 
                      ? (theme === 'dark' ? 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]' : 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]') 
                      : 'opacity-50 hover:opacity-100 hover:bg-current/5'
                  }`}
                >
                  One-time_Packs
                </button>
                <button
                  onClick={() => setTopUpMode('subs')}
                  className={`flex-1 min-w-[100px] py-2.5 text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    topUpMode === 'subs' 
                      ? (theme === 'dark' ? 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]' : 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]') 
                      : 'opacity-50 hover:opacity-100 hover:bg-current/5'
                  }`}
                >
                  Subscriptions
                </button>
                <button
                  onClick={() => setTopUpMode('tier')}
                  className={`flex-1 min-w-[100px] py-2.5 text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    topUpMode === 'tier' 
                      ? (theme === 'dark' ? 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]' : 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]') 
                      : 'opacity-50 hover:opacity-100 hover:bg-current/5'
                  }`}
                >
                  Usage_Tiers
                </button>
                <button
                  onClick={() => setTopUpMode('media')}
                  className={`flex-1 min-w-[100px] py-2.5 text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    topUpMode === 'media' 
                      ? (theme === 'dark' ? 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]' : 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]') 
                      : 'opacity-50 hover:opacity-100 hover:bg-current/5'
                  }`}
                >
                  Media_Studio
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                {topUpMode === 'packs' ? [
                  { id: 'pack-50', name: 'Starter', credits: 50, price: '$10' },
                  { id: 'pack-200', name: 'Content', credits: 200, price: '$25', tag: 'Best Value' },
                  { id: 'pack-500', name: 'Pro', credits: 500, price: '$45' },
                  { id: 'pack-1000', name: 'Enterprise', credits: 1000, price: '$99' }
                ].map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => handleBuy(pack.id)}
                    disabled={isBuying !== null}
                    className={`p-4 md:p-6 border-2 flex flex-col items-start gap-3 md:gap-4 transition-all relative group
                      ${theme === 'dark' 
                        ? 'border-[#333] bg-[#141414] hover:border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]' 
                        : 'border-black bg-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                      active:shadow-none active:translate-x-[2px] active:translate-y-[2px] overflow-hidden`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest opacity-40">{pack.name}_Unit</span>
                        <div className="text-2xl font-bold font-mono">{pack.credits} <span className="text-[13px] italic opacity-60">CRD</span></div>
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
                )) : topUpMode === 'subs' ? [
                  { id: 'sub-weekly', name: 'Weekly', credits: 50, price: '$7', interval: 'week' },
                  { id: 'sub-monthly', name: 'Monthly', credits: 200, price: '$19', interval: 'month', tag: 'Most Popular' },
                  { id: 'sub-yearly', name: 'Yearly', credits: 1200, price: '$99', interval: 'year', tag: 'Best Value' }
                ].map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleBuy(plan.id)}
                    disabled={isBuying !== null}
                    className={`p-4 md:p-6 border-2 flex flex-col items-start gap-3 md:gap-4 transition-all relative group
                      ${theme === 'dark' 
                        ? 'border-[#333] bg-[#141414] hover:border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]' 
                        : 'border-black bg-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                      active:shadow-none active:translate-x-[2px] active:translate-y-[2px] overflow-hidden ${plan.id === 'sub-yearly' ? 'md:col-span-2' : ''}`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest opacity-40">{plan.name}_Subscription</span>
                        <div className="text-2xl font-bold font-mono">{plan.credits} <span className="text-[13px] italic opacity-60">CRD / {plan.interval === 'week' ? 'WK' : plan.interval === 'month' ? 'MO' : 'YR'}</span></div>
                      </div>
                      <div className={`text-xl font-bold font-mono ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'}`}>
                        {plan.price}<span className="text-[10px] uppercase opacity-40">/{plan.interval}</span>
                      </div>
                    </div>
                    
                    {plan.tag && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-yellow-500 text-black text-[8px] font-mono font-bold uppercase tracking-widest rotate-6">
                        {plan.tag}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {isBuying === plan.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Initializing_Subscription
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3 h-3" />
                          Activate_Recurring_Protocol
                        </>
                      )}
                    </div>
                  </button>
                )) : topUpMode === 'media' ? [
                  { id: 'sub-media-mo', name: 'Media', credits: 1000, price: '$99', interval: 'mo' },
                  { id: 'sub-media-yr', name: 'Media', credits: 1100, price: '$900', interval: 'yr' }
                ].map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleBuy(plan.id)}
                    disabled={isBuying !== null}
                    className={`p-4 md:p-6 border-2 flex flex-col items-start gap-3 md:gap-4 transition-all relative group
                      ${theme === 'dark' 
                        ? 'border-[#333] bg-[#141414] hover:border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]' 
                        : 'border-black bg-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                      active:shadow-none active:translate-x-[2px] active:translate-y-[2px] overflow-hidden`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest opacity-40">{plan.name}_Studio</span>
                        <div className="text-2xl font-bold font-mono">{plan.credits} <span className="text-[13px] italic opacity-60">CRD / MO</span></div>
                        {plan.interval === 'yr' && <span className="text-[8px] block opacity-40 italic">(accrued monthly)</span>}
                      </div>
                      <div className={`text-xl font-bold font-mono ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'}`}>
                        {plan.price}<span className="text-[10px] uppercase opacity-40">/{plan.interval}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {isBuying === plan.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Initializing_Subscription
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3 h-3" />
                          Activate_Media_Protocol
                        </>
                      )}
                    </div>
                  </button>
                )) : [
                  { id: 'tier-basic-mo', name: 'Basic', credits: 200, price: '$20', interval: 'mo', label: 'Monthly' },
                  { id: 'tier-basic-yr', name: 'Basic', credits: 200, price: '$200', interval: 'yr', label: 'Yearly' },
                  { id: 'tier-pro-mo', name: 'Pro', credits: 500, price: '$40', interval: 'mo', label: 'Monthly' },
                  { id: 'tier-pro-yr', name: 'Pro', credits: 500, price: '$420', interval: 'yr', label: 'Yearly' },
                  { id: 'tier-unlimited-mo', name: 'Unlimited', credits: 1000, price: '$75', interval: 'mo', label: 'Monthly' },
                  { id: 'tier-unlimited-yr', name: 'Unlimited', credits: 1000, price: '$800', interval: 'yr', label: 'Yearly' }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => handleBuy(tier.id)}
                    disabled={isBuying !== null}
                    className={`p-4 border-2 flex flex-col items-start gap-2 transition-all relative group
                      ${theme === 'dark' 
                        ? 'border-[#333] bg-[#141414] hover:border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]' 
                        : 'border-black bg-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                      active:shadow-none active:translate-x-[2px] active:translate-y-[2px] overflow-hidden`}
                  >
                    <div className="absolute top-2 right-2 text-[8px] font-mono uppercase bg-black/10 px-1 py-0.5 opacity-60">
                      {tier.label}
                    </div>
                    <div className="flex items-center justify-between w-full">
                       <span className="text-[10px] uppercase font-mono tracking-widest font-bold">{tier.name}</span>
                       <span className={`text-xl font-bold font-mono ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'}`}>
                          {tier.price}<span className="text-[9px] opacity-40">/{tier.interval}</span>
                       </span>
                    </div>
                    <div className="text-xl font-bold font-mono">
                      {tier.credits} <span className="text-[13px] italic opacity-60">CRD / MO</span>
                      {tier.interval === 'yr' && <span className="text-[8px] block opacity-40 italic">(accrued monthly)</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {isBuying === tier.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Initializing
                        </>
                      ) : (
                        <>
                          Authorize
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className={`p-4 border-l-2 font-mono text-[10px] leading-relaxed opacity-60
                ${theme === 'dark' ? 'border-white/20' : 'border-black/20'}`}>
                Note: Generation cycles consume 5-20 credits depending on target length. Transactions handled via Stripe secure relay. 
                Credits are applied immediately upon confirmation of successful relay.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

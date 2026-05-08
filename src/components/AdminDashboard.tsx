import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Search, Shield, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  theme: 'light' | 'dark';
  onClose: () => void;
}

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  credits: number;
  createdAt?: any;
}

export function AdminDashboard({ theme, onClose }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      // Sort by creation date if possible
      fetchedUsers.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user: UserData) => {
    setEditingUserId(user.id);
    setEditCredits(user.credits);
  };

  const handleSaveCredits = async (userId: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        credits: editCredits
      });
      setUsers(users.map(u => u.id === userId ? { ...u, credits: editCredits } : u));
      setEditingUserId(null);
    } catch (error) {
      console.error("Error updating credits:", error);
      alert("Failed to update user credits.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email} (ID: ${userId})? This only deletes their Firestore profile record.`)) return;
    
    try {
      import('firebase/firestore').then(async ({ deleteDoc, doc }) => {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(u => u.id !== userId));
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.includes(searchTerm)
  );

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`fixed inset-4 md:inset-20 z-[201] flex flex-col border-2 overflow-hidden ${
          theme === 'dark' 
            ? 'bg-[#111111] border-[#333] text-[#F8F8F7]' 
            : 'bg-white border-[#141414] text-[#141414]'
        }`}
      >
        <div className={`p-6 border-b flex items-center justify-between shrink-0 ${theme === 'dark' ? 'border-[#333]' : 'border-[#141414]'}`}>
          <div className="flex items-center gap-3">
            <Shield className={`w-6 h-6 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <h2 className="font-serif italic text-2xl uppercase tracking-tighter">Admin Dashboard</h2>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 border ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-6 border-b flex items-center gap-4 shrink-0 bg-opacity-50 ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-[#F8F8F7] border-[#141414]'}`}>
          <div className={`flex flex-1 items-center gap-3 p-3 border ${theme === 'dark' ? 'border-[#333] bg-[#111111]' : 'border-[#141414] bg-white'}`}>
            <Search className="w-5 h-5 opacity-50" />
            <input 
              type="text" 
              placeholder="Search users by email, name, or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 font-mono text-sm"
            />
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest opacity-60">
            Total Users: {users.length}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin" />
              <div className="font-mono text-xs uppercase tracking-widest">Loading Users...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredUsers.map(user => (
                <div key={user.id} className={`p-4 border flex flex-col gap-4 ${theme === 'dark' ? 'border-[#333] bg-[#1A1A1A]' : 'border-[#141414] bg-[#F8F8F7]'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold truncate text-sm">{user.email || 'No email'}</span>
                      <span className="text-[10px] font-mono opacity-50 truncate mt-1">ID: {user.id}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.email || 'Unknown')}
                      className={`p-1.5 border transition-colors ${
                        theme === 'dark' 
                          ? 'border-red-500/30 text-red-400 hover:bg-red-500/20' 
                          : 'border-red-500/30 text-red-600 hover:bg-red-50'
                      }`}
                      title="Delete User Record"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className={`p-3 border flex flex-col gap-2 ${theme === 'dark' ? 'border-[#444] bg-[#111111]' : 'border-black/10 bg-white'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Credits</span>
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={editCredits}
                            onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 border text-xs font-mono font-bold ${
                              theme === 'dark' ? 'bg-[#222] border-[#555]' : 'bg-gray-100 border-gray-300'
                            }`}
                          />
                          <button 
                            onClick={() => handleSaveCredits(user.id)}
                            disabled={isSaving}
                            className={`p-1 border ${theme === 'dark' ? 'border-[#555] bg-green-500/20 text-green-400 hover:bg-green-500/40' : 'border-green-600 bg-green-100 text-green-700 hover:bg-green-200'}`}
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => setEditingUserId(null)}
                            disabled={isSaving}
                            className={`p-1 border ${theme === 'dark' ? 'border-[#555] hover:bg-[#333]' : 'border-gray-300 hover:bg-gray-200'}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold">{user.credits}</span>
                          <button 
                            onClick={() => handleEditClick(user)}
                            className="text-[10px] font-mono uppercase tracking-widest text-indigo-500 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="col-span-full py-12 text-center opacity-50 font-mono text-xs uppercase tracking-widest">
                  No users found
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

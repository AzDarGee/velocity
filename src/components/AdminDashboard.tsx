import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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
  const [userToDelete, setUserToDelete] = useState<{id: string, email: string} | null>(null);
  const [adminUids, setAdminUids] = useState<Set<string>>(new Set());

  const currentHardcodedAdmins = ['ashdarji1@gmail.com', 'ashishdarji88@gmail.com', 'saanskarastudios@gmail.com'];

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

      const adminQ = query(collection(db, 'admins'));
      const adminSnapshot = await getDocs(adminQ);
      const adminIds = new Set(adminSnapshot.docs.map(d => d.id));
      setAdminUids(adminIds);
      // Sort by creation date if possible
      fetchedUsers.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        handleFirestoreError(error, OperationType.LIST, 'users');
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
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      import('firebase/firestore').then(async ({ deleteDoc, doc }) => {
        await deleteDoc(doc(db, 'users', userToDelete.id));
        setUsers(users.filter(u => u.id !== userToDelete.id));
        setUserToDelete(null);
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
      handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.id}`);
    }
  };

  const handleToggleAdmin = async (userId: string, email: string) => {
    if (currentHardcodedAdmins.includes(email)) {
      alert("This user is a root admin and cannot be changed.");
      return;
    }
    const isCurrentlyAdmin = adminUids.has(userId);
    try {
      if (isCurrentlyAdmin) {
        await deleteDoc(doc(db, 'admins', userId));
        setAdminUids(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await setDoc(doc(db, 'admins', userId), { createdAt: new Date() });
        setAdminUids(prev => {
          const next = new Set(prev);
          next.add(userId);
          return next;
        });
      }
    } catch (error) {
      console.error("Error toggling admin status:", error);
      alert("Failed to toggle admin status.");
      handleFirestoreError(error, isCurrentlyAdmin ? OperationType.DELETE : OperationType.WRITE, `admins/${userId}`);
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
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate text-sm">{user.email || 'No email'}</span>
                        {(adminUids.has(user.id) || currentHardcodedAdmins.includes(user.email || '')) && (
                          <span className={`text-[9px] px-1.5 py-0.5 uppercase tracking-widest font-mono font-bold border ${theme === 'dark' ? 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10' : 'border-indigo-600/30 text-indigo-600 bg-indigo-50'}`}>Admin</span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono opacity-50 truncate mt-1">ID: {user.id}</span>
                    </div>
                    {!(adminUids.has(user.id) || currentHardcodedAdmins.includes(user.email || '')) && (
                      <button 
                        onClick={() => setUserToDelete({ id: user.id, email: user.email || 'Unknown' })}
                        className={`p-1.5 border transition-colors ${
                          theme === 'dark' 
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/20' 
                            : 'border-red-500/30 text-red-600 hover:bg-red-50'
                        }`}
                        title="Delete User Record"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  <div className={`p-3 border flex flex-col gap-2 ${theme === 'dark' ? 'border-[#444] bg-[#111111]' : 'border-black/10 bg-white'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Role</span>
                      {currentHardcodedAdmins.includes(user.email || '') ? (
                        <span className="text-[10px] font-mono opacity-60">Core Admin</span>
                      ) : (
                        <button 
                          onClick={() => handleToggleAdmin(user.id, user.email || '')}
                          className={`text-[10px] font-mono uppercase tracking-widest border px-2 py-1 transition-colors ${
                             adminUids.has(user.id) 
                               ? (theme === 'dark' ? 'border-amber-500/50 text-amber-500 hover:bg-amber-500/20' : 'border-amber-600/50 text-amber-600 hover:bg-amber-50')
                               : (theme === 'dark' ? 'border-[#555] hover:bg-[#333]' : 'border-gray-300 hover:bg-gray-100')
                          }`}
                        >
                          {adminUids.has(user.id) ? 'Demote to User' : 'Make Admin'}
                        </button>
                      )}
                    </div>
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

      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setUserToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-md p-6 border-2 flex flex-col items-center gap-6 text-center shadow-2xl ${
                theme === 'dark' 
                  ? 'border-red-500/50 bg-[#1A1A1A] text-[#F8F8F7]' 
                  : 'border-red-600 bg-white text-[#141414]'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-500/20 text-red-500' : 'bg-red-100 text-red-600'}`}>
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif italic text-2xl">Delete User</h3>
                <p className="text-sm opacity-80">
                  Are you sure you want to delete user <span className="font-bold">{userToDelete.email}</span> (ID: {userToDelete.id})? This will permanently remove their profile record from Firestore.
                </p>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setUserToDelete(null)}
                  className={`flex-1 py-3 border font-bold uppercase tracking-widest text-[10px] transition-all ${
                    theme === 'dark'
                      ? 'border-[#333] hover:bg-[#333]'
                      : 'border-black hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 border border-red-500 bg-red-500 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

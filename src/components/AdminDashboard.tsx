import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, setDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { X, Search, Shield, Save, Loader2, Trash2, Eye, FileAudio, FileImage, FileVideo, Download, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  theme: 'light' | 'dark';
  isAdmin: boolean;
  onClose: () => void;
}

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  credits: number;
  createdAt?: any;
  assetsCount?: number;
}

export function AdminDashboard({ theme, isAdmin, onClose }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, email: string} | null>(null);
  const [userToPurge, setUserToPurge] = useState<{id: string, email: string} | null>(null);
  const [userToPurgeAssets, setUserToPurgeAssets] = useState<{id: string, email: string} | null>(null);
  const [viewingUserAssets, setViewingUserAssets] = useState<{id: string, email: string} | null>(null);
  const [userAssets, setUserAssets] = useState<any[]>([]);
  const [isFetchingAssets, setIsFetchingAssets] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<any | null>(null);
  const [showGlobalPurge, setShowGlobalPurge] = useState(false);
  const [adminUids, setAdminUids] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'users' | 'cleanup'>('users');
  const [authUsers, setAuthUsers] = useState<any[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);

  const currentHardcodedAdmins = ['ashdarji1@gmail.com', 'ashishdarji88@gmail.com', 'saanskarastudios@gmail.com'];

  useEffect(() => {
    fetchUsers();
    fetchAuthUsers();
  }, []);                


  useEffect(() => {
    if (viewingUserAssets) {
      fetchAssets(viewingUserAssets.id);
    } else {
      setUserAssets([]);
    }
  }, [viewingUserAssets]);

  const isUserAdmin = (userId: string) => {
    const authUser = authUsers.find(u => u.uid === userId);
    const userEmail = authUser ? authUser.email : null;
    return adminUids.has(userId) || (userEmail && currentHardcodedAdmins.includes(userEmail));
  };

  const isCoreAdmin = currentHardcodedAdmins.includes(auth.currentUser?.email || '');

  const canViewOrDelete = (assetUserId: string) => {
    if (auth.currentUser?.uid === assetUserId) return true;
    if (isCoreAdmin) return true;
    if (isUserAdmin(assetUserId)) return false;
    return true;
  };

  const fetchAssets = async (userId: string) => {
    setIsFetchingAssets(true);
    try {
      const q = query(collection(db, 'files'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      setUserAssets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      alert("Failed to fetch assets.");
    } finally {
      setIsFetchingAssets(false);
    }
  };

  const handleDownloadAsset = (asset: any) => {
    const url = asset.storageUrl || asset.previewUrl;
    if (!url) return;
    
    // Create a temporary link element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = asset.name || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;

    // Check if the asset belongs to an admin
    if (!canViewOrDelete(assetToDelete.userId)) {
        alert("Cannot delete assets belonging to an administrator.");
        return;
    }

    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'files', assetToDelete.id));
      if (assetToDelete.storageUrl) {
        const fileRef = ref(storage, assetToDelete.storageUrl);
        await deleteObject(fileRef).catch(console.error);
      }
      setUserAssets(prev => prev.filter(a => a.id !== assetToDelete.id));
      setAssetToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `files/${assetToDelete.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchAuthUsers = async () => {
    import('../lib/firebase').then(async ({ auth }) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const response = await fetch(`/api/admin/auth-users?adminId=${currentUser.uid}`);
        
        if (!response.ok) {
          console.error("Failed to fetch auth users, response not ok:", response.status);
          setAuthUsers([]);
          return;
        }
        
        const data = await response.json();
        if (data.users) {
          // Explicit deduplication by UID
          const uniqueAuth = Array.from(new Map(data.users.map((u: any) => [u.uid, u])).values());
          setAuthUsers(uniqueAuth);
        } else {
          setAuthUsers([]);
        }
      } catch (err) {
        console.error("Failed to fetch auth users, error:", err);
        setAuthUsers([]);
        // The project lacks IAM permissions to list auth users.
      }
    });
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];

      const [adminSnapshot, filesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'admins'))),
        getDocs(collection(db, 'files'))
      ]);

      const assetCounts: Record<string, number> = {};
      filesSnapshot.docs.forEach(d => {
        const uid = d.data().userId;
        if (uid) assetCounts[uid] = (assetCounts[uid] || 0) + 1;
      });

      const adminIds = new Set(adminSnapshot.docs.map(d => d.id));
      setAdminUids(adminIds);
      
      // Deduplicate by ID
      const uniqueUsers = Array.from(new Map(fetchedUsers.map(u => [u.id, u])).values());
      
      // Sort by creation date if possible
      uniqueUsers.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      
      const usersWithAssets = uniqueUsers.map(u => ({
        ...u,
        assetsCount: assetCounts[u.id] || 0
      }));
      setUsers(usersWithAssets);
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
    setIsSaving(true);
    
    try {
      const adminId = auth.currentUser?.uid;
      if (!adminId) throw new Error("Admin ID not found");

      const response = await fetch('/api/users/remove-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userToDelete.id, adminId })
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Failed to delete user: HTTP ${response.status}`);
        }

        if (data.success) {
          setUsers(users.filter(u => u.id !== userToDelete.id));
          setAuthUsers(authUsers.filter(u => u.uid !== userToDelete.id));
          setUserToDelete(null);
        } else {
          throw new Error(data.error || "Failed to thoroughly delete user.");
        }
      } else {
        const text = await response.text();
        console.error("Server HTML response:", text);
        throw new Error(`Server Error: ${response.status} ${response.statusText}. Check console for details.`);
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(error.message || "Failed to delete user.");
    } finally {
      setIsSaving(false);
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

  const handleConfirmPurgeGenerations = async () => {
    if (!userToPurge) return;
    setIsSaving(true);
    try {
      const q = query(collection(db, 'generations'), where('userId', '==', userToPurge.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("No generations found for this user.");
        setUserToPurge(null);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert(`Successfully purged ${snapshot.size} generations for ${userToPurge.email}`);
      setUserToPurge(null);
    } catch (error) {
      console.error("Error purging generations:", error);
      alert("Failed to purge generations.");
      handleFirestoreError(error, OperationType.DELETE, `generations_purge/${userToPurge.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPurgeAssets = async () => {
    if (!userToPurgeAssets) return;
    setIsSaving(true);
    try {
      const q = query(collection(db, 'files'), where('userId', '==', userToPurgeAssets.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("No assets found for this user.");
        setUserToPurgeAssets(null);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      setUsers(users.map(u => u.id === userToPurgeAssets.id ? { ...u, assetsCount: 0 } : u));
      alert(`Successfully purged ${snapshot.size} assets for ${userToPurgeAssets.email}`);
      setUserToPurgeAssets(null);
    } catch (error) {
      console.error("Error purging assets:", error);
      alert("Failed to purge assets.");
      handleFirestoreError(error, OperationType.DELETE, `assets_purge/${userToPurgeAssets.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMakeAllUsersAdmin = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      users.forEach(user => {
        // Skip root admins
        if (currentHardcodedAdmins.includes(user.email || '')) return;
        
        const adminRef = doc(db, 'admins', user.id);
        batch.set(adminRef, { createdAt: new Date() });
      });
      await batch.commit();
      
      // Update local state
      const newAdminIds = new Set(adminUids);
      users.forEach(u => newAdminIds.add(u.id));
      setAdminUids(newAdminIds);
      
      alert("Successfully made all users admins.");
    } catch (error) {
      console.error("Error making all users admins:", error);
      alert("Failed to make all users admins.");
      handleFirestoreError(error, OperationType.WRITE, 'admins/bulk');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGlobalPurge = async () => {
    setIsSaving(true);
    try {
      const q = query(collection(db, 'generations'));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("System already clean. No generations found.");
        setShowGlobalPurge(false);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert(`System-wide purge complete. Destroyed ${snapshot.size} records.`);
      setShowGlobalPurge(false);
    } catch (error) {
      console.error("Global purge failed:", error);
      alert("Failed to execute global purge.");
    } finally {
      setIsSaving(false);
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

        <div className={`px-6 border-b flex items-center gap-6 shrink-0 ${theme === 'dark' ? 'border-[#333]' : 'border-[#141414]'}`}>
          <button 
            onClick={() => setActiveTab('users')}
            className={`py-4 text-[10px] uppercase font-mono font-bold tracking-[0.2em] relative ${
              activeTab === 'users' ? (theme === 'dark' ? 'text-white' : 'text-black') : 'opacity-40 hover:opacity-100'
            }`}
          >
            User_Registry
            {activeTab === 'users' && <motion.div layoutId="tab" className={`absolute bottom-0 left-0 right-0 h-0.5 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />}
          </button>
          <button 
            onClick={() => setActiveTab('cleanup')}
            className={`py-4 text-[10px] uppercase font-mono font-bold tracking-[0.2em] relative ${
              activeTab === 'cleanup' ? (theme === 'dark' ? 'text-white' : 'text-black') : 'opacity-40 hover:opacity-100'
            }`}
          >
            System_Cleanup
            {activeTab === 'cleanup' && <motion.div layoutId="tab" className={`absolute bottom-0 left-0 right-0 h-0.5 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />}
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
              <div className="font-mono text-xs uppercase tracking-widest">Accessing_Data_Vault...</div>
            </div>
          ) : activeTab === 'users' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredUsers.map((user, index) => (
                <div key={`admin-user-card-${user.id || index}-${index}`} className={`p-4 border flex flex-col gap-4 ${theme === 'dark' ? 'border-[#333] bg-[#1A1A1A]' : 'border-[#141414] bg-[#F8F8F7]'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate text-sm">{user.email || 'No email'}</span>
                        {(adminUids.has(user.id) || currentHardcodedAdmins.includes(user.email || '')) && (
                          <span className={`text-[9px] px-1.5 py-0.5 uppercase tracking-widest font-mono font-bold border ${theme === 'dark' ? 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10' : 'border-indigo-600/30 text-indigo-600 bg-indigo-50'}`}>Admin</span>
                        )}
                      </div>
                      {isAdmin && <span className="text-[10px] font-mono opacity-50 truncate mt-1">ID: {user.id}</span>}
                    </div>
                    {!(adminUids.has(user.id) || currentHardcodedAdmins.includes(user.email || '')) && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setUserToPurge({ id: user.id, email: user.email || 'Unknown' })}
                          className={`p-1.5 border transition-colors ${
                            theme === 'dark' 
                              ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                              : 'border-amber-500/30 text-amber-600 hover:bg-amber-50'
                          }`}
                          title="Purge User Generations"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setUserToDelete({ id: user.id, email: user.email || 'Unknown' })}
                          className={`p-1.5 border transition-colors ${
                            theme === 'dark' 
                              ? 'border-red-500/30 text-red-400 hover:bg-red-500/20' 
                              : 'border-red-500/30 text-red-600 hover:bg-red-50'
                          }`}
                          title="Thoroughly Purge User Account"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

                  <div className={`p-3 border flex flex-col gap-2 ${theme === 'dark' ? 'border-[#444] bg-[#111111]' : 'border-black/10 bg-white'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Assets</span>
                                              <div className="flex items-center gap-2">
                          {canViewOrDelete(user.id) && (
                            <button
                              onClick={() => setViewingUserAssets({ id: user.id, email: user.email || 'Unknown' })}
                              className={`p-1 border transition-colors ${
                                theme === 'dark'
                                  ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                                  : 'border-indigo-600/30 text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="View Assets"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="font-bold text-xs font-mono">{user.assetsCount || 0}</span>
                          {(user.assetsCount && user.assetsCount > 0) ? (
                            <button
                              onClick={() => setUserToPurgeAssets({ id: user.id, email: user.email || 'Unknown' })}
                              className={`p-1 border transition-colors ${
                                theme === 'dark'
                                  ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                                  : 'border-amber-500/30 text-amber-600 hover:bg-amber-50'
                              }`}
                              title="Purge Assets"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </div>
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
          ) : (
            <div className="space-y-6">
              <div className={`p-6 border-2 border-dashed ${theme === 'dark' ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-600/30 bg-indigo-50/50'}`}>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Authentication_Integrity_Audit
                </h3>
                <p className="text-[10px] font-mono opacity-70 mb-4 max-w-2xl">
                  This utility scans the Identity_Vault (Auth) and identifies accounts that lack a verified Protocol_Signature (Firestore Record) or are considered orphaned test identities.
                </p>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 border bg-black text-white font-mono text-[10px] uppercase tracking-widest font-bold">
                    Total Auth Users: {authUsers.length}
                  </div>
                  <div className="px-4 py-2 border bg-indigo-600 text-white font-mono text-[10px] uppercase tracking-widest font-bold">
                    Orphaned Accounts: {authUsers.filter(au => !users.some(u => u.id === au.uid)).length}
                  </div>
                </div>

                <div className="mt-8 p-6 border border-red-500/20 bg-red-500/5">
                   <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-500 mb-2">Danger_Zone</h3>
                   <p className="text-[10px] font-mono opacity-60 mb-4 tracking-tighter uppercase">Mass_Destruction_Protocol: This will irreversibly scrub EVERY generation record from the entire system database.</p>
                   <button 
                     onClick={() => setShowGlobalPurge(true)}
                     className={`px-6 py-3 border-2 font-mono text-[10px] uppercase font-black tracking-widest transition-all ${
                       theme === 'dark' ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-black' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
                     }`}
                   >
                     Initialize_Global_Purge
                   </button>
                </div>
                <div className="mt-8 p-6 border border-amber-500/20 bg-amber-500/5">
                   <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500 mb-2">Omnipotent_Protocol</h3>
                   <p className="text-[10px] font-mono opacity-60 mb-4 tracking-tighter uppercase">Mass_Upgrade_Protocol: This will grant ADMIN privileges to ALL registered users.</p>
                   <button 
                     onClick={handleMakeAllUsersAdmin}
                     className={`px-6 py-3 border-2 font-mono text-[10px] uppercase font-black tracking-widest transition-all ${
                       theme === 'dark' ? 'border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black' : 'border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white'
                     }`}
                   >
                     {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : "Upgrade_All_To_Admin"}
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 {authUsers.map((au, index) => {
                   const inFirestore = users.some(u => u.id === au.uid);
                   const isHardcoded = currentHardcodedAdmins.includes(au.email);
                   const isDbAdmin = adminUids.has(au.uid);
                   if (isHardcoded || isDbAdmin) return null;

                   return (
                     <div key={`auth-node-${au.uid || index}-${index}`} className={`p-4 border flex items-center justify-between ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-white border-black/10'}`}>
                        <div className="flex flex-col">
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-xs">{au.email}</span>
                              {!inFirestore && (
                                <span className="text-[8px] px-1 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase">Orphan</span>
                              )}
                              {au.emailVerified ? (
                                <span className="text-[8px] px-1 bg-green-500/10 text-green-500 border border-green-500/20 font-black uppercase">Verified</span>
                              ) : (
                                <span className="text-[8px] px-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-black uppercase">Unverified</span>
                              )}
                           </div>
                           {isAdmin && <span className="text-[9px] font-mono opacity-40 mt-1 uppercase">UID: {au.uid} // Created: {new Date(au.creationTime || 0).toLocaleDateString()}</span>}
                        </div>
                        <button 
                          onClick={() => setUserToDelete({ id: au.uid, email: au.email })}
                          className={`px-4 py-2 border-2 font-mono text-[10px] font-black uppercase tracking-widest transition-all ${
                            theme === 'dark' ? 'border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
                          }`}
                        >
                          Execute_Purge
                        </button>
                     </div>
                   );
                 })}
              </div>
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
                <h3 className="font-serif italic text-2xl">Execute User Purge</h3>
                <p className="text-sm opacity-80">
                  Are you sure you want to thoroughly delete user <span className="font-bold underline decoration-dotted">{userToDelete.email}</span> {isAdmin && <>(UID: <span className="font-mono text-[10px]">{userToDelete.id}</span>)</>}?
                </p>
                <div className={`p-4 border text-[10px] font-mono text-left space-y-1 ${theme === 'dark' ? 'bg-red-900/10 border-red-500/20 text-red-200' : 'bg-red-50 border-red-500/20 text-red-900'}`}>
                  <p className="font-bold opacity-100 mb-2">CLEANUP_PROTOCOL_NOTICE:</p>
                  <p>— IRREVERSIBLE: Profile data and asset associations will be destroyed.</p>
                  <p>— AUTHETNICATION: Access credentials will be terminated in Firebase Identity.</p>
                  <p>— INTEGRITY: All generations and linked metadata will be scrubbed.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setUserToDelete(null)}
                  disabled={isSaving}
                  className={`flex-1 py-3 border font-bold uppercase tracking-widest text-[10px] transition-all ${
                    theme === 'dark'
                      ? 'border-[#333] hover:bg-[#333]'
                      : 'border-black hover:bg-gray-100'
                  }`}
                >
                  Abort
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isSaving}
                  className="flex-1 py-3 border border-red-500 bg-red-500 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm_Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {userToPurge && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setUserToPurge(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-md p-6 border-2 flex flex-col items-center gap-6 text-center shadow-2xl ${
                theme === 'dark' 
                  ? 'border-amber-500/50 bg-[#1A1A1A] text-[#F8F8F7]' 
                  : 'border-amber-600 bg-white text-[#141414]'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-amber-500/20 text-amber-500' : 'bg-amber-100 text-amber-600'}`}>
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif italic text-2xl">Purge Generations</h3>
                <p className="text-sm opacity-80">
                  Are you sure you want to delete ALL blog generations for <span className="font-bold underline decoration-dotted">{userToPurge.email}</span>?
                </p>
                <div className={`p-4 border text-[10px] font-mono text-left space-y-1 ${theme === 'dark' ? 'bg-amber-900/10 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-500/20 text-amber-900'}`}>
                  <p className="font-bold opacity-100 mb-2">PURGE_PROTOCOL_NOTICE:</p>
                  <p>— IRREVERSIBLE: All generated text content will be permanently removed.</p>
                  <p>— DATA_LOSS: Media references within the posts will be orphaned.</p>
                  <p>— ACCOUNT_PRESERVATION: User profile and uploaded files will NOT be affected.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setUserToPurge(null)}
                  disabled={isSaving}
                  className={`flex-1 py-3 border font-bold uppercase tracking-widest text-[10px] transition-all ${
                    theme === 'dark'
                      ? 'border-[#333] hover:bg-[#333]'
                      : 'border-black hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPurgeGenerations}
                  disabled={isSaving}
                  className="flex-1 py-3 border border-amber-500 bg-amber-500 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm_Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {userToPurgeAssets && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setUserToPurgeAssets(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-md p-6 border-2 flex flex-col items-center gap-6 text-center shadow-2xl ${
                theme === 'dark' 
                  ? 'border-amber-500/50 bg-[#1A1A1A] text-[#F8F8F7]' 
                  : 'border-amber-600 bg-white text-[#141414]'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-amber-500/20 text-amber-500' : 'bg-amber-100 text-amber-600'}`}>
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif italic text-2xl">Purge Assets</h3>
                <p className="text-sm opacity-80">
                  Are you sure you want to delete ALL uploaded assets for <span className="font-bold underline decoration-dotted">{userToPurgeAssets.email}</span>?
                </p>
                <div className={`p-4 border text-[10px] font-mono text-left space-y-1 ${theme === 'dark' ? 'bg-amber-900/10 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-500/20 text-amber-900'}`}>
                  <p className="font-bold opacity-100 mb-2">PURGE_PROTOCOL_NOTICE:</p>
                  <p>— IRREVERSIBLE: All uploaded media files will be permanently removed.</p>
                  <p>— DATA_LOSS: Reference to these assets in existing generations will be broken.</p>
                  <p>— ACCOUNT_PRESERVATION: User profile and generation text will NOT be affected.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setUserToPurgeAssets(null)}
                  disabled={isSaving}
                  className={`flex-1 py-3 border font-bold uppercase tracking-widest text-[10px] transition-all ${
                    theme === 'dark'
                      ? 'border-[#333] hover:bg-[#333]'
                      : 'border-black hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPurgeAssets}
                  disabled={isSaving}
                  className="flex-1 py-3 border border-amber-500 bg-amber-500 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm_Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingUserAssets && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingUserAssets(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-2xl max-h-[80vh] p-6 border-2 flex flex-col gap-6 shadow-2xl ${
                theme === 'dark' 
                  ? 'border-indigo-500/50 bg-[#1A1A1A] text-[#F8F8F7]' 
                  : 'border-indigo-600 bg-white text-[#141414]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif italic text-2xl">Assets: {viewingUserAssets.email}</h3>
                <button onClick={() => setViewingUserAssets(null)}><X className="w-5 h-5"/></button>
              </div>
              
              {isFetchingAssets ? (
                 <div className="flex-1 flex items-center justify-center opacity-50"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
                  {userAssets.map((asset, index) => (
                    <div key={`asset-card-${asset.id || index}-${index}`} className={`p-2 border flex flex-col justify-between ${theme === 'dark' ? 'border-[#333] bg-[#111]' : 'border-black/10 bg-gray-50'}`}>
                      <div>
                        <div className="h-24 bg-black/5 flex items-center justify-center mb-2 overflow-hidden">
                          {(asset.mimeType?.startsWith('image')) ? (
                            <img src={asset.storageUrl || asset.previewUrl} className="h-full w-full object-cover" alt={asset.name} />
                          ) : (asset.mimeType?.startsWith('video')) ? (
                            <FileVideo className="w-8 h-8 opacity-50" />
                          ) : (
                            <FileAudio className="w-8 h-8 opacity-50" />
                          )}
                        </div>
                        <p className="text-[10px] font-mono truncate">{asset.name || 'Unnamed Asset'}</p>
                        <p className="text-[9px] font-mono opacity-50">{asset.mimeType || 'unknown'}</p>
                      </div>
                      <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-black/5">
                        <button onClick={() => handleDownloadAsset(asset)} className="p-1 opacity-60 hover:opacity-100">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDownloadAsset(asset)} className="p-1 opacity-60 hover:opacity-100">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canViewOrDelete(asset.userId) && (
                          <button onClick={() => setAssetToDelete(asset)} className="p-1 text-red-500 hover:text-red-700">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {userAssets.length === 0 && (
                    <div className="col-span-full py-12 text-center opacity-50 font-mono text-xs">No assets found for this user.</div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
        {assetToDelete && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setAssetToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-sm p-6 border-2 flex flex-col items-center gap-6 text-center shadow-2xl ${
                theme === 'dark' 
                  ? 'border-red-500/50 bg-[#1A1A1A] text-[#F8F8F7]' 
                  : 'border-red-600 bg-white text-[#141414]'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-500/20 text-red-500' : 'bg-red-100 text-red-600'}`}>
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif italic text-xl">Delete Asset</h3>
                <p className="text-sm opacity-80">
                  Are you sure you want to permanently delete <span className="font-bold underline decoration-dotted">{assetToDelete.name || 'this asset'}</span>?
                </p>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setAssetToDelete(null)}
                  disabled={isSaving}
                  className={`flex-1 py-3 border font-bold uppercase tracking-widest text-[10px] transition-all ${
                    theme === 'dark'
                      ? 'border-[#333] hover:bg-[#333]'
                      : 'border-black hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAsset}
                  disabled={isSaving}
                  className="flex-1 py-3 border border-red-500 bg-red-500 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm_Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGlobalPurge && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowGlobalPurge(false)}
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
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif italic text-2xl text-red-500">Global System Purge</h3>
                <p className="text-sm opacity-80 uppercase font-mono font-bold tracking-tighter">
                  CRITICAL: All user generations will be DESTROYED.
                </p>
                <div className={`p-4 border text-[10px] font-mono text-left space-y-1 ${theme === 'dark' ? 'bg-red-900/10 border-red-500/20 text-red-200' : 'bg-red-50 border-red-500/20 text-red-900'}`}>
                  <p className="font-bold opacity-100 mb-2">SYSTEM_WIPE_NOTICE:</p>
                  <p>— TOTAL_DESTRUCTION: 100% of generation history will be lost.</p>
                  <p>— ORPHANED_MEDIA: Assets remain but references disappear.</p>
                  <p>— NO_UNDO: This action cannot be reverted.</p>
                </div>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setShowGlobalPurge(false)}
                  disabled={isSaving}
                  className={`flex-1 py-3 border font-bold uppercase tracking-widest text-[10px] transition-all ${
                    theme === 'dark'
                      ? 'border-[#333] hover:bg-[#333]'
                      : 'border-black hover:bg-gray-100'
                  }`}
                >
                  Abort_Wipe
                </button>
                <button
                  onClick={handleGlobalPurge}
                  disabled={isSaving}
                  className="flex-1 py-3 border border-red-500 bg-red-500 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm_Global_Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

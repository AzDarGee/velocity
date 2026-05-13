import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { AssetItem } from './AssetItem';
import { toast } from 'sonner';

interface Asset {
  id: string;
  ownerId: string;
  ownerRole: string;
  name: string;
  createdAt: any;
}

interface AssetListProps {
  isAdmin: boolean;
  currentUserUid: string;
}

export function AssetList({ isAdmin, currentUserUid }: AssetListProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Strategy for fetching Admin Assets efficiently:
  // Since Firestore 'allow list' rules evaluate the query conditions, we cannot perform relational
  // checks like `!exists(admins/uid)` inside a where() clause. 
  // By denormalizing `ownerRole` onto the asset at creation time, admins can purely query:
  // `where("ownerRole", "==", "user")` without causing massive read spikes or O(n) lookups.
  // The backend Firestore Rules also strictly enforce that `ownerRole` is truthful at creation.
  
  useEffect(() => {
    if (!currentUserUid) return;

    let assetQuery = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));

    if (isAdmin) {
      // Admins should only fetch assets belonging to 'users'
      assetQuery = query(
        collection(db, 'assets'),
        where('ownerRole', '==', 'user'),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Regular users only fetch their own assets
      assetQuery = query(
        collection(db, 'assets'),
        where('ownerId', '==', currentUserUid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      assetQuery,
      (snapshot) => {
        const fetchedAssets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Asset[];
        setAssets(fetchedAssets);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching assets:", error);
        toast.error("Failed to load assets. " + error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, currentUserUid]);

  const handleDeleteAsset = async (assetId: string) => {
    try {
      // Backend handles security. If an admin bypasses the UI and tries to delete an admin asset,
      // the rule: !exists(/databases/$(database)/documents/admins/$(resource.data.ownerId))
      // will throw PERMISSION_DENIED.
      await deleteDoc(doc(db, 'assets', assetId));
      toast.success("Asset deleted successfully.");
    } catch (error: any) {
      console.error("Delete failed:", error);
      if (error.code === 'permission-denied') {
        toast.error("Access Denied: You do not have permission to delete this asset. Admins cannot delete other admins' assets.");
      } else {
        toast.error(error.message || "Failed to delete asset.");
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Loading assets...</div>;
  }

  if (assets.length === 0) {
    return <div className="p-8 text-center text-gray-500">No assets found.</div>;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">User Assets Management</h2>
      
      <div className="grid gap-4">
        {assets.map((asset) => (
          <AssetItem 
            key={asset.id} 
            asset={asset} 
            isAdmin={isAdmin}
            currentUserUid={currentUserUid}
            onDelete={() => handleDeleteAsset(asset.id)} 
          />
        ))}
      </div>
    </div>
  );
}

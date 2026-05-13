import { Trash2, Eye } from 'lucide-react';
import { motion } from 'motion/react';

interface Asset {
  id: string;
  ownerId: string;
  ownerRole: string;
  name: string;
  createdAt: any;
}

interface AssetItemProps {
  asset: Asset;
  isAdmin: boolean;
  currentUserUid: string;
  onDelete: () => void;
}

export function AssetItem({ asset, isAdmin, currentUserUid, onDelete }: AssetItemProps) {
  // Logic: Show action buttons if:
  // 1. The current user is the owner.
  // 2. The current user is an admin AND the asset's ownerRole is 'user'. 
  // We do not show buttons for other admins' assets (in case they somehow made it to the UI).
  const isOwner = currentUserUid === asset.ownerId;
  const canManage = isOwner || (isAdmin && asset.ownerRole === 'user' && !isOwner);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm bg-white dark:bg-[#0A0A0A]"
    >
      <div className="flex flex-col min-w-0">
        <h4 className="font-semibold text-base truncate">{asset.name}</h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-mono">
          <span>Asset ID: {asset.id}</span>
          <span>•</span>
          <span className="uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
            {asset.ownerRole}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4 shrink-0">
        {canManage && (
          <>
            <button 
              onClick={() => alert(`Viewing asset: ${asset.name}`)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
              title="View Asset"
            >
              <Eye className="w-5 h-5" />
            </button>
            <button 
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete Asset"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

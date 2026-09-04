import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Package } from 'lucide-react';

interface ActiveInv {
  id: string;
  shelf_code: string;
}

const InventoryHeaderBanner = () => {
  const [active, setActive] = useState<ActiveInv[]>([]);

  useEffect(() => {
    const inventoriesQuery = query(
      collection(db, 'inventories'),
      where('status', '==', 'in_progress')
    );

    const unsubscribe = onSnapshot(
      inventoriesQuery,
      (snapshot) => {
        const inventories: ActiveInv[] = snapshot.docs.map((inventoryDoc) => {
          const data = inventoryDoc.data();

          return {
            id: inventoryDoc.id,
            shelf_code: data.shelf_code || '',
          };
        });

        setActive(inventories);
      },
      (error) => {
        console.error('Erro ao acompanhar inventários em andamento:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  if (active.length === 0) return null;

  return (
    <div className="flex-1 flex justify-center items-center px-2 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse max-w-full">
        <Package className="h-4 w-4 md:h-5 md:w-5 shrink-0" />

        <span className="font-bold text-sm md:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
          Prateleira em Processo de Inventário: {active.map((item) => item.shelf_code).join(', ')}
        </span>
      </div>
    </div>
  );
};

export default InventoryHeaderBanner;

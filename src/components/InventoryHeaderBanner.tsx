import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package } from 'lucide-react';

interface ActiveInv {
  id: string;
  shelf_code: string;
}

const InventoryHeaderBanner = () => {
  const [active, setActive] = useState<ActiveInv[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('inventories')
      .select('id, shelf_code')
      .eq('status', 'in_progress');
    setActive((data as any) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('inventories-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventories' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (active.length === 0) return null;

  return (
    <div className="flex-1 flex justify-center items-center px-2 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse max-w-full">
        <Package className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
        <span className="font-bold text-sm md:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
          Prateleira em Processo de Inventário: {active.map((a) => a.shelf_code).join(', ')}
        </span>
      </div>
    </div>
  );
};

export default InventoryHeaderBanner;

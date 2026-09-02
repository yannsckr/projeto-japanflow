import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTabPermissions, TAB_LABELS, ALL_TAB_KEYS, TabKey } from '@/hooks/useTabPermissions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Search } from 'lucide-react';
import { Sector } from '@/types';

/**
 * Default visibility rules (mirror of AppSidebar logic) — used as fallback
 * when no override is configured for a given user.
 */
const getDefaultTabAccess = (
  user: { id: string; role: string; sectors?: Sector[] },
  tab: TabKey
): boolean => {
  const isAdmin = user.role === 'admin';
  const sectors = user.sectors || [];
  const isFinanceiro = sectors.includes('financeiro' as Sector);
  const isMotoboy = sectors.includes('motoboys' as Sector);
  const isPatricia = user.id === 'emp-1';

  switch (tab) {
    case 'financial':
      return isAdmin || isFinanceiro;
    case 'corridas':
      // Now also includes Financeiro by default
      return isAdmin || isMotoboy || isFinanceiro || isPatricia;
    case 'tracking':
      return true;
  }
};

const ManageTabPermissionsDialog = () => {
  const { users } = useApp();
  const { isTabEnabled, setPermission } = useTabPermissions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredUsers = users
    .filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Permissões de Abas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões de Abas por Usuário</DialogTitle>
          <DialogDescription>
            Habilite ou desabilite as abas opcionais (Financeiro, Corridas e Acompanhamento) para
            cada usuário. As abas desabilitadas serão ocultadas do menu lateral. Por padrão, valem
            as regras automáticas por setor.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Usuário</th>
                {ALL_TAB_KEYS.map((tab) => (
                  <th key={tab} className="text-center px-3 py-2 font-semibold">
                    {TAB_LABELS[tab]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      @{u.username} • {u.role === 'admin' ? 'Admin' : u.function || 'Funcionário'}
                    </p>
                  </td>
                  {ALL_TAB_KEYS.map((tab) => {
                    const fallback = getDefaultTabAccess(u, tab);
                    const enabled = isTabEnabled(u.id, tab, fallback);
                    return (
                      <td key={tab} className="px-3 py-2 text-center">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => setPermission(u.id, tab, v)}
                          disabled={u.role === 'admin'}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={ALL_TAB_KEYS.length + 1}
                    className="text-center py-6 text-muted-foreground text-xs"
                  >
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground mt-2">
          ℹ️ Administradores sempre têm acesso a todas as abas e não podem ter as permissões
          alteradas.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ManageTabPermissionsDialog;

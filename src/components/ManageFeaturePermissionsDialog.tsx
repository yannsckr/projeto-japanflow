import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  useFeaturePermissions,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  ALL_FEATURE_KEYS,
} from '@/hooks/useFeaturePermissions';
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
import { Key, Search } from 'lucide-react';

const ManageFeaturePermissionsDialog = () => {
  const { users } = useApp();
  const { hasFeature, setPermission } = useFeaturePermissions();
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
          <Key className="w-4 h-4 mr-2" />
          Permissões de Funções
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões de Funções por Usuário</DialogTitle>
          <DialogDescription>
            Libere funcionalidades específicas para usuários selecionados, além das regras padrão.
            Administradores e os responsáveis padrão (Patrícia/William) já possuem acesso
            automático.
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
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-secondary/50">
                  Usuário
                </th>
                {ALL_FEATURE_KEYS.map((f) => (
                  <th
                    key={f}
                    className="text-center px-3 py-2 font-semibold"
                    title={FEATURE_DESCRIPTIONS[f]}
                  >
                    {FEATURE_LABELS[f]}
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
                  {ALL_FEATURE_KEYS.map((f) => {
                    const enabled = u.role === 'admin' || hasFeature(u.id, f);
                    return (
                      <td key={f} className="px-3 py-2 text-center">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => setPermission(u.id, f, v)}
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
                    colSpan={ALL_FEATURE_KEYS.length + 1}
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
          ℹ️ Administradores sempre têm acesso a todas as funções. As permissões aqui adicionam
          acesso extra — não removem as regras automáticas (Patrícia para Motoboys, William para
          Rastreamentos/Garantias).
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ManageFeaturePermissionsDialog;

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  setDoc,
  doc,
  where,
  Timestamp,
} from 'firebase/firestore';

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
import { Globe, Search } from 'lucide-react';
import { EXTERNAL_ACCESS_KEY } from '@/lib/externalAccess';
import { toast } from 'sonner';

const ManageExternalAccessDialog = () => {
  const { users } = useApp();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allowed, setAllowed] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] =
    useState(false);

  const fetchAllowed = useCallback(
    async () => {
      setLoading(true);

      try {
        const permissionsQuery = query(
          collection(
            db,
            'user_feature_permissions'
          ),
          where(
            'feature_key',
            '==',
            EXTERNAL_ACCESS_KEY
          )
        );

        const snapshot =
          await getDocs(permissionsQuery);

        const map: Record<string, boolean> =
          {};

        snapshot.forEach(
          (permissionDoc) => {
            const data =
              permissionDoc.data();

            if (data.user_id) {
              map[data.user_id] =
                data.enabled === true;
            }
          }
        );

        setAllowed(map);
      } catch (error) {
        console.error(
          'Erro ao carregar permissões de acesso externo:',
          error
        );

        toast.error(
          'Erro ao carregar permissões'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;

    fetchAllowed();
  }, [open, fetchAllowed]);

  const toggle = async (
    userId: string,
    value: boolean
  ) => {
    const previousValue =
      allowed[userId] === true;

    setAllowed((prev) => ({
      ...prev,
      [userId]: value,
    }));

    try {
      const permissionId =
        `${EXTERNAL_ACCESS_KEY}__${userId}`;

      await setDoc(
        doc(
          db,
          'user_feature_permissions',
          permissionId
        ),
        {
          user_id: userId,
          feature_key:
            EXTERNAL_ACCESS_KEY,
          enabled: value,
          updated_at: Timestamp.now(),
        },
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        'Erro ao salvar acesso externo:',
        error
      );

      setAllowed((prev) => ({
        ...prev,
        [userId]: previousValue,
      }));

      toast.error('Erro ao salvar');
    }
  };

  const filteredUsers = users
    .filter(
      (u) =>
        u.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        u.username
          .toLowerCase()
          .includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === 'admin'
          ? -1
          : 1;
      }

      return a.name.localeCompare(b.name);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="w-4 h-4 mr-2" />
          Acesso Externo
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Acesso Fora da Rede da Empresa
          </DialogTitle>

          <DialogDescription>
            Por padrão, funcionários só conseguem acessar o sistema a partir da rede da empresa.
            Ative aqui para liberar o acesso de fora da rede para usuários específicos.
            Administradores sempre têm acesso irrestrito.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="pl-9"
          />
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">
                  Usuário
                </th>

                <th className="text-center px-3 py-2 font-semibold w-40">
                  Liberar fora da rede
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((u) => {
                const isAdmin =
                  u.role === 'admin';

                const enabled =
                  isAdmin ||
                  allowed[u.id] === true;

                return (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {u.name}
                      </p>

                      <p className="text-[10px] text-muted-foreground">
                        @{u.username} •{' '}
                        {isAdmin
                          ? 'Admin'
                          : u.function ||
                            'Funcionário'}
                      </p>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) =>
                          toggle(u.id, v)
                        }
                        disabled={
                          isAdmin || loading
                        }
                      />
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length ===
                0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center py-6 text-muted-foreground text-xs"
                  >
                    Nenhum usuário
                    encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground mt-2">
          ℹ️ Alterações têm efeito imediato.
          Usuários já logados fora da rede
          serão desconectados se a permissão
          for revogada.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ManageExternalAccessDialog;
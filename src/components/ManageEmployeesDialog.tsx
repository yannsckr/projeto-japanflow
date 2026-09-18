import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Pencil, Save, X, UserX, UserCheck, KeyRound, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sector, SECTOR_LABELS } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { auth } from '@/lib/firebase';

const ALL_SECTORS: Sector[] = [
  'vendas',
  'expedicao',
  'motoboys',
  'site',
  'compras',
  'estoque',
  'financeiro',
  'administracao',
  'garantias',
];

const SectorPicker = ({
  selected,
  onChange,
  max = 3,
}: {
  selected: Sector[];
  onChange: (s: Sector[]) => void;
  max?: number;
}) => (
  <div className="grid grid-cols-2 gap-1.5">
    {ALL_SECTORS.map((s) => (
      <label
        key={s}
        className={cn(
          'flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer hover:bg-secondary/50',
          selected.includes(s) && 'bg-secondary'
        )}
      >
        <Checkbox
          checked={selected.includes(s)}
          onCheckedChange={(checked) => {
            if (checked && selected.length >= max) {
              toast.error(`Máximo de ${max} setores`);
              return;
            }
            onChange(checked ? [...selected, s] : selected.filter((x) => x !== s));
          }}
        />
        {SECTOR_LABELS[s]}
      </label>
    ))}
  </div>
);

const ManageEmployeesDialog = () => {
  const { users, addUser, updateUser, deleteUser } = useApp();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSectors, setNewSectors] = useState<Sector[]>([]);
  const [newFunction, setNewFunction] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSectors, setEditSectors] = useState<Sector[]>([]);
  const [editFunction, setEditFunction] = useState('');
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [resetEmployeeName, setResetEmployeeName] = useState('');
  const [pendingReset, setPendingReset] = useState<{ id: string; name: string } | null>(null);

  const employees = users.filter((u) => u.role === 'employee');

  const handleAdd = async () => {
    if (!newName.trim() || !newUsername.trim() || newPassword.length < 6) {
      toast.error('Preencha nome, usuário e uma senha com pelo menos 6 caracteres');
      return;
    }
    if (newSectors.length === 0) {
      toast.error('Selecione ao menos um setor');
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      toast.error('Usuário já existe');
      return;
    }

    setSaving(true);
    try {
      await addUser({
        name: newName.trim(),
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        role: 'employee',
        sectors: newSectors,
        function: newFunction.trim() || undefined,
      });
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setNewSectors([]);
      setNewFunction('');
      setShowAdd(false);
      toast.success('Funcionário cadastrado no Firebase Auth');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar funcionário');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Preencha o nome');
      return;
    }
    if (editSectors.length === 0) {
      toast.error('Selecione ao menos um setor');
      return;
    }

    setSaving(true);
    try {
      await updateUser(id, {
        name: editName.trim(),
        sectors: editSectors,
        function: editFunction.trim() || undefined,
      });
      setEditingId(null);
      toast.success('Funcionário atualizado');
    } catch {
      toast.error('Erro ao atualizar funcionário');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setSaving(true);
    try {
      if (active) {
        await deleteUser(id);
        toast.success('Acesso desativado. O histórico foi preservado.');
      } else {
        await updateUser(id, { active: true });
        toast.success('Acesso reativado.');
      }
    } catch {
      toast.error('Não foi possível alterar o acesso');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAccess = async (id: string, name: string) => {
    const firebaseUser = auth.currentUser;
    const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

    if (!firebaseUser || !apiBaseUrl) {
      toast.error('Sessão administrativa ou API indisponível');
      return;
    }

    setResettingId(id);
    setTemporaryPassword(null);
    setPendingReset(null);

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${apiBaseUrl}/admin/users/reset-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: id }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        temporaryPassword?: string;
      };

      if (!response.ok || !data.temporaryPassword) {
        throw new Error(data.error || 'Não foi possível redefinir o acesso');
      }

      setResetEmployeeName(name);
      setTemporaryPassword(data.temporaryPassword);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao redefinir acesso');
    } finally {
      setResettingId(null);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;

    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast.success('Senha temporária copiada');
    } catch {
      toast.error('Não foi possível copiar automaticamente');
    }
  };

  const startEdit = (emp: (typeof employees)[0]) => {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditSectors(emp.sectors || []);
    setEditFunction(emp.function || '');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Funcionários
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Funcionários</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className={cn(
                  'border border-border rounded-lg p-3 space-y-2',
                  !emp.active && 'opacity-60'
                )}
              >
                {editingId === emp.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome"
                    />
                    <Input value={emp.username} disabled aria-label="Usuário" />
                    <Input
                      value={editFunction}
                      onChange={(e) => setEditFunction(e.target.value)}
                      placeholder="Função (ex: Vendedor)"
                    />
                    <div>
                      <p className="text-xs font-medium mb-1.5">Setores (máx. 3)</p>
                      <SectorPicker selected={editSectors} onChange={setEditSectors} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(emp.id)} disabled={saving}>
                        <Save className="w-3 h-3 mr-1" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        @{emp.username} {emp.function ? `• ${emp.function}` : ''}{' '}
                        {!emp.active ? '• DESATIVADO' : ''}
                      </p>
                      {emp.sectors.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {emp.sectors.map((s) => (
                            <span
                              key={s}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
                            >
                              {SECTOR_LABELS[s]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(emp)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setPendingReset({ id: emp.id, name: emp.name })}
                        disabled={saving || resettingId === emp.id}
                        title="Resetar acesso"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          'h-8 w-8',
                          emp.active && 'text-destructive hover:text-destructive'
                        )}
                        onClick={() => handleToggleActive(emp.id, emp.active)}
                        disabled={saving}
                        title={emp.active ? 'Desativar acesso' : 'Reativar acesso'}
                      >
                        {emp.active ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showAdd ? (
              <div className="border border-dashed border-primary/40 rounded-lg p-3 space-y-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo"
                />
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Nome de usuário"
                  autoComplete="off"
                />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Senha inicial (mín. 6 caracteres)"
                  autoComplete="new-password"
                />
                <Input
                  value={newFunction}
                  onChange={(e) => setNewFunction(e.target.value)}
                  placeholder="Função (ex: Vendedor)"
                />
                <div>
                  <p className="text-xs font-medium mb-1.5">Setores (máx. 3)</p>
                  <SectorPicker selected={newSectors} onChange={setNewSectors} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={saving}>
                    <Save className="w-3 h-3 mr-1" />
                    {saving ? 'Cadastrando...' : 'Cadastrar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAdd(false);
                      setNewName('');
                      setNewUsername('');
                      setNewPassword('');
                      setNewSectors([]);
                      setNewFunction('');
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Novo Funcionário
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingReset}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !resettingId) {
            setPendingReset(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border-border/70 p-0">
          <div className="border-b border-border/70 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" />
                Redefinir acesso
              </DialogTitle>
            </DialogHeader>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Você está prestes a redefinir o acesso de{' '}
              <span className="font-medium text-foreground">{pendingReset?.name}</span>.
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-warning/20 bg-warning/[0.06] px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                A senha atual deixará de funcionar.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Uma nova senha temporária será gerada e exibida logo em seguida para você copiar.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingReset(null)}
                disabled={!!resettingId}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() => {
                  if (pendingReset) {
                    void handleResetAccess(pendingReset.id, pendingReset.name);
                  }
                }}
                disabled={!pendingReset || !!resettingId}
                className="gap-2"
              >
                <KeyRound className="h-4 w-4" />
                {resettingId ? 'Redefinindo...' : 'Redefinir acesso'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!temporaryPassword}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setTemporaryPassword(null);
            setResetEmployeeName('');
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border-border/70 p-0">
          <div className="border-b border-border/70 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" />
                Acesso redefinido
              </DialogTitle>
            </DialogHeader>

            <p className="mt-2 text-sm text-muted-foreground">
              Senha temporária gerada para{' '}
              <span className="font-medium text-foreground">{resetEmployeeName}</span>.
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Senha temporária
              </p>

              <button
                type="button"
                onClick={() => void copyTemporaryPassword()}
                className="jf-interactive group flex w-full items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] px-4 py-3 text-left hover:border-primary/40 hover:bg-primary/[0.07]"
                title="Clique para copiar"
              >
                <span className="min-w-0 flex-1 break-all font-mono text-base font-semibold tracking-[0.08em] text-foreground">
                  {temporaryPassword}
                </span>

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors group-hover:text-primary">
                  <Copy className="h-4 w-4" />
                </span>
              </button>

              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Clique no campo acima para copiar. Esta senha aparece somente agora e deve ser
                entregue ao funcionário por um canal seguro.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  setTemporaryPassword(null);
                  setResetEmployeeName('');
                }}
              >
                Concluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageEmployeesDialog;

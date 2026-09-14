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
    if (!window.confirm(`Redefinir o acesso de ${name}? A senha atual deixará de funcionar.`))
      return;

    const firebaseUser = auth.currentUser;
    const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

    if (!firebaseUser || !apiBaseUrl) {
      toast.error('Sessão administrativa ou API indisponível');
      return;
    }

    setResettingId(id);
    setTemporaryPassword(null);

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
      toast.success('Acesso redefinido. Copie a senha temporária.');
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

        {temporaryPassword && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div>
              <p className="text-sm font-medium">Acesso redefinido para {resetEmployeeName}</p>
              <p className="text-xs text-muted-foreground">
                Esta senha aparece apenas agora. Entregue ao funcionário por um canal seguro.
              </p>
            </div>
            <div className="flex gap-2">
              <Input value={temporaryPassword} readOnly className="font-mono" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={copyTemporaryPassword}
                title="Copiar senha"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setTemporaryPassword(null);
                setResetEmployeeName('');
              }}
            >
              Fechar
            </Button>
          </div>
        )}

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
                      onClick={() => handleResetAccess(emp.id, emp.name)}
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
  );
};

export default ManageEmployeesDialog;

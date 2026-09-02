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
import { UserPlus, Pencil, Trash2, Key, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sector, SECTOR_LABELS } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [editUsername, setEditUsername] = useState('');
  const [editSectors, setEditSectors] = useState<Sector[]>([]);
  const [editFunction, setEditFunction] = useState('');
  const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');

  const employees = users.filter((u) => u.role === 'employee');

  const handleAdd = () => {
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (newSectors.length === 0) {
      toast.error('Selecione ao menos um setor');
      return;
    }
    if (users.some((u) => u.username === newUsername.trim())) {
      toast.error('Usuário já existe');
      return;
    }
    addUser({
      name: newName.trim(),
      username: newUsername.trim(),
      password: newPassword.trim(),
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
    toast.success('Funcionário cadastrado');
  };

  const handleEdit = (id: string) => {
    if (!editName.trim() || !editUsername.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (editSectors.length === 0) {
      toast.error('Selecione ao menos um setor');
      return;
    }
    if (users.some((u) => u.username === editUsername.trim() && u.id !== id)) {
      toast.error('Usuário já existe');
      return;
    }
    updateUser(id, {
      name: editName.trim(),
      username: editUsername.trim(),
      sectors: editSectors,
      function: editFunction.trim() || undefined,
    });
    setEditingId(null);
    toast.success('Funcionário atualizado');
  };

  const handleChangePassword = (id: string) => {
    if (!newPwd.trim()) {
      toast.error('Digite a nova senha');
      return;
    }
    updateUser(id, { password: newPwd.trim() });
    setChangingPasswordId(null);
    setNewPwd('');
    toast.success('Senha alterada');
  };

  const handleDelete = (id: string) => {
    deleteUser(id);
    toast.success('Funcionário removido');
  };

  const startEdit = (emp: (typeof employees)[0]) => {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditUsername(emp.username);
    setEditSectors(emp.sectors || []);
    setEditFunction(emp.function || '');
    setChangingPasswordId(null);
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

        <div className="space-y-3 mt-2">
          {employees.map((emp) => (
            <div key={emp.id} className="border border-border rounded-lg p-3 space-y-2">
              {editingId === emp.id ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome"
                  />
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Usuário"
                  />
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
                    <Button size="sm" onClick={() => handleEdit(emp.id)}>
                      <Save className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : changingPasswordId === emp.id ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Nova senha para {emp.name}</p>
                  <Input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Nova senha"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleChangePassword(emp.id)}>
                      <Save className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setChangingPasswordId(null);
                        setNewPwd('');
                      }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      @{emp.username} {emp.function ? `• ${emp.function}` : ''}
                    </p>
                    {emp.sectors && emp.sectors.length > 0 && (
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
                      onClick={() => {
                        setChangingPasswordId(emp.id);
                        setEditingId(null);
                      }}
                    >
                      <Key className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(emp.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Senha"
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
                <Button size="sm" onClick={handleAdd}>
                  <Save className="w-3 h-3 mr-1" />
                  Cadastrar
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

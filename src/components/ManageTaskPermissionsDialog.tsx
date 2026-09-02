import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTaskPermissions } from '@/hooks/useTaskPermissions';
import { SECTOR_LABELS, Sector } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Trash2, UserCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const ManageTaskPermissionsDialog = () => {
  const { users } = useApp();
  const { permissions, addPermission, removePermission } = useTaskPermissions();
  const [open, setOpen] = useState(false);
  const [selectedGranter, setSelectedGranter] = useState('');
  const [targetType, setTargetType] = useState<'employee' | 'sector'>('employee');
  const [targetValue, setTargetValue] = useState('');

  const employees = users.filter((u) => u.role === 'employee');
  const allAssignable = users.filter((u) => u.role === 'employee' || u.role === 'admin');

  const handleAdd = async () => {
    if (!selectedGranter || !targetValue) return;

    // Check duplicate
    const exists = permissions.some(
      (p) =>
        p.granterId === selectedGranter &&
        p.targetType === targetType &&
        p.targetValue === targetValue
    );
    if (exists) {
      toast.error('Essa permissão já existe');
      return;
    }

    await addPermission(selectedGranter, targetType, targetValue);
    toast.success('Permissão adicionada');
    setTargetValue('');
  };

  const handleRemove = async (id: string) => {
    await removePermission(id);
    toast.success('Permissão removida');
  };

  const getGranterName = (id: string) => users.find((u) => u.id === id)?.name || id;
  const getTargetLabel = (type: string, value: string) => {
    if (type === 'sector') return SECTOR_LABELS[value as Sector] || value;
    return users.find((u) => u.id === value)?.name || value;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Permissões de Tarefas</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões de Atribuição de Tarefas</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Defina quais funcionários podem criar e atribuir tarefas para outros funcionários ou
          setores.
        </p>

        <div className="space-y-4">
          {/* Add permission */}
          <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold">Adicionar Permissão</h4>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Funcionário que poderá atribuir tarefas
              </label>
              <Select value={selectedGranter} onValueChange={setSelectedGranter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Poderá atribuir para
              </label>
              <Tabs
                value={targetType}
                onValueChange={(v) => {
                  setTargetType(v as 'employee' | 'sector');
                  setTargetValue('');
                }}
              >
                <TabsList className="w-full mb-2">
                  <TabsTrigger value="employee" className="flex-1 gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Funcionário
                  </TabsTrigger>
                  <TabsTrigger value="sector" className="flex-1 gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Setor
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="employee">
                  <Select value={targetValue} onValueChange={setTargetValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {allAssignable.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="sector">
                  <Select value={targetValue} onValueChange={setTargetValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {SECTOR_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
              </Tabs>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!selectedGranter || !targetValue}
              className="w-full"
            >
              Adicionar Permissão
            </Button>
          </div>

          {/* Active permissions list */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Permissões Ativas ({permissions.length})</h4>
            {permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma permissão configurada
              </p>
            ) : (
              <div className="space-y-2">
                {permissions.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-card border border-border rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{getGranterName(p.granterId)}</span>
                      <span className="text-xs text-muted-foreground">pode atribuir para</span>
                      <Badge
                        variant={p.targetType === 'sector' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {p.targetType === 'sector' ? (
                          <Building2 className="w-3 h-3 mr-1" />
                        ) : (
                          <UserCheck className="w-3 h-3 mr-1" />
                        )}
                        {getTargetLabel(p.targetType, p.targetValue)}
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRemove(p.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageTaskPermissionsDialog;

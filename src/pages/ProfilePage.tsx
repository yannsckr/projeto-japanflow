import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Save, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { SECTOR_LABELS } from '@/types';
import { uploadImage } from '@/lib/uploadImage';

const ProfilePage = () => {
  const { currentUser, updateProfile, updateUser } = useApp();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  if (!currentUser) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Apenas JPG, JPEG e PNG são permitidos.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: `avatars/${currentUser.id}`,
        sourceTable: 'employees',
        sourceId: currentUser.id,
        sourceField: 'avatar',
        uploadedBy: currentUser.id,
        preserve: true,
      });
      await updateProfile({ avatar: publicUrl });
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const startEditing = () => {
    setEditName(currentUser.name);
    setEditUsername(currentUser.username);
    setEditPassword('');
    setEditing(true);
  };

  const handleSaveProfile = () => {
    if (!editName.trim() || !editUsername.trim()) {
      toast.error('Nome e usuário são obrigatórios');
      return;
    }
    const updates: any = { name: editName.trim(), username: editUsername.trim() };
    if (editPassword.trim()) updates.password = editPassword.trim();
    updateUser(currentUser.id, updates);
    setEditing(false);
    toast.success('Perfil atualizado!');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">Meu Perfil</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Foto de Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="w-3 h-3" />
            </Button>
          </div>
          <div>
            <p className="font-semibold">{currentUser.name}</p>
            <p className="text-sm text-muted-foreground">@{currentUser.username}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {currentUser.role === 'admin'
                ? 'Administrador'
                : currentUser.function || 'Funcionário'}
            </p>
            {currentUser.sectors.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {currentUser.sectors.map((s) => (
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome completo"
              />
              <Input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Usuário"
              />
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Nova senha (deixe vazio para manter)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile}>
                  <Save className="w-3 h-3 mr-1" />
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Nome:</span> {currentUser.name}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Usuário:</span> @{currentUser.username}
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={startEditing}>
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;

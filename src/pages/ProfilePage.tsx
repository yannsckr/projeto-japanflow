import { useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, KeyRound, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { SECTOR_LABELS } from '@/types';
import { uploadImage } from '@/lib/uploadImage';
import { changeOwnPassword } from '@/lib/authService';

const ProfilePage = () => {
  const { currentUser, updateProfile, updateUser } = useApp();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      await updateUser(currentUser.id, { name: editName.trim() });
      setEditing(false);
      toast.success('Perfil atualizado!');
    } catch {
      toast.error('Não foi possível atualizar o perfil');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || newPassword.length < 6) {
      toast.error('Informe a senha atual e uma nova senha com pelo menos 6 caracteres.');
      return;
    }

    try {
      setChangingPassword(true);
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Senha atualizada!');
    } catch {
      toast.error('Não foi possível alterar a senha. Confira a senha atual.');
    } finally {
      setChangingPassword(false);
    }
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
              <Input value={currentUser.username} disabled aria-label="Usuário" />
              <p className="text-xs text-muted-foreground">
                O nome de usuário fica fixo porque também identifica a conta no Firebase Auth.
              </p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Senha atual"
            autoComplete="current-password"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha"
            autoComplete="new-password"
          />
          <Button size="sm" onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;

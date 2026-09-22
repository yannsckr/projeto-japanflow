import { useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  KeyRound,
  Palette,
  Pencil,
  Save,
  Shield,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SECTOR_LABELS } from '@/types';
import { uploadImage } from '@/lib/uploadImage';
import { changeOwnPassword } from '@/lib/authService';
import { ChatAvatar } from '@/components/ChatMedia';
import ThemeSwitcher from '@/components/ThemeSwitcher';

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
        sourceTable: 'users',
        sourceId: currentUser.id,
        sourceField: 'avatar',
        uploadedBy: currentUser.id,
        preserve: true,
      });
      await updateProfile({ avatar: publicUrl });
      toast.success('Foto atualizada!');
    } catch (error) {
      console.error('Erro ao atualizar foto de perfil:', error);
      toast.error(
        error instanceof Error ? `Erro ao enviar foto: ${error.message}` : 'Erro ao enviar foto'
      );
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
    if (!editName.trim()) return toast.error('Nome é obrigatório');
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
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <section className="jf-diagonal-accent overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Conta</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Meu Perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gerencie sua identidade, acesso, preferências e segurança no JapanFlow.
        </p>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,.82fr)_minmax(0,1.18fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <ChatAvatar
                  src={currentUser.avatar}
                  name={currentUser.name}
                  className="h-28 w-28 rounded-[24px] text-3xl"
                />
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
                  className="absolute -bottom-2 -right-2 h-9 w-9 rounded-xl shadow-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Alterar foto de perfil"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>

              <h2 className="mt-5 text-xl font-semibold">{currentUser.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">@{currentUser.username}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-medium">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                {currentUser.role === 'admin'
                  ? 'Administrador'
                  : currentUser.function || 'Funcionário'}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Acesso</h2>
                <p className="text-xs text-muted-foreground">Seu vínculo dentro do ERP.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Perfil de acesso
                </p>
                <p className="mt-1 text-sm font-medium">
                  {currentUser.role === 'admin' ? 'Administrador' : 'Funcionário'}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Função
                </p>
                <p className="mt-1 text-sm font-medium">
                  {currentUser.function || 'Não informada'}
                </p>
              </div>

              {!!currentUser.sectors.length && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Setores
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentUser.sectors.map((sector) => (
                      <span
                        key={sector}
                        className="rounded-lg border border-primary/15 bg-primary/[0.06] px-2 py-1 text-[10px] font-medium text-primary"
                      >
                        {SECTOR_LABELS[sector]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Dados pessoais</h2>
                <p className="text-xs text-muted-foreground">
                  Informações visíveis dentro do JapanFlow.
                </p>
              </div>
            </div>

            {editing ? (
              <div className="space-y-3">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome completo"
                />
                <Input value={currentUser.username} disabled aria-label="Usuário" />
                <p className="text-xs text-muted-foreground">
                  O nome de usuário fica fixo porque identifica sua conta no Firebase Auth.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSaveProfile}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Nome
                  </p>
                  <p className="mt-1 text-sm font-medium">{currentUser.name}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Usuário
                  </p>
                  <p className="mt-1 text-sm font-medium">@{currentUser.username}</p>
                </div>
                <div className="sm:col-span-2">
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar dados
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Palette className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Aparência</h2>
                  <p className="text-xs text-muted-foreground">
                    Alterne entre o modo claro e escuro.
                  </p>
                </div>
              </div>
              <ThemeSwitcher />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Segurança</h2>
                <p className="text-xs text-muted-foreground">Altere sua senha de acesso.</p>
              </div>
            </div>
            <div className="space-y-3">
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
              <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                <p>A nova senha deve ter pelo menos 6 caracteres.</p>
              </div>
              <Button size="sm" onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? 'Alterando...' : 'Alterar senha'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

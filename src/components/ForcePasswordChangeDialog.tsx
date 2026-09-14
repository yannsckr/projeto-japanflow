import { useEffect, useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';

const apiBaseUrl = () => String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function authenticatedPost(path: string, body: unknown = {}) {
  const firebaseUser = auth.currentUser;
  const baseUrl = apiBaseUrl();

  if (!firebaseUser) throw new Error('Sessão Firebase não encontrada.');
  if (!baseUrl) throw new Error('VITE_API_BASE_URL não configurado.');

  const token = await firebaseUser.getIdToken();

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    mustChangePassword?: boolean;
    ok?: boolean;
  };

  if (!response.ok) {
    throw new Error(data.error || `API HTTP ${response.status}`);
  }

  return data;
}

const ForcePasswordChangeDialog = () => {
  const { currentUser } = useApp();
  const [mustChange, setMustChange] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!currentUser || !auth.currentUser) {
      setMustChange(false);
      return;
    }

    let cancelled = false;

    const checkStatus = async () => {
      setChecking(true);

      try {
        const data = await authenticatedPost('/account/password-reset-status');

        if (!cancelled) {
          setMustChange(data.mustChangePassword === true);
        }
      } catch (error) {
        console.error('Erro ao verificar troca obrigatória de senha:', error);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const handleSave = async () => {
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      toast.error('Sessão expirada. Entre novamente.');
      return;
    }

    setSaving(true);

    try {
      await updatePassword(firebaseUser, newPassword);

      await authenticatedPost('/account/password-reset-complete');

      setMustChange(false);
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha definitiva criada com sucesso.');
    } catch (error: any) {
      console.error('Erro ao trocar senha definitiva:', error);

      const message =
        error?.code === 'auth/requires-recent-login'
          ? 'Por segurança, faça login novamente com a senha temporária e tente de novo.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível alterar a senha.';

      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (checking && !mustChange) return null;

  return (
    <Dialog open={mustChange}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">Crie sua nova senha</DialogTitle>
          <DialogDescription className="text-center">
            Você entrou com uma senha temporária. Antes de continuar no JapanFlow, defina uma senha
            definitiva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            autoComplete="new-password"
            disabled={saving}
          />

          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirme a nova senha"
            autoComplete="new-password"
            disabled={saving}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !saving) {
                void handleSave();
              }
            }}
          />

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Definir senha definitiva'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Esta janela só será liberada depois que a nova senha for salva.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForcePasswordChangeDialog;

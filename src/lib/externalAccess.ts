import { supabase } from '@/integrations/supabase/client';

// Chave usada em user_feature_permissions para liberar acesso fora da rede
export const EXTERNAL_ACCESS_KEY = 'external_access' as const;

export async function userCanAccessExternally(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_feature_permissions')
      .select('enabled')
      .eq('user_id', userId)
      .eq('feature_key', EXTERNAL_ACCESS_KEY)
      .maybeSingle();
    if (error) return false;
    return data?.enabled === true;
  } catch {
    return false;
  }
}

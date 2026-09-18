import { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

import acompanhamentoUrl from '@/assets/icons/acompanhamento.svg';
import anotacoesUrl from '@/assets/icons/anotacoes.svg';
import backfill_imagensUrl from '@/assets/icons/backfill-imagens.svg';
import calculadora_de_vendasUrl from '@/assets/icons/calculadora-de-vendas.svg';
import chatUrl from '@/assets/icons/chat.svg';
import corporativoUrl from '@/assets/icons/corporativo.svg';
import corridasUrl from '@/assets/icons/corridas.svg';
import departamentalUrl from '@/assets/icons/departamental.svg';
import documentosUrl from '@/assets/icons/documentos.svg';
import encomendas_balcaoUrl from '@/assets/icons/encomendas-balcao.svg';
import financeiroUrl from '@/assets/icons/financeiro.svg';
import historico_de_conversasUrl from '@/assets/icons/historico-de-conversas.svg';
import inventarioUrl from '@/assets/icons/inventario.svg';
import meu_quadroUrl from '@/assets/icons/meu-quadro.svg';
import monitoriaUrl from '@/assets/icons/monitoria.svg';
import pedido_de_comprasUrl from '@/assets/icons/pedido-de-compras.svg';
import perfilUrl from '@/assets/icons/perfil.svg';
import politicas_internasUrl from '@/assets/icons/politicas-internas.svg';
import premiacoesUrl from '@/assets/icons/premiacoes.svg';
import relatoriosUrl from '@/assets/icons/relatorios.svg';

export type JapanFlowIconName =
  | 'acompanhamento'
  | 'anotacoes'
  | 'backfill-imagens'
  | 'calculadora-de-vendas'
  | 'chat'
  | 'corporativo'
  | 'corridas'
  | 'departamental'
  | 'documentos'
  | 'encomendas-balcao'
  | 'financeiro'
  | 'historico-de-conversas'
  | 'inventario'
  | 'meu-quadro'
  | 'monitoria'
  | 'pedido-de-compras'
  | 'perfil'
  | 'politicas-internas'
  | 'premiacoes'
  | 'relatorios';

const iconUrls: Record<JapanFlowIconName, string> = {
  acompanhamento: acompanhamentoUrl,
  anotacoes: anotacoesUrl,
  'backfill-imagens': backfill_imagensUrl,
  'calculadora-de-vendas': calculadora_de_vendasUrl,
  chat: chatUrl,
  corporativo: corporativoUrl,
  corridas: corridasUrl,
  departamental: departamentalUrl,
  documentos: documentosUrl,
  'encomendas-balcao': encomendas_balcaoUrl,
  financeiro: financeiroUrl,
  'historico-de-conversas': historico_de_conversasUrl,
  inventario: inventarioUrl,
  'meu-quadro': meu_quadroUrl,
  monitoria: monitoriaUrl,
  'pedido-de-compras': pedido_de_comprasUrl,
  perfil: perfilUrl,
  'politicas-internas': politicas_internasUrl,
  premiacoes: premiacoesUrl,
  relatorios: relatoriosUrl,
};

interface JapanFlowIconProps {
  name: JapanFlowIconName;
  className?: string;
  title?: string;
}

const JapanFlowIcon = ({ name, className, title }: JapanFlowIconProps) => {
  const url = iconUrls[name];

  const style = {
    WebkitMaskImage: `url("${url}")`,
    maskImage: `url("${url}")`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    backgroundColor: 'currentColor',
  } as CSSProperties;

  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('inline-block shrink-0', className)}
      style={style}
    />
  );
};

export default JapanFlowIcon;

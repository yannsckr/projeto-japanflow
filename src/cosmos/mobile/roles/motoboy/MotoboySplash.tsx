import { useEffect } from 'react';
import logoLight from '@/assets/japanflow-logo-light.png';
import markLight from '@/assets/japanflow-mark-light.png';
import './motoboy.css';

export default function MotoboySplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, 1100);
    return () => window.clearTimeout(timeout);
  }, [onDone]);
  return (
    <div className="jf-moto-splash" role="status" aria-label="Iniciando JapanFlow">
      <div className="jf-moto-splash-brand">
        <img src={markLight} alt="" />
        <img src={logoLight} alt="JapanFlow" />
      </div>
      <span className="jf-moto-red-circle" aria-hidden="true" />
    </div>
  );
}

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

const ExpedientWorkflowDynamic = dynamic(() => import('./ExpedientWorkflow').then(mod => ({ default: mod.ExpedientWorkflow })), {
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-slate-900/50">
      <div className="text-slate-400 text-sm">Cargando expediente...</div>
    </div>
  ),
  ssr: false,
});

interface ExpedientWorkflowLazyProps {
  expedient: any;
  onStateChange: (expedient: any) => void;
  currentUser: { name: string; role: 'OPERATOR' | 'SUPERVISOR' | 'ADMIN' };
  infractionRow?: Record<string, any> | null;
  expedientImages?: string[];
}

export const ExpedientWorkflowLazy: React.FC<ExpedientWorkflowLazyProps> = (props) => {
  return (
    <Suspense fallback={<div className="text-slate-400">Cargando...</div>}>
      <ExpedientWorkflowDynamic {...props} />
    </Suspense>
  );
};

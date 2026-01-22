import { useContext } from 'react';
import { SentinelContext } from '../context/SentinelContext';

/**
 * Hook personalizado para acceder de forma segura al contexto de Sentinel AI.
 * Lanza un error descriptivo si se intenta usar fuera del SentinelProvider.
 */
export const useSentinel = () => {
    const context = useContext(SentinelContext);
    if (context === undefined) {
        throw new Error('useSentinel debe ser utilizado dentro de un SentinelProvider. Verifica la envoltura en App.tsx o index.tsx.');
    }
    return context;
};

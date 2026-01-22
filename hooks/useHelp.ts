import { useCallback } from 'react';
import { useSentinel } from './useSentinel';

export const useHelp = () => {
    const { setHelpMsg } = useSentinel();

    const showHelp = useCallback((msg: string) => {
        setHelpMsg(msg);
    }, [setHelpMsg]);

    const clearHelp = useCallback(() => {
        setHelpMsg(null);
    }, [setHelpMsg]);

    const helpProps = (msg: string) => ({
        onMouseEnter: () => showHelp(msg),
        onMouseLeave: () => clearHelp(),
    });

    return { showHelp, clearHelp, helpProps };
};

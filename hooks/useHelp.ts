import { useCallback } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

export const useHelp = () => {
  const { setHelpMsg } = useLayoutStore();

  const showHelp = useCallback(
    (msg: string) => {
      setHelpMsg(msg);
    },
    [setHelpMsg]
  );

  const clearHelp = useCallback(() => {
    setHelpMsg(null);
  }, [setHelpMsg]);

  const helpProps = (msg: string) => ({
    onMouseEnter: () => showHelp(msg),
    onMouseLeave: () => clearHelp(),
  });

  return { showHelp, clearHelp, helpProps };
};

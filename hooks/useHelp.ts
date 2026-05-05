import { useCallback, useContext } from 'react';
import { SentinelContext } from '../context/SentinelContext';

export const useHelp = () => {
  const sentinel = useContext(SentinelContext);

  const showHelp = useCallback(
    (msg: string) => {
      sentinel?.setHelpMsg?.(msg);
    },
    [sentinel]
  );

  const clearHelp = useCallback(() => {
    sentinel?.setHelpMsg?.(null);
  }, [sentinel]);

  const helpProps = (msg: string) => ({
    onMouseEnter: () => showHelp(msg),
    onMouseLeave: () => clearHelp(),
    onFocus: () => showHelp(msg),
    onBlur: () => clearHelp(),
  });

  return { showHelp, clearHelp, helpProps };
};

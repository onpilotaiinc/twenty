import { useCallback } from 'react';

import { isCopilotOpenState } from '@/copilot/states/isCopilotOpenState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useToggleCopilot = () => {
  const [, setOpen] = useAtomState(isCopilotOpenState);

  const toggleCopilot = useCallback(() => {
    setOpen((prev) => !prev);
  }, [setOpen]);

  return { toggleCopilot };
};

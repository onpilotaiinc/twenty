import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const isCopilotOpenState = createAtomState<boolean>({
  key: 'isCopilotOpen',
  defaultValue: false,
});

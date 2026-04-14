import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const COPILOT_PANEL_DEFAULT_WIDTH = 400;
export const COPILOT_PANEL_MIN_WIDTH = 320;
export const COPILOT_PANEL_MAX_WIDTH = 700;

export const copilotPanelWidthState = createAtomState<number>({
  key: 'copilotPanelWidth',
  defaultValue: COPILOT_PANEL_DEFAULT_WIDTH,
});

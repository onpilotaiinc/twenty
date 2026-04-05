import { CopilotPanel } from '@onpilot/react';
import { styled } from '@linaria/react';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { isCopilotOpenState } from '@/copilot/states/isCopilotOpenState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { IconX } from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const COPILOT_ID = '9f559254-ecfd-4212-b0b8-3b15a35aa690';

const StyledWrapper = styled.div<{ isOpen: boolean }>`
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.2s ease;
  width: ${({ isOpen }) => (isOpen ? '400px' : '0px')};
  padding-bottom: ${themeCssVariables.spacing[3]};
  padding-right: ${({ isOpen }) =>
    isOpen ? themeCssVariables.spacing[3] : '0'};
`;

const StyledPanel = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  width: 400px;
`;

const StyledTopBar = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 6px 6px 6px 12px;
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const tokenFetcher = async () => {
  const tokenPair = getTokenPair();
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/api/chat-token`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  return data.token;
};

export const CopilotSidePanel = () => {
  const [isOpen, setIsOpen] = useAtomState(isCopilotOpenState);

  if (!isOpen) {
    return null;
  }

  return (
    <StyledWrapper isOpen={isOpen}>
      <StyledPanel>
        <StyledTopBar>
          <StyledTitle>Copilot</StyledTitle>
          <IconButton
            Icon={IconX}
            size="small"
            variant="tertiary"
            onClick={() => setIsOpen(false)}
            ariaLabel="Close Copilot"
          />
        </StyledTopBar>
        <CopilotPanel
          copilotId={COPILOT_ID}
          tokenFetcher={tokenFetcher}
          chatUrl="https://chat-dev.onpilot.ai"
          theme="light"
        />
      </StyledPanel>
    </StyledWrapper>
  );
};

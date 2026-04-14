import { useToggleCopilot } from '@/copilot/hooks/useToggleCopilot';
import { styled } from '@linaria/react';
import { IconSparkles } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledButton = styled.div`
  background: #3276e3;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  user-select: none;

  &:hover {
    background: #2968d4;
  }
`;

export const CopilotToggleButton = () => {
  const { toggleCopilot } = useToggleCopilot();

  return (
    <StyledButton onClick={toggleCopilot} aria-label="Toggle Copilot">
      <IconSparkles size={14} />
      Copilot
    </StyledButton>
  );
};

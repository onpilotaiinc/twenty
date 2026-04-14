import { CopilotPanel, type CopilotContext } from '@onpilot/react';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  copilotPanelWidthState,
  COPILOT_PANEL_MIN_WIDTH,
  COPILOT_PANEL_MAX_WIDTH,
} from '@/copilot/states/copilotPanelWidthState';
import { isCopilotOpenState } from '@/copilot/states/isCopilotOpenState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { getRecordFromCache } from '@/object-record/cache/utils/getRecordFromCache';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const COPILOT_CHAT_URL = import.meta.env.VITE_COPILOT_CHAT_URL || 'https://chat.onpilot.ai';

const COPILOT_ID = '1a7d57f3-662e-486d-89af-53727396b4d6';

const HEADER_HEIGHT = 56;

const StyledWrapper = styled.div<{ isOpen: boolean; panelWidth: number }>`
  bottom: 0;
  pointer-events: ${({ isOpen }) => (isOpen ? 'auto' : 'none')};
  position: absolute;
  right: 0;
  top: ${HEADER_HEIGHT}px;
  transition: ${({ isOpen }) => (isOpen ? 'none' : 'transform 0.3s ease')};
  transform: translateX(${({ isOpen }) => (isOpen ? '0' : '100%')});
  width: ${({ panelWidth }) => panelWidth}px;
  z-index: 10;
`;

const StyledPanel = styled.div<{ isVisible: boolean }>`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  border-top-left-radius: ${themeCssVariables.border.radius.md};
  display: ${({ isVisible }) => (isVisible ? 'flex' : 'none')};
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  width: 100%;
`;

const StyledResizeHandle = styled.div`
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 11;

  &:hover,
  &:active {
    &::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #8b5cf6;
      border-radius: 1px;
    }
  }
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

// Extract a human-readable display name from a record, falling back to the recordId.
// Companies store name as a plain string; people store name as { firstName, lastName }.
const getRecordDisplayName = (
  record: Record<string, unknown> | null | undefined,
  fallback: string,
): string => {
  if (!record) return fallback;

  const nameField = record['name'];

  if (typeof nameField === 'string' && nameField.trim() !== '') {
    return nameField.trim();
  }

  if (nameField && typeof nameField === 'object') {
    const nameObj = nameField as Record<string, unknown>;
    const first = typeof nameObj['firstName'] === 'string' ? nameObj['firstName'] : '';
    const last = typeof nameObj['lastName'] === 'string' ? nameObj['lastName'] : '';
    const fullName = `${first} ${last}`.trim();
    if (fullName !== '') return fullName;
  }

  return fallback;
};

const useCopilotContext = (): CopilotContext => {
  const location = useLocation();
  const recordPageMatch = matchPath(
    AppPath.RecordShowPage,
    location.pathname,
  );

  const objectNameSingular = recordPageMatch?.params.objectNameSingular;
  const objectRecordId = recordPageMatch?.params.objectRecordId;

  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();
  const apolloCoreClient = useApolloCoreClient();

  const pageContext: CopilotContext = {
    url: window.location.href,
    title: document.title,
  };

  if (!objectNameSingular || !objectRecordId) {
    return pageContext;
  }

  const objectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) =>
      objectMetadataItem.nameSingular === objectNameSingular,
  );

  const record =
    objectMetadataItem === undefined
      ? null
      : getRecordFromCache({
          cache: apolloCoreClient.cache,
          recordId: objectRecordId,
          objectMetadataItems,
          objectMetadataItem,
          objectPermissionsByObjectMetadataId,
        });

  if (!record) {
    return {
      ...pageContext,
      recordType: objectNameSingular,
      recordId: objectRecordId,
    };
  }

  const recordName = getRecordDisplayName(
    record as Record<string, unknown>,
    objectRecordId,
  );

  return {
    ...pageContext,
    title: recordName === objectRecordId ? pageContext.title : recordName,
    recordType: objectNameSingular,
    recordId: objectRecordId,
    recordData: record as Record<string, unknown>,
  };
};

const sendUserToken = (iframe: HTMLIFrameElement) => {
  const tokenPair = getTokenPair();
  const sessionToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  if (!sessionToken || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(
    {
      type: 'onpilot:user_token',
      data: {
        token: sessionToken,
        apiBaseUrl: REACT_APP_SERVER_BASE_URL,
      },
    },
    '*',
  );
};

export const CopilotSidePanel = () => {
  const isOpen = useAtomStateValue(isCopilotOpenState);
  const setIsOpen = useSetAtomState(isCopilotOpenState);
  const panelWidth = useAtomStateValue(copilotPanelWidthState);
  const setPanelWidth = useSetAtomState(copilotPanelWidthState);
  const context = useCopilotContext();
  const iframeReadyRef = useRef(false);
  const isDraggingRef = useRef(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.min(
          COPILOT_PANEL_MAX_WIDTH,
          Math.max(COPILOT_PANEL_MIN_WIDTH, startWidth + delta),
        );
        setPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [panelWidth, setPanelWidth],
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const { type } = event.data as { type: string };
      if (type === 'onpilot:close') {
        handleClose();
      }
      if (type === 'onpilot:ready') {
        iframeReadyRef.current = true;
        const iframe = document.querySelector<HTMLIFrameElement>(
          'iframe[title="OnPilot Chat"]',
        );
        if (iframe) sendUserToken(iframe);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleClose]);

  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);

  const userName = currentWorkspaceMember
    ? `${currentWorkspaceMember.name.firstName} ${currentWorkspaceMember.name.lastName}`.trim()
    : undefined;

  return (
    <StyledWrapper isOpen={isOpen} panelWidth={panelWidth}>
      <StyledResizeHandle onMouseDown={handleResizeStart} />
      <StyledPanel isVisible={isOpen}>
        <CopilotPanel
          copilotId={COPILOT_ID}
          tokenFetcher={tokenFetcher}
          chatUrl={COPILOT_CHAT_URL}
          theme="light"
          context={context}
          userId={currentWorkspaceMember?.id}
          orgId={currentWorkspace?.id}
          userName={userName}
          userEmail={currentWorkspaceMember?.userEmail}
        />
      </StyledPanel>
    </StyledWrapper>
  );
};

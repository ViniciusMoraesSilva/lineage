import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

type FullscreenDocument = Document & {
  fullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
};

type FullscreenContainerElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
};

export interface UseLineageFullscreenOptions {
  containerRef: RefObject<HTMLElement | null>;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  refitDelayMs?: number;
}

export interface LineageFullscreenController {
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
}

export const DEFAULT_LINEAGE_FULLSCREEN_REFIT_DELAY_MS = 80;

function getBrowserFullscreenDocument(): FullscreenDocument | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document as FullscreenDocument;
}

export function canUseLineageFullscreen(
  fullscreenDocument: FullscreenDocument | null,
  containerElement: HTMLElement | null,
): boolean {
  const candidateElement = containerElement as FullscreenContainerElement | null;

  return Boolean(
    fullscreenDocument?.fullscreenEnabled &&
      candidateElement?.requestFullscreen,
  );
}

export function isLineageFullscreenActive(
  fullscreenDocument: FullscreenDocument | null,
  containerElement: HTMLElement | null,
): boolean {
  return Boolean(
    fullscreenDocument?.fullscreenElement &&
      containerElement &&
      fullscreenDocument.fullscreenElement === containerElement,
  );
}

export function scheduleLineageFullscreenRefit(
  onFullscreenChange: ((isFullscreen: boolean) => void) | undefined,
  isFullscreen: boolean,
  delayMs = DEFAULT_LINEAGE_FULLSCREEN_REFIT_DELAY_MS,
): () => void {
  if (!onFullscreenChange) {
    return () => undefined;
  }

  const timeoutId = setTimeout(() => {
    onFullscreenChange(isFullscreen);
  }, delayMs);

  return () => clearTimeout(timeoutId);
}

export function useLineageFullscreen({
  containerRef,
  onFullscreenChange,
  refitDelayMs = DEFAULT_LINEAGE_FULLSCREEN_REFIT_DELAY_MS,
}: UseLineageFullscreenOptions): LineageFullscreenController {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const clearPendingRefitRef = useRef<(() => void) | null>(null);

  const syncFullscreenState = useCallback(
    (shouldNotifyViewport: boolean) => {
      const fullscreenDocument = getBrowserFullscreenDocument();
      const containerElement = containerRef.current;
      const nextIsFullscreenSupported = canUseLineageFullscreen(fullscreenDocument, containerElement);
      const nextIsFullscreen = isLineageFullscreenActive(fullscreenDocument, containerElement);

      setIsFullscreenSupported(nextIsFullscreenSupported);
      setIsFullscreen(nextIsFullscreen);

      if (shouldNotifyViewport) {
        clearPendingRefitRef.current?.();
        clearPendingRefitRef.current = scheduleLineageFullscreenRefit(
          onFullscreenChange,
          nextIsFullscreen,
          refitDelayMs,
        );
      }
    },
    [containerRef, onFullscreenChange, refitDelayMs],
  );

  useEffect(() => {
    const fullscreenDocument = getBrowserFullscreenDocument();
    if (!fullscreenDocument) {
      return;
    }

    syncFullscreenState(false);

    const handleFullscreenChange = () => {
      syncFullscreenState(true);
    };

    fullscreenDocument.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      fullscreenDocument.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearPendingRefitRef.current?.();
      clearPendingRefitRef.current = null;
    };
  }, [syncFullscreenState]);

  const enterFullscreen = useCallback(async () => {
    const fullscreenDocument = getBrowserFullscreenDocument();
    const containerElement = containerRef.current as FullscreenContainerElement | null;

    if (isLineageFullscreenActive(fullscreenDocument, containerElement)) {
      return true;
    }

    if (!canUseLineageFullscreen(fullscreenDocument, containerElement)) {
      return false;
    }

    if (!containerElement) {
      return false;
    }

    try {
      await containerElement.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  }, [containerRef]);

  const exitFullscreen = useCallback(async () => {
    const fullscreenDocument = getBrowserFullscreenDocument();

    if (!fullscreenDocument?.fullscreenElement || !fullscreenDocument.exitFullscreen) {
      return false;
    }

    try {
      await fullscreenDocument.exitFullscreen();
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenDocument = getBrowserFullscreenDocument();
    const containerElement = containerRef.current;

    if (isLineageFullscreenActive(fullscreenDocument, containerElement)) {
      return exitFullscreen();
    }

    return enterFullscreen();
  }, [containerRef, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    isFullscreenSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
import { CSSProperties, MutableRefObject } from 'react';

export interface LineageFitViewInstance {
    fitView: (options?: { padding?: number; duration?: number }) => void;
}

export function getLineageFullscreenButtonLabel(isFullscreen: boolean): string {
    return isFullscreen ? 'Sair da tela cheia' : 'Tela cheia';
}

export function getLineageFullscreenButtonTitle(isFullscreen: boolean): string {
    return isFullscreen ? 'Sair da tela cheia (Esc)' : 'Expandir para tela cheia';
}

export function getLineageFullscreenPanelStyle({
    isFullscreen,
    isDark,
    defaultHeight,
}: {
    isFullscreen: boolean;
    isDark: boolean;
    defaultHeight: string;
}): CSSProperties {
    return {
        height: isFullscreen ? '100dvh' : defaultHeight,
        width: isFullscreen ? '100vw' : '100%',
        backgroundColor: isDark ? '#201F1E' : '#FAF9F8',
        border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
        borderRadius: isFullscreen ? '0' : '8px',
        overflow: 'hidden',
        position: 'relative',
    };
}

export function getLineageFullscreenButtonStyle({
    isDark,
    isFullscreenSupported,
}: {
    isDark: boolean;
    isFullscreenSupported: boolean;
}): CSSProperties {
    return {
        position: 'absolute',
        top: 10,
        right: 130,
        zIndex: 5,
        padding: '6px 12px',
        fontSize: '11px',
        fontFamily: "'Segoe UI', sans-serif",
        fontWeight: 600,
        backgroundColor: isDark ? '#252423' : '#FFFFFF',
        color: isDark ? '#D2D0CE' : '#323130',
        border: `1px solid ${isDark ? '#484644' : '#EDEBE9'}`,
        borderRadius: '4px',
        cursor: isFullscreenSupported ? 'pointer' : 'not-allowed',
        opacity: isFullscreenSupported ? 1 : 0.65,
    };
}

export function createLineageFullscreenRefitCallback(
    reactFlowRef: MutableRefObject<LineageFitViewInstance | null>,
): () => void {
    return () => {
        reactFlowRef.current?.fitView({ padding: 0.2, duration: 300 });
    };
}
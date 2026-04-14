import fs from 'fs';
import path from 'path';

import {
    createLineageFullscreenRefitCallback,
    getLineageFullscreenButtonLabel,
    getLineageFullscreenButtonStyle,
    getLineageFullscreenButtonTitle,
    getLineageFullscreenPanelStyle,
} from '../src/components/lineageFullscreenPanel';

describe('lineage fullscreen panel helpers', () => {
    it('returns a consistent button contract for enter and exit labels', () => {
        expect(getLineageFullscreenButtonLabel(false)).toBe('Tela cheia');
        expect(getLineageFullscreenButtonLabel(true)).toBe('Sair da tela cheia');
        expect(getLineageFullscreenButtonTitle(false)).toBe('Expandir para tela cheia');
        expect(getLineageFullscreenButtonTitle(true)).toBe('Sair da tela cheia (Esc)');
    });

    it('expands the panel to the viewport only while fullscreen is active', () => {
        expect(
            getLineageFullscreenPanelStyle({
                isFullscreen: false,
                isDark: false,
                defaultHeight: '600px',
            }),
        ).toMatchObject({
            height: '600px',
            width: '100%',
            borderRadius: '8px',
            position: 'relative',
        });

        expect(
            getLineageFullscreenPanelStyle({
                isFullscreen: true,
                isDark: true,
                defaultHeight: '500px',
            }),
        ).toMatchObject({
            height: '100dvh',
            width: '100vw',
            borderRadius: '0',
            backgroundColor: '#201F1E',
        });
    });

    it('keeps button styling consistent and refits the graph through the shared callback', () => {
        expect(
            getLineageFullscreenButtonStyle({
                isDark: true,
                isFullscreenSupported: false,
            }),
        ).toMatchObject({
            right: 130,
            cursor: 'not-allowed',
            opacity: 0.65,
        });

        const fitView = jest.fn();
        const refit = createLineageFullscreenRefitCallback({
            current: { fitView },
        });

        refit();

        expect(fitView).toHaveBeenCalledWith({ padding: 0.2, duration: 300 });
    });

    it('keeps ColumnLineage filters and chips inside the fullscreen scope', () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), 'src/components/ColumnLineage.tsx'),
            'utf8',
        );

        const fullscreenScopeIndex = source.indexOf('ref={containerRef}');
        const transformationFilterIndex = source.indexOf('value={transformationFilter}');
        const columnChipInputIndex = source.indexOf('value={columnNameInput}');
        const reactFlowIndex = source.indexOf('<ReactFlow');

        expect(fullscreenScopeIndex).toBeGreaterThan(-1);
        expect(transformationFilterIndex).toBeGreaterThan(-1);
        expect(columnChipInputIndex).toBeGreaterThan(-1);
        expect(reactFlowIndex).toBeGreaterThan(-1);
        expect(fullscreenScopeIndex).toBeLessThan(transformationFilterIndex);
        expect(fullscreenScopeIndex).toBeLessThan(columnChipInputIndex);
        expect(fullscreenScopeIndex).toBeLessThan(reactFlowIndex);
    });
});
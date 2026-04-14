import {
    exportDetailedLineageWorkbook,
    exportExecutiveClassificationWorkbook,
    getMainframeExportHelperText,
    MAINFRAME_CLASSIFICATION_EXCEL_LABEL,
    MAINFRAME_DETAILED_EXCEL_LABEL,
} from '@/lib/mainframe/exportWorkbookActions';
import type { ParsedLineage } from '@/lib/types';

jest.mock('@/lib/mainframe/exportClassificationExcel', () => ({
    exportClassificationExcel: jest.fn(),
}));

jest.mock('@/lib/mainframe/exportLineageExcel', () => ({
    exportLineageExcel: jest.fn(),
}));

const { exportClassificationExcel } = jest.requireMock('@/lib/mainframe/exportClassificationExcel') as {
    exportClassificationExcel: jest.Mock;
};
const { exportLineageExcel } = jest.requireMock('@/lib/mainframe/exportLineageExcel') as {
    exportLineageExcel: jest.Mock;
};

describe('mainframe export actions', () => {
    const data = {} as ParsedLineage;
    const selectedFields = [
        {
            datasetKey: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
            field: 'DEMO-ID',
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('defines distinct labels and helper copy for the two workbook flows', () => {
        expect(MAINFRAME_DETAILED_EXCEL_LABEL).not.toBe(MAINFRAME_CLASSIFICATION_EXCEL_LABEL);
        expect(MAINFRAME_DETAILED_EXCEL_LABEL).toBe('Exportar Excel detalhado');
        expect(MAINFRAME_CLASSIFICATION_EXCEL_LABEL).toBe('Exportar Excel de classificacao');
        expect(getMainframeExportHelperText(2)).toContain('Excel detalhado: linhagem e regras dos campos selecionados.');
        expect(getMainframeExportHelperText(2)).toContain('Excel de classificacao: responde origem, hard code e gerado no fluxo para a selecao atual.');
    });

    it('keeps the classification flow explicit when there is no field selected', () => {
        expect(getMainframeExportHelperText(0)).toBe(
            'Excel de classificacao: responde origem, hard code e gerado no fluxo para os campos visiveis do filtro JCL atual.',
        );
    });

    it('dispatches the executive workbook using the T1/T2 scope contract', () => {
        exportExecutiveClassificationWorkbook(data, selectedFields);

        expect(exportClassificationExcel).toHaveBeenCalledWith(data, {
            selectedFields,
        });
    });

    it('preserves the detailed export flow for the currently selected fields', () => {
        exportDetailedLineageWorkbook(data, selectedFields);

        expect(exportLineageExcel).toHaveBeenCalledWith(data, selectedFields);
    });

    it('does not trigger the detailed export when there is no field selected', () => {
        exportDetailedLineageWorkbook(data, []);

        expect(exportLineageExcel).not.toHaveBeenCalled();
    });
});
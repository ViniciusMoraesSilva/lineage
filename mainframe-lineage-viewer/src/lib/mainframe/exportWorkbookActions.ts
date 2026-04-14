import { type ClassificationFieldSelection, exportClassificationExcel } from '@/lib/mainframe/exportClassificationExcel';
import { exportLineageExcel } from '@/lib/mainframe/exportLineageExcel';
import type { ParsedLineage } from '@/lib/types';

export const MAINFRAME_DETAILED_EXCEL_LABEL = 'Exportar Excel detalhado';
export const MAINFRAME_CLASSIFICATION_EXCEL_LABEL = 'Exportar Excel de classificacao';

export function getMainframeExportHelperText(selectedFieldsCount: number): string {
    if (selectedFieldsCount > 0) {
        return 'Excel detalhado: linhagem e regras dos campos selecionados. Excel de classificacao: responde origem, hard code e gerado no fluxo para a selecao atual.';
    }

    return 'Excel de classificacao: responde origem, hard code e gerado no fluxo para os campos visiveis do filtro JCL atual.';
}

export function exportDetailedLineageWorkbook(
    data: ParsedLineage,
    selectedFields: ClassificationFieldSelection[],
): void {
    if (selectedFields.length === 0) {
        return;
    }

    exportLineageExcel(data, selectedFields);
}

export function exportExecutiveClassificationWorkbook(
    data: ParsedLineage,
    selectedFields: ClassificationFieldSelection[],
): void {
    exportClassificationExcel(data, { selectedFields });
}
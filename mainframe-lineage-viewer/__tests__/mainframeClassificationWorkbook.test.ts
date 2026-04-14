import fs from 'node:fs';
import path from 'node:path';

import * as XLSX from 'xlsx';

import {
    buildClassificationWorkbook,
    buildMainframeFieldClassificationRows,
} from '@/lib/mainframe/exportClassificationExcel';
import { parseCanonicalBundle } from '@/lib/mainframe/parseCanonicalBundle';

function readSampleFile(fileName: string): string {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'mainframe-sample', fileName), 'utf8');
}

function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];

        if (character === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (character === ',' && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += character;
    }

    values.push(current);
    return values;
}

function readDidacticMatrix(): Array<Record<string, string>> {
    const repoRoot = path.resolve(process.cwd(), '..');
    const matrixPath = path.join(
        repoRoot,
        'docs',
        'plan',
        'mainframe-sample-jcldb001-taxonomia-completa',
        'didactic-matrix.csv',
    );
    const text = fs.readFileSync(matrixPath, 'utf8').trim();
    const lines = text.split(/\r?\n/);
    const headers = parseCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });
}

function loadSampleBundle() {
    return parseCanonicalBundle({
        entities: readSampleFile('entities.csv'),
        entityColumns: readSampleFile('entity_columns.csv'),
        columnMappings: readSampleFile('column_mappings.csv'),
        transformRules: readSampleFile('transform_rules.csv'),
        steps: readSampleFile('steps.csv'),
        artifacts: readSampleFile('artifacts.csv'),
        evidence: readSampleFile('evidence.csv'),
    });
}

describe('mainframe classification workbook', () => {
    it('classifies selected fields into the executive workbook without breaking the existing export contract', () => {
        const parsed = loadSampleBundle();
        const selectedFields = [
            {
                datasetKey: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                field: 'DEMO-ID',
            },
            {
                datasetKey: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                field: 'DEMO-FIXO',
            },
            {
                datasetKey: 'mainframe://dataset::&&TMPOUT03',
                field: 'DEMO-NULL1',
            },
        ];

        const classification = buildMainframeFieldClassificationRows(parsed, {
            selectedFields,
        });

        expect(classification.scope).toBe('selected_fields');
        expect(classification.summary).toEqual({
            totalCampos: 3,
            totalDiretoOrigem: 1,
            totalHardCode: 1,
            totalGeradoFluxo: 1,
        });

        expect(classification.rowsByCategory.direto_origem).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    dataset: 'APP.ARQ.SAIDA.CBLDB001',
                    campo: 'DEMO-ID',
                    categoria_principal: 'direto_origem',
                    motivo_detalhado: 'copia_identidade',
                    responde_direto_origem: 'Sim',
                    responde_hard_code: 'Nao',
                    responde_gerado_fluxo: 'Nao',
                }),
            ]),
        );

        expect(classification.rowsByCategory.hard_code).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    dataset: 'APP.ARQ.SAIDA.CBLDB001',
                    campo: 'DEMO-FIXO',
                    categoria_principal: 'hard_code',
                    motivo_detalhado: 'hard_code_indireto',
                    responde_hard_code: 'Sim',
                    sinal_hard_code_indireto: 'Sim',
                    origem_dataset_referencia: 'HARD_CODE',
                    origem_campo_referencia: 'FIXO',
                }),
            ]),
        );

        expect(classification.rowsByCategory.gerado_fluxo).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    dataset: '&&TMPOUT03',
                    campo: 'DEMO-NULL1',
                    categoria_principal: 'gerado_fluxo',
                    motivo_detalhado: 'gerado_sem_upstream',
                    responde_gerado_fluxo: 'Sim',
                    observacao: 'Sem upstream resolvido no lineage atual.',
                }),
            ]),
        );
    });

    it('builds a workbook with official sheets and clear file naming metadata', () => {
        const parsed = loadSampleBundle();
        const workbook = buildClassificationWorkbook(parsed, {
            selectedFields: [
                {
                    datasetKey: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                    field: 'DEMO-ID',
                },
                {
                    datasetKey: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                    field: 'DEMO-FIXO',
                },
                {
                    datasetKey: 'mainframe://dataset::&&TMPOUT03',
                    field: 'DEMO-NULL1',
                },
            ],
            now: new Date('2026-04-13T10:00:00.000Z'),
        });

        expect(workbook.fileName).toBe('classificacao_campos_JCLDB001_campos_selecionados_2026-04-13.xlsx');
        expect(workbook.workbook.SheetNames).toEqual([
            'Resumo',
            'Direto origem',
            'Hard code',
            'Gerado fluxo',
        ]);

        const summaryRows = XLSX.utils.sheet_to_json<Record<string, string>>(
            workbook.workbook.Sheets.Resumo,
            { defval: '' },
        );
        expect(summaryRows).toEqual([
            {
                escopo_workbook: 'selected_fields',
                regra_prioridade: 'hard_code > gerado_fluxo > direto_origem',
                total_campos: 3,
                total_direto_origem: 1,
                total_hard_code: 1,
                total_gerado_fluxo: 1,
            },
        ]);

        const hardCodeRows = XLSX.utils.sheet_to_json<Record<string, string>>(
            workbook.workbook.Sheets['Hard code'],
            { defval: '' },
        );
        expect(hardCodeRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    campo: 'DEMO-FIXO',
                    motivo_detalhado: 'hard_code_indireto',
                    transformacao_referencia: 'Constante literal',
                }),
            ]),
        );
    });

    it('keeps the full JCLDB001 didactic sample auditably classified for the three business questions', () => {
        const parsed = loadSampleBundle();
        const selectedFields = readDidacticMatrix().map((row) => ({
            datasetKey: `mainframe://dataset::${row.terminal_entity}`,
            field: row.field_name,
        }));

        const classification = buildMainframeFieldClassificationRows(parsed, {
            selectedFields,
        });

        expect(classification.summary).toEqual({
            totalCampos: 13,
            totalDiretoOrigem: 2,
            totalHardCode: 3,
            totalGeradoFluxo: 8,
        });

        const rowsByField = Object.fromEntries(
            Object.values(classification.rowsByCategory)
                .flat()
                .map((row) => [row.campo, row]),
        );

        expect(rowsByField['DEMO-ID']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'direto_origem',
            motivo_detalhado: 'copia_identidade',
            responde_direto_origem: 'Sim',
            origem_dataset_referencia: 'APP.INPUT1.ORIGINAL',
            origem_campo_referencia: 'DEMO-ID',
        });
        expect(rowsByField['DEMO-ORD']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'direto_origem',
            motivo_detalhado: 'reordenacao_registro',
            responde_direto_origem: 'Sim',
            origem_dataset_referencia: 'APP.INPUT2.ORIGINAL',
            origem_campo_referencia: 'DEMO-ORD',
        });

        expect(rowsByField['DEMO-COND']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'hard_code',
            motivo_detalhado: 'hard_code_indireto',
            responde_hard_code: 'Sim',
            sinal_hard_code_indireto: 'Sim',
            transformacao_referencia: 'Constante condicional',
        });
        expect(rowsByField['DEMO-FIXO']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'hard_code',
            motivo_detalhado: 'hard_code_indireto',
            responde_hard_code: 'Sim',
            sinal_hard_code_indireto: 'Sim',
            origem_dataset_referencia: 'HARD_CODE',
            origem_campo_referencia: 'FIXO',
        });
        expect(rowsByField['DEMO-FILL']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'hard_code',
            motivo_detalhado: 'hard_code_direto',
            responde_hard_code: 'Sim',
            transformacao_referencia: 'Constante condicional',
        });

        expect(rowsByField['DEMO-ENR']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'copia_enriquecimento_registro',
            responde_gerado_fluxo: 'Sim',
        });
        expect(rowsByField['DEMO-LKP']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'busca_valor',
            responde_gerado_fluxo: 'Sim',
            origem_dataset_referencia: 'APPDB.CLIENTE_MOVTO',
            origem_campo_referencia: 'DEMO-LKP',
        });
        expect(rowsByField['DEMO-KEY']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'uso_chave_busca',
            responde_gerado_fluxo: 'Sim',
        });
        expect(rowsByField['DEMO-CALC']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'calculo_derivado',
            responde_gerado_fluxo: 'Sim',
        });
        expect(rowsByField['DEMO-DER']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'derivacao_condicional',
            responde_gerado_fluxo: 'Sim',
        });
        expect(rowsByField['DEMO-RAW']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'transformacao_nao_classificada',
            responde_gerado_fluxo: 'Sim',
        });
        expect(rowsByField['DEMO-NULL1']).toMatchObject({
            dataset: '&&TMPOUT03',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'gerado_sem_upstream',
            responde_gerado_fluxo: 'Sim',
            observacao: 'Sem upstream resolvido no lineage atual.',
        });
        expect(rowsByField['DEMO-NULL2']).toMatchObject({
            dataset: 'APP.ARQ.SAIDA.CBLDB001',
            categoria_principal: 'gerado_fluxo',
            motivo_detalhado: 'gerado_sem_upstream',
            responde_gerado_fluxo: 'Sim',
            observacao: 'Sem upstream resolvido no lineage atual.',
        });

        expect(classification.rowsByCategory.hard_code.map((row) => row.campo)).toEqual([
            'DEMO-COND',
            'DEMO-FILL',
            'DEMO-FIXO',
        ]);
    });
});
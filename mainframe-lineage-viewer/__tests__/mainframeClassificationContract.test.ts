import {
    CLASSIFICATION_WORKBOOK_SHEETS,
    MAINFRAME_CLASSIFICATION_CATEGORY_PRIORITY,
    classifyMainframeField,
    resolveClassificationWorkbookScope,
} from '@/lib/mainframe/classificationWorkbookContract';

describe('classification workbook contract', () => {
    it('defines the category priority used by the workbook', () => {
        expect(MAINFRAME_CLASSIFICATION_CATEGORY_PRIORITY).toEqual([
            'hard_code',
            'gerado_fluxo',
            'direto_origem',
        ]);
    });

    it('prefers selected fields when the user already narrowed the scope', () => {
        expect(resolveClassificationWorkbookScope(2)).toBe('selected_fields');
        expect(resolveClassificationWorkbookScope(0)).toBe('visible_filtered_fields');
    });

    it('classifies identity-preserving lineage as direct origin', () => {
        expect(
            classifyMainframeField({
                lineageStatus: 'resolved',
                directTransformationKeys: ['copia_identidade'],
                upstreamTransformationKeys: ['reordenacao_registro'],
            }),
        ).toMatchObject({
            category: 'direto_origem',
            reason: 'reordenacao_registro',
            answers: {
                diretoOrigem: true,
                hardCode: false,
                geradoFluxo: false,
            },
        });
    });

    it('classifies any direct hard code as hard_code with highest priority', () => {
        expect(
            classifyMainframeField({
                lineageStatus: 'resolved',
                directTransformationKeys: ['constante_literal', 'calculo_derivado'],
                upstreamTransformationKeys: ['copia_identidade'],
            }),
        ).toMatchObject({
            category: 'hard_code',
            reason: 'hard_code_direto',
            answers: {
                diretoOrigem: false,
                hardCode: true,
                geradoFluxo: false,
            },
        });
    });

    it('preserves indirect hard code as a secondary signal even when direct hard code wins the category', () => {
        expect(
            classifyMainframeField({
                lineageStatus: 'resolved',
                directTransformationKeys: ['constante_literal'],
                upstreamTransformationKeys: ['constante_condicional', 'copia_identidade'],
            }),
        ).toMatchObject({
            category: 'hard_code',
            reason: 'hard_code_direto',
            secondarySignals: {
                hasDirectHardCode: true,
                hasIndirectHardCode: true,
            },
        });
    });

    it('classifies upstream hard code as hard_code even when the target is derived later', () => {
        expect(
            classifyMainframeField({
                lineageStatus: 'resolved',
                directTransformationKeys: ['calculo_derivado'],
                upstreamTransformationKeys: ['constante_condicional', 'copia_identidade'],
            }),
        ).toMatchObject({
            category: 'hard_code',
            reason: 'hard_code_indireto',
            answers: {
                diretoOrigem: false,
                hardCode: true,
                geradoFluxo: false,
            },
        });
    });

    it('classifies unresolved fields without upstream as generated inside the flow', () => {
        expect(
            classifyMainframeField({
                lineageStatus: 'unfilled',
                directTransformationKeys: [],
                upstreamTransformationKeys: [],
            }),
        ).toMatchObject({
            category: 'gerado_fluxo',
            reason: 'gerado_sem_upstream',
            answers: {
                diretoOrigem: false,
                hardCode: false,
                geradoFluxo: true,
            },
        });
    });

    it('classifies non-identity transformations without hard code as generated inside the flow', () => {
        expect(
            classifyMainframeField({
                lineageStatus: 'resolved',
                directTransformationKeys: ['busca_valor'],
                upstreamTransformationKeys: ['uso_chave_busca'],
            }),
        ).toMatchObject({
            category: 'gerado_fluxo',
            reason: 'busca_valor',
            answers: {
                diretoOrigem: false,
                hardCode: false,
                geradoFluxo: true,
            },
        });
    });

    it('defines workbook sheets and visible columns for the executive export', () => {
        expect(CLASSIFICATION_WORKBOOK_SHEETS).toEqual([
            {
                key: 'resumo',
                name: 'Resumo',
                columns: [
                    'escopo_workbook',
                    'regra_prioridade',
                    'total_campos',
                    'total_direto_origem',
                    'total_hard_code',
                    'total_gerado_fluxo',
                ],
            },
            {
                key: 'direto_origem',
                name: 'Direto origem',
                columns: [
                    'dataset',
                    'campo',
                    'categoria_principal',
                    'motivo_detalhado',
                    'responde_direto_origem',
                    'responde_hard_code',
                    'responde_gerado_fluxo',
                    'sinal_hard_code_indireto',
                    'transformacao_referencia',
                    'origem_dataset_referencia',
                    'origem_campo_referencia',
                    'step_referencia',
                    'observacao',
                ],
            },
            {
                key: 'hard_code',
                name: 'Hard code',
                columns: [
                    'dataset',
                    'campo',
                    'categoria_principal',
                    'motivo_detalhado',
                    'responde_direto_origem',
                    'responde_hard_code',
                    'responde_gerado_fluxo',
                    'sinal_hard_code_indireto',
                    'transformacao_referencia',
                    'origem_dataset_referencia',
                    'origem_campo_referencia',
                    'step_referencia',
                    'observacao',
                ],
            },
            {
                key: 'gerado_fluxo',
                name: 'Gerado fluxo',
                columns: [
                    'dataset',
                    'campo',
                    'categoria_principal',
                    'motivo_detalhado',
                    'responde_direto_origem',
                    'responde_hard_code',
                    'responde_gerado_fluxo',
                    'sinal_hard_code_indireto',
                    'transformacao_referencia',
                    'origem_dataset_referencia',
                    'origem_campo_referencia',
                    'step_referencia',
                    'observacao',
                ],
            },
        ]);
    });
});
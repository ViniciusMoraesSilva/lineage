import fs from 'node:fs';
import path from 'node:path';

import { computeColumnFieldLineageStatus } from '../src/lib/columnFieldLineage';
import { parseCanonicalBundle } from '../src/lib/mainframe/parseCanonicalBundle';
import type { ParsedLineage } from '../src/lib/types';

function makeLineage(): ParsedLineage {
    return {
        events: [],
        jobs: [],
        datasets: [
            {
                name: 'table_a',
                namespace: 'file',
                shortName: 'table_a',
                role: 'source',
                schema: [
                    { name: 'id', type: 'integer' },
                ],
            },
            {
                name: 'table_b',
                namespace: 'file',
                shortName: 'table_b',
                role: 'intermediate',
                schema: [
                    { name: 'id', type: 'integer' },
                    { name: 'ghost_flag', type: 'string' },
                ],
            },
            {
                name: 'table_c',
                namespace: 'file',
                shortName: 'table_c',
                role: 'intermediate',
                schema: [
                    { name: 'ghost_flag', type: 'string' },
                ],
            },
            {
                name: 'table_d',
                namespace: 'file',
                shortName: 'table_d',
                role: 'target',
                schema: [
                    { name: 'ghost_flag', type: 'string' },
                ],
            },
            {
                name: 'table_ref',
                namespace: 'file',
                shortName: 'table_ref',
                role: 'source',
                schema: [
                    { name: 'real_flag', type: 'string' },
                ],
            },
        ],
        columnLineageEdges: [
            {
                sourceDataset: 'file::table_a',
                sourceField: 'id',
                targetDataset: 'file::table_b',
                targetField: 'id',
                transformationType: 'DIRECT',
                transformationSubtype: 'IDENTITY',
            },
            {
                sourceDataset: 'file::table_b',
                sourceField: 'ghost_flag',
                targetDataset: 'file::table_c',
                targetField: 'ghost_flag',
                transformationType: 'DIRECT',
                transformationSubtype: 'IDENTITY',
            },
            {
                sourceDataset: 'file::table_c',
                sourceField: 'ghost_flag',
                targetDataset: 'file::table_d',
                targetField: 'ghost_flag',
                transformationType: 'DIRECT',
                transformationSubtype: 'IDENTITY',
            },
            {
                sourceDataset: 'file::table_ref',
                sourceField: 'real_flag',
                targetDataset: 'file::table_d',
                targetField: 'ghost_flag',
                transformationType: 'LOOKUP',
                transformationSubtype: 'TRANSFORMATION',
            },
        ],
        tableLineageEdges: [],
        stats: {
            totalEvents: 0,
            totalJobs: 0,
            totalDatasets: 5,
            columnLineageCount: 4,
            startEvents: 0,
            completeEvents: 0,
        },
    };
}

function readSampleFile(fileName: string): string {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'mainframe-sample', fileName), 'utf8');
}

describe('computeColumnFieldLineageStatus', () => {
    it('marks locally created fields as unfilled and propagates until a real upstream overwrites them', () => {
        const statuses = computeColumnFieldLineageStatus(makeLineage());

        expect(statuses['file::table_a::id']).toBe('resolved');
        expect(statuses['file::table_b::id']).toBe('resolved');
        expect(statuses['file::table_b::ghost_flag']).toBe('unfilled');
        expect(statuses['file::table_c::ghost_flag']).toBe('unfilled');
        expect(statuses['file::table_d::ghost_flag']).toBe('resolved');
    });

    it('keeps source-only schema fields as resolved', () => {
        const statuses = computeColumnFieldLineageStatus(makeLineage());

        expect(statuses['file::table_ref::real_flag']).toBe('resolved');
    });

    it('keeps propagating unfilled fields even when merged bundles leave the dataset role as source', () => {
        const lineage = makeLineage();
        lineage.datasets = lineage.datasets.map((dataset) => (
            dataset.name === 'table_b' || dataset.name === 'table_c'
                ? { ...dataset, role: 'source' }
                : dataset
        ));

        const statuses = computeColumnFieldLineageStatus(lineage);

        expect(statuses['file::table_b::ghost_flag']).toBe('unfilled');
        expect(statuses['file::table_c::ghost_flag']).toBe('unfilled');
        expect(statuses['file::table_d::ghost_flag']).toBe('resolved');
    });

    it('keeps the public JCLDB001 sample null trail aligned with DEMO-NULL1, DEMO-NULL2 and DEMO-FILL', () => {
        const parsed = parseCanonicalBundle({
            entities: readSampleFile('entities.csv'),
            entityColumns: readSampleFile('entity_columns.csv'),
            columnMappings: readSampleFile('column_mappings.csv'),
            transformRules: readSampleFile('transform_rules.csv'),
            steps: readSampleFile('steps.csv'),
            artifacts: readSampleFile('artifacts.csv'),
            evidence: readSampleFile('evidence.csv'),
        });
        const statuses = computeColumnFieldLineageStatus(parsed);

        expect(statuses['mainframe://dataset::&&TMPOUT03::DEMO-NULL1']).toBe('unfilled');
        expect(statuses['mainframe://dataset::&&TMPOUT03::DEMO-NULL2']).toBe('unfilled');
        expect(statuses['mainframe://dataset::&&TMPOUT03::DEMO-FILL']).toBe('unfilled');
        expect(statuses['mainframe://dataset::APP.ARQ.SAIDA.CBLDB001::DEMO-NULL2']).toBe('unfilled');
        expect(statuses['mainframe://dataset::APP.ARQ.SAIDA.CBLDB001::DEMO-FILL']).toBe('resolved');

        expect(parsed.columnLineageEdges).toEqual(
            expect.not.arrayContaining([
                expect.objectContaining({
                    targetDataset: 'mainframe://dataset::&&TMPOUT03',
                    targetField: 'DEMO-NULL1',
                }),
            ]),
        );

        expect(parsed.columnLineageEdges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sourceDataset: 'mainframe://dataset::&&TMPOUT03',
                    sourceField: 'DEMO-NULL2',
                    targetDataset: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                    targetField: 'DEMO-NULL2',
                    transformationType: 'move',
                    transformationSubtype: 'copia_identidade',
                }),
                expect.objectContaining({
                    sourceDataset: 'mainframe://dataset::&&TMPOUT03',
                    sourceField: 'DEMO-FILL',
                    targetDataset: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                    targetField: 'DEMO-FILL',
                    transformationType: 'move',
                    transformationSubtype: 'copia_identidade',
                }),
                expect.objectContaining({
                    sourceDataset: 'mainframe://hardcode::HARD_CODE',
                    targetDataset: 'mainframe://dataset::APP.ARQ.SAIDA.CBLDB001',
                    targetField: 'DEMO-FILL',
                    transformationType: 'conditional',
                    transformationSubtype: 'constante_condicional',
                }),
            ]),
        );

        expect(parsed.fieldRules?.['mainframe://dataset::&&TMPOUT03::DEMO-NULL1']).toBeUndefined();
        expect(parsed.fieldRules?.['mainframe://dataset::APP.ARQ.SAIDA.CBLDB001::DEMO-NULL2']).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ruleId: 'R052',
                    ruleType: 'move',
                    ruleSubtype: 'copia_identidade',
                }),
            ]),
        );
        expect(parsed.fieldRules?.['mainframe://dataset::APP.ARQ.SAIDA.CBLDB001::DEMO-FILL']).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ruleId: 'R053',
                    ruleType: 'move',
                    ruleSubtype: 'copia_identidade',
                }),
                expect.objectContaining({
                    ruleId: 'R054',
                    ruleType: 'conditional',
                    ruleSubtype: 'constante_condicional',
                }),
            ]),
        );
    });
});
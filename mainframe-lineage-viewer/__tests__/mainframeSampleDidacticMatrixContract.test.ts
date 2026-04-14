import fs from 'node:fs';
import path from 'node:path';

type CsvRow = Record<string, string>;

const repoRoot = path.resolve(process.cwd(), '..');
const generatedBundleDir = path.join(
    repoRoot,
    'generated',
    'mainframe-extractor',
    'JCLDB001',
    'importar',
);
const didacticMatrixPath = path.join(
    repoRoot,
    'docs',
    'plan',
    'mainframe-sample-jcldb001-taxonomia-completa',
    'didactic-matrix.csv',
);

const expectedTaxonomySubtypes = new Set([
    'copia_identidade',
    'reordenacao_registro',
    'copia_enriquecimento_registro',
    'busca_valor',
    'uso_chave_busca',
    'calculo_derivado',
    'derivacao_condicional',
    'constante_condicional',
    'constante_literal',
    'nao_classificada',
]);

const expectedNullStatuses = new Set(['sem_upstream', 'propagado', 'resolvido']);
const expectedDidacticFields = [
    'DEMO-ID',
    'DEMO-ORD',
    'DEMO-ENR',
    'DEMO-LKP',
    'DEMO-KEY',
    'DEMO-CALC',
    'DEMO-DER',
    'DEMO-COND',
    'DEMO-FIXO',
    'DEMO-RAW',
    'DEMO-NULL1',
    'DEMO-NULL2',
    'DEMO-FILL',
];

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

function readDidacticMatrix(): { headers: string[]; rows: CsvRow[] } {
    const text = fs.readFileSync(didacticMatrixPath, 'utf8').trim();
    const lines = text.split(/\r?\n/);
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });

    return { headers, rows };
}

function readBundleCsv(fileName: string): CsvRow[] {
    const text = fs.readFileSync(path.join(generatedBundleDir, fileName), 'utf8').trim();
    const lines = text.split(/\r?\n/);
    const headers = parseCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });
}

describe('didactic matrix contract for JCLDB001 taxonomy sample', () => {
    it('keeps taxonomy rule_subtype exclusive to the 10 standardized viewer subtypes', () => {
        const { headers, rows } = readDidacticMatrix();

        expect(headers).toContain('null_status');

        const taxonomyRows = rows.filter((row) => row.track === 'taxonomy');
        const nullRows = rows.filter((row) => row.track === 'null');

        expect(rows).toHaveLength(13);
        expect(taxonomyRows).toHaveLength(10);
        expect(nullRows).toHaveLength(3);

        expect(rows.map((row) => row.field_name)).toEqual(expectedDidacticFields);

        expect(new Set(taxonomyRows.map((row) => row.rule_subtype))).toEqual(expectedTaxonomySubtypes);
        expect(taxonomyRows.every((row) => row.null_status === '')).toBe(true);

        expect(nullRows.every((row) => row.rule_subtype === '')).toBe(true);
        expect(new Set(nullRows.map((row) => row.null_status))).toEqual(expectedNullStatuses);
    });

    it('materializes the didactic matrix in the canonical generated bundle', () => {
        const { rows } = readDidacticMatrix();
        const entities = readBundleCsv('entities.csv');
        const entityColumns = readBundleCsv('entity_columns.csv');
        const columnMappings = readBundleCsv('column_mappings.csv');
        const transformRules = readBundleCsv('transform_rules.csv');

        const entityNameToId = new Map(
            entities.map((row) => [row.entity_name, row.entity_id]),
        );

        expect(entityColumns.some((row) => row.column_name === 'DEMO-FILL')).toBe(true);
        expect(columnMappings.some((row) => row.target_column_name === 'DEMO-FILL')).toBe(true);
        expect(transformRules.some((row) => row.target_column_name === 'DEMO-FILL')).toBe(true);

        rows.forEach((row) => {
            const pathEntities = row.required_path === 'sem_upstream'
                ? [row.birth_entity]
                : row.required_path.split(' > ');

            pathEntities.forEach((entityName) => {
                const entityId = entityNameToId.get(entityName);

                expect(entityId).toBeTruthy();
                expect(
                    entityColumns.some(
                        (column) => column.entity_id === entityId && column.column_name === row.field_name,
                    ),
                ).toBe(true);
            });

            if (row.required_path !== 'sem_upstream') {
                for (let index = 0; index < pathEntities.length - 1; index += 1) {
                    const sourceEntityId = entityNameToId.get(pathEntities[index]);
                    const targetEntityId = entityNameToId.get(pathEntities[index + 1]);

                    expect(
                        columnMappings.some(
                            (mapping) => (
                                mapping.source_entity_id === sourceEntityId &&
                                mapping.target_entity_id === targetEntityId &&
                                mapping.source_column_name === row.field_name &&
                                mapping.target_column_name === row.field_name
                            ),
                        ),
                    ).toBe(true);
                }
            }

            if (row.track === 'taxonomy') {
                expect(
                    transformRules.some(
                        (rule) => (
                            rule.target_column_name === row.field_name &&
                            rule.rule_subtype === row.rule_subtype
                        ),
                    ),
                ).toBe(true);
            } else {
                const relevantRules = transformRules.filter((rule) => rule.target_column_name === row.field_name);
                expect(relevantRules.every((rule) => expectedTaxonomySubtypes.has(rule.rule_subtype))).toBe(true);
            }
        });

        expect(columnMappings.some((mapping) => mapping.target_column_name === 'DEMO-NULL1')).toBe(false);
        expect(transformRules.some((rule) => rule.target_column_name === 'DEMO-NULL1')).toBe(false);
    });
});
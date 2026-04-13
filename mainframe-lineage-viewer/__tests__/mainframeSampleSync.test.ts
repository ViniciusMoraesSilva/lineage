import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');

const syncTargets = [
    'entity_columns.csv',
    'column_mappings.csv',
    'transform_rules.csv',
] as const;

describe('public mainframe sample sync', () => {
    it.each(syncTargets)('keeps %s identical to the canonical JCLDB001 bundle', (fileName) => {
        const canonicalPath = path.join(repoRoot, 'generated', 'mainframe-extractor', 'JCLDB001', 'importar', fileName);
        const publicPath = path.join(process.cwd(), 'public', 'mainframe-sample', fileName);

        const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');
        const publicContent = fs.readFileSync(publicPath, 'utf8');

        expect(publicContent).toBe(canonicalContent);
    });
});
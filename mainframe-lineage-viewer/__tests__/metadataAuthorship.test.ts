import fs from 'node:fs';
import path from 'node:path';

describe('metadata authorship', () => {
  const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  it('keeps the product title and registers Vinicius Moraes as the author', () => {
    const layoutSource = fs.readFileSync(layoutPath, 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { author?: string };

    expect(layoutSource).toMatch(/title:\s*'Mainframe Lineage Viewer'/);
    expect(layoutSource).toMatch(/authors:\s*\[[\s\S]*name:\s*'Vinicius Moraes'/);
    expect(layoutSource).toMatch(/creator:\s*'Vinicius Moraes'/);
    expect(layoutSource).not.toMatch(/monstro/i);
    expect(packageJson.author).toBe('Vinicius Moraes');
  });
});
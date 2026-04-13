const { test } = require('playwright/test');
const fs = require('fs');

test('visual check mainframe long dataset headers', async ({ page }) => {
    const outDir = '/tmp/mainframe-visual-check';
    fs.mkdirSync(outDir, { recursive: true });
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
        failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`);
    });

    await page.setViewportSize({ width: 1800, height: 2200 });
    await page.goto('http://127.0.0.1:4173/mainframe/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const sampleButton = page.getByRole('button', { name: /Carregar amostra JCLDB001/i });
    if (await sampleButton.isVisible().catch(() => false)) {
        await sampleButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
    }

    const tableSection = page.locator('[data-export-target="table-lineage"]');
    const columnSection = page.locator('[data-export-target="column-lineage"]');
    await tableSection.waitFor({ state: 'visible' });
    await columnSection.waitFor({ state: 'visible' });

    const zoomInButtons = page.locator('button[aria-label="zoom in"]');
    for (let i = 0; i < await zoomInButtons.count(); i += 1) {
        for (let j = 0; j < 3; j += 1) {
            await zoomInButtons.nth(i).click();
            await page.waitForTimeout(150);
        }
    }

    await tableSection.screenshot({ path: `${outDir}/table-zoomed.png` });
    await columnSection.screenshot({ path: `${outDir}/column-zoomed.png` });

    const data = await page.evaluate(() => {
        function getSection(key) {
            return document.querySelector(`[data-export-target="${key}"]`);
        }
        function inspect(key) {
            const section = getSection(key);
            const nodes = Array.from(section.querySelectorAll('.react-flow__node'));
            return nodes.map((node) => {
                const texts = Array.from(node.querySelectorAll('div[title]')).map((el) => ({
                    title: el.getAttribute('title') || '',
                    text: (el.textContent || '').trim(),
                    rect: el.getBoundingClientRect().toJSON(),
                }));
                const buttons = Array.from(node.querySelectorAll('button')).map((el) => ({
                    text: (el.textContent || '').trim(),
                    rect: el.getBoundingClientRect().toJSON(),
                }));
                return {
                    nodeRect: node.getBoundingClientRect().toJSON(),
                    texts,
                    buttons,
                    maxTitleLength: texts.reduce((max, item) => Math.max(max, item.title.length), 0),
                };
            });
        }
        return { table: inspect('table-lineage'), column: inspect('column-lineage') };
    });

    const topTable = data.table
        .map((node, index) => ({ index, maxTitleLength: node.maxTitleLength }))
        .sort((a, b) => b.maxTitleLength - a.maxTitleLength)
        .slice(0, 3);
    const topColumn = data.column
        .map((node, index) => ({ index, maxTitleLength: node.maxTitleLength }))
        .sort((a, b) => b.maxTitleLength - a.maxTitleLength)
        .slice(0, 3);

    for (const item of topTable) {
        await tableSection.locator('.react-flow__node').nth(item.index).screenshot({ path: `${outDir}/table-node-${item.index}.png` });
    }
    for (const item of topColumn) {
        await columnSection.locator('.react-flow__node').nth(item.index).screenshot({ path: `${outDir}/column-node-${item.index}.png` });
    }

    const report = { consoleErrors, failedRequests, data, topTable, topColumn };
    fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
});

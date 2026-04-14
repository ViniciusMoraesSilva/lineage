const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const outDir = '/tmp/mainframe-fullscreen-validation-artifacts';
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const consoleErrors = [];
    const networkFailures = [];
    const validations = [];
    const findings = [];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    page.on('pageerror', (error) => {
        consoleErrors.push(`pageerror: ${error.message}`);
    });

    page.on('requestfailed', (req) => {
        networkFailures.push({
            type: 'requestfailed',
            url: req.url(),
            method: req.method(),
            error: req.failure()?.errorText || 'unknown',
        });
    });

    page.on('response', (res) => {
        if (res.status() >= 400) {
            networkFailures.push({
                type: 'http',
                url: res.url(),
                method: res.request().method(),
                status: res.status(),
            });
        }
    });

    async function panelMetrics(selector) {
        return page.evaluate((sel) => {
            const section = document.querySelector(sel);
            const panel = section?.querySelector(':scope > div:nth-of-type(2)');
            const graph = panel?.querySelector('.react-flow');
            const rect = panel?.getBoundingClientRect();
            const graphRect = graph?.getBoundingClientRect();

            return {
                fullscreen: !!document.fullscreenElement,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                panel: rect ? { width: rect.width, height: rect.height, x: rect.x, y: rect.y } : null,
                graph: graphRect ? { width: graphRect.width, height: graphRect.height, x: graphRect.x, y: graphRect.y } : null,
            };
        }, selector);
    }

    async function shot(selector, name) {
        const panel = page.locator(selector).locator(':scope > div').nth(1);
        const file = path.join(outDir, name);
        await panel.screenshot({ path: file });
        return file;
    }

    async function viewportTransform(section) {
        return section.locator('.react-flow__viewport').evaluate((node) => node.getAttribute('style') || '');
    }

    async function loadSample() {
        await page.goto('http://127.0.0.1:4173/mainframe/', { waitUntil: 'networkidle' });

        const sampleButton = page.getByRole('button', { name: /Carregar amostra JCLDB001/i });
        if (await sampleButton.isVisible().catch(() => false)) {
            await sampleButton.click();
            await page.waitForLoadState('networkidle');
            await delay(1500);
        }

        await page.locator('[data-export-target="table-lineage"]').waitFor({ state: 'visible' });
        await page.locator('[data-export-target="column-lineage"]').waitFor({ state: 'visible' });
    }

    async function validateTable() {
        const section = page.locator('[data-export-target="table-lineage"]');
        const panel = section.locator(':scope > div').nth(1);
        const fsButton = panel.getByRole('button', { name: /^Tela cheia$|^Sair da tela cheia$/i }).first();
        const resetButton = panel.getByRole('button', { name: /Resetar layout/i }).first();
        const zoomInButton = panel.locator('button[aria-label="Zoom In"]').first();

        const before = await panelMetrics('[data-export-target="table-lineage"]');
        const beforeTransform = await viewportTransform(section);
        const beforeShot = await shot('[data-export-target="table-lineage"]', 'table-before.png');

        await fsButton.click();
        await delay(800);
        const during = await panelMetrics('[data-export-target="table-lineage"]');
        const duringShot = await shot('[data-export-target="table-lineage"]', 'table-fullscreen.png');

        await zoomInButton.click();
        await delay(250);
        const zoomAfter = await viewportTransform(section);

        await resetButton.click();
        await delay(300);

        const exitButton = panel.getByRole('button', { name: /Sair da tela cheia/i }).first();
        await exitButton.click();
        await delay(800);
        const afterButtonExit = await panelMetrics('[data-export-target="table-lineage"]');

        await fsButton.click();
        await delay(800);
        await page.keyboard.press('Escape');
        await delay(800);
        const afterEsc = await panelMetrics('[data-export-target="table-lineage"]');

        validations.push({
            view: 'Table-Level Lineage',
            fullscreenButtonVisible: await fsButton.isVisible(),
            enteredFullscreen: !!during.fullscreen,
            panelExpanded: {
                widthGain: during.panel.width - before.panel.width,
                heightGain: during.panel.height - before.panel.height,
                before: before.panel,
                during: during.panel,
            },
            graphExpanded: {
                widthGain: during.graph.width - before.graph.width,
                heightGain: during.graph.height - before.graph.height,
                before: before.graph,
                during: during.graph,
            },
            resetPresent: await resetButton.isVisible(),
            zoomPresent: await zoomInButton.isVisible(),
            zoomChangedViewport: beforeTransform !== zoomAfter,
            exitByButton: afterButtonExit.fullscreen === false,
            exitByEscAutomated: afterEsc.fullscreen === false,
            evidence: [beforeShot, duringShot],
        });

        if (!(during.panel.height >= before.panel.height + 300 && during.panel.y === 0 && during.panel.height >= during.viewport.height - 4)) {
            findings.push({
                view: 'Table-Level Lineage',
                severity: 'error',
                detail: 'Entrada em fullscreen sem ampliacao material do painel.',
            });
        }

        if (beforeTransform === zoomAfter) {
            findings.push({
                view: 'Table-Level Lineage',
                severity: 'error',
                detail: 'Controle de zoom nao alterou o viewport do React Flow.',
            });
        }

        if (afterButtonExit.fullscreen !== false) {
            findings.push({
                view: 'Table-Level Lineage',
                severity: 'error',
                detail: 'Saida por botao nao encerrou fullscreen.',
            });
        }

        if (afterEsc.fullscreen !== false) {
            findings.push({
                view: 'Table-Level Lineage',
                severity: 'warning',
                detail: 'Tentativa automatizada com ESC nao encerrou fullscreen; provavel limitacao do ambiente de automacao.',
            });
            await page.evaluate(() => document.exitFullscreen && document.exitFullscreen());
            await delay(500);
        }
    }

    async function validateColumn() {
        const section = page.locator('[data-export-target="column-lineage"]');
        const panel = section.locator(':scope > div').nth(1);
        const fsButton = panel.getByRole('button', { name: /^Tela cheia$|^Sair da tela cheia$/i }).first();
        const resetButton = panel.getByRole('button', { name: /Resetar layout/i }).first();
        const zoomInButton = panel.locator('button[aria-label="Zoom In"]').first();
        const transformationSelect = panel.locator('select').first();
        const chipInput = panel.getByPlaceholder(/Rastrear linhagem da coluna|Mais colunas/i).first();
        const searchInput = panel.getByPlaceholder(/Buscar e realçar coluna/i).first();

        const before = await panelMetrics('[data-export-target="column-lineage"]');
        const beforeShot = await shot('[data-export-target="column-lineage"]', 'column-before.png');

        await fsButton.click();
        await delay(800);
        const during = await panelMetrics('[data-export-target="column-lineage"]');

        let selectedValue = await transformationSelect.inputValue();

        await chipInput.fill('OUT');
        await chipInput.press('Enter');
        await delay(250);
        const chipVisible = await panel.getByText('OUT', { exact: false }).first().isVisible().catch(() => false);

        const zoomBefore = await viewportTransform(section);
        await zoomInButton.click();
        await delay(250);
        const zoomAfter = await viewportTransform(section);
        const duringShot = await shot('[data-export-target="column-lineage"]', 'column-fullscreen.png');

        const visibleNodeCount = await panel.locator('.react-flow__node:visible').count();

        const exitButton = panel.getByRole('button', { name: /Sair da tela cheia/i }).first();
        await exitButton.click();
        await delay(800);
        const afterButtonExit = await panelMetrics('[data-export-target="column-lineage"]');

        await fsButton.click();
        await delay(800);
        await page.keyboard.press('Escape');
        await delay(800);
        const afterEsc = await panelMetrics('[data-export-target="column-lineage"]');

        validations.push({
            view: 'Column-Level Lineage',
            fullscreenButtonVisible: await fsButton.isVisible(),
            enteredFullscreen: !!during.fullscreen,
            panelExpanded: {
                widthGain: during.panel.width - before.panel.width,
                heightGain: during.panel.height - before.panel.height,
                before: before.panel,
                during: during.panel,
            },
            graphExpanded: {
                widthGain: during.graph.width - before.graph.width,
                heightGain: during.graph.height - before.graph.height,
                before: before.graph,
                during: during.graph,
            },
            filtersInFullscreen: {
                selectVisible: await transformationSelect.isVisible(),
                chipInputVisible: await chipInput.isVisible(),
                searchVisible: await searchInput.isVisible(),
                chipCreated: chipVisible,
                selectedTransformation: selectedValue,
            },
            graphVisibleInFullscreen: visibleNodeCount > 0,
            visibleNodeCount,
            resetPresent: await resetButton.isVisible(),
            zoomPresent: await zoomInButton.isVisible(),
            zoomChangedViewport: zoomBefore !== zoomAfter,
            exitByButton: afterButtonExit.fullscreen === false,
            exitByEscAutomated: afterEsc.fullscreen === false,
            evidence: [beforeShot, duringShot],
        });

        if (!(during.panel.height >= before.panel.height + 250 && during.panel.y === 0 && during.panel.height >= during.viewport.height - 4)) {
            findings.push({
                view: 'Column-Level Lineage',
                severity: 'error',
                detail: 'Entrada em fullscreen sem ampliacao material do painel.',
            });
        }

        if (!chipVisible) {
            findings.push({
                view: 'Column-Level Lineage',
                severity: 'error',
                detail: 'Chip de coluna nao ficou acessivel em fullscreen.',
            });
        }

        if (visibleNodeCount === 0) {
            findings.push({
                view: 'Column-Level Lineage',
                severity: 'error',
                detail: 'Fullscreen exibiu os filtros, mas deixou o grafo sem nos visiveis no mesmo escopo.',
            });
        }

        if (zoomBefore === zoomAfter) {
            findings.push({
                view: 'Column-Level Lineage',
                severity: 'error',
                detail: 'Controle de zoom nao alterou o viewport do React Flow.',
            });
        }

        if (afterButtonExit.fullscreen !== false) {
            findings.push({
                view: 'Column-Level Lineage',
                severity: 'error',
                detail: 'Saida por botao nao encerrou fullscreen.',
            });
        }

        if (afterEsc.fullscreen !== false) {
            findings.push({
                view: 'Column-Level Lineage',
                severity: 'warning',
                detail: 'Tentativa automatizada com ESC nao encerrou fullscreen; provavel limitacao do ambiente de automacao.',
            });
            await page.evaluate(() => document.exitFullscreen && document.exitFullscreen());
            await delay(500);
        }
    }

    try {
        await loadSample();
        await validateTable();
        await validateColumn();
    } catch (error) {
        findings.push({
            view: 'test-runner',
            severity: 'error',
            detail: error.message,
        });
    } finally {
        await browser.close();
    }

    const result = { outDir, consoleErrors, networkFailures, validations, findings };
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
})();
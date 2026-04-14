const { chromium } = require('playwright');

const subtypeExpectations = [
    ['copia_identidade', 'Copia de identidade', 'DEMO-ID'],
    ['reordenacao_registro', 'Reordenacao de registro', 'DEMO-ORD'],
    ['copia_enriquecimento_registro', 'Copia com enriquecimento', 'DEMO-ENR'],
    ['busca_valor', 'Busca de valor', 'DEMO-LKP'],
    ['uso_chave_busca', 'Uso de chave de busca', 'DEMO-KEY'],
    ['calculo_derivado', 'Calculo derivado', 'DEMO-CALC'],
    ['derivacao_condicional', 'Derivacao condicional', 'DEMO-DER'],
    ['constante_condicional', 'Constante condicional', 'DEMO-COND'],
    ['constante_literal', 'Constante literal', 'DEMO-FIXO'],
    ['nao_classificada', 'Transformacao nao classificada', 'DEMO-RAW'],
];

function unique(values) {
    return Array.from(new Set(values));
}

async function inspectField(page, datasetLabel, fieldName) {
    return page.evaluate(({ datasetLabel, fieldName }) => {
        const section = document.querySelector('[data-export-target="column-lineage"]');
        const cards = Array.from(section.querySelectorAll('div')).filter(
            (element) => element instanceof HTMLDivElement && element.style.width === '360px',
        );
        const card = cards.find((element) =>
            (element.innerText || '')
                .split('\n')
                .map((line) => line.trim())
                .includes(datasetLabel),
        );

        if (!card) {
            return { datasetLabel, fieldName, found: false, reason: 'card-not-found' };
        }

        const span = Array.from(card.querySelectorAll('span')).find(
            (element) => (element.textContent || '').trim() === fieldName,
        );

        if (!span) {
            return { datasetLabel, fieldName, found: false, reason: 'span-not-found' };
        }

        const row = span.parentElement;
        if (!row) {
            return { datasetLabel, fieldName, found: false, reason: 'row-not-found' };
        }

        const style = getComputedStyle(row);
        return {
            datasetLabel,
            fieldName,
            found: true,
            rowText: row.innerText,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderLeft: style.borderLeft,
            nullBadge: Array.from(row.querySelectorAll('span')).some(
                (node) => (node.textContent || '').trim().toLowerCase() === 'null',
            ),
        };
    }, { datasetLabel, fieldName });
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } });
    const consoleErrors = [];
    const networkFailures = [];

    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        consoleErrors.push(`pageerror: ${error.message}`);
    });
    page.on('response', (response) => {
        if (response.status() >= 400) {
            networkFailures.push(`${response.status()} ${response.url()}`);
        }
    });

    try {
        await page.goto('http://127.0.0.1:4173/mainframe/', {
            waitUntil: 'networkidle',
            timeout: 30000,
        });
        await page.getByRole('button', { name: /Carregar amostra JCLDB001/i }).click();
        await page.waitForTimeout(2500);

        const section = page.locator('[data-export-target="column-lineage"]');
        const filterSelect = section.locator('select').first();
        const filterOptions = await filterSelect.locator('option').evaluateAll((options) =>
            options.map((option) => ({
                value: option.value,
                label: (option.textContent || '').trim(),
            })),
        );

        const validations = [];

        for (const [value, label, expectedField] of subtypeExpectations) {
            await filterSelect.selectOption(value);
            await page.waitForTimeout(700);

            const sectionText = await section.innerText();
            const visibleDemoFields = unique((sectionText.match(/DEMO-[A-Z0-9]+/g) || []).sort());

            validations.push({
                type: 'subtype-filter',
                subtype: value,
                label,
                expected_field: expectedField,
                passed: visibleDemoFields.includes(expectedField),
                visible_demo_fields: visibleDemoFields,
            });
        }

        await filterSelect.selectOption('');
        await page.waitForTimeout(500);

        const tmpout03Null1 = await inspectField(page, '&&TMPOUT03', 'DEMO-NULL1');
        const tmpout03Null2 = await inspectField(page, '&&TMPOUT03', 'DEMO-NULL2');
        const tmpout03Fill = await inspectField(page, '&&TMPOUT03', 'DEMO-FILL');
        const finalNull2 = await inspectField(page, 'APP.ARQ.SAIDA.CBLDB001', 'DEMO-NULL2');
        const finalFill = await inspectField(page, 'APP.ARQ.SAIDA.CBLDB001', 'DEMO-FILL');

        validations.push({
            type: 'null-trail',
            scenario: 'DEMO-NULL1 sem upstream em &&TMPOUT03',
            passed: Boolean(tmpout03Null1.found && tmpout03Null1.nullBadge),
            evidence: tmpout03Null1,
        });
        validations.push({
            type: 'null-trail',
            scenario: 'DEMO-NULL2 permanece unfilled ate a saida final',
            passed: Boolean(
                tmpout03Null2.found &&
                tmpout03Null2.nullBadge &&
                finalNull2.found &&
                finalNull2.nullBadge
            ),
            evidence: {
                source: tmpout03Null2,
                target: finalNull2,
            },
        });
        validations.push({
            type: 'null-trail',
            scenario: 'DEMO-FILL progride de unfilled para resolved na saida final',
            passed: Boolean(
                tmpout03Fill.found &&
                tmpout03Fill.nullBadge &&
                finalFill.found &&
                !finalFill.nullBadge &&
                finalFill.backgroundColor === 'rgba(0, 120, 212, 0.08)'
            ),
            evidence: {
                source: tmpout03Fill,
                target: finalFill,
            },
        });

        const failedValidations = validations.filter((validation) => !validation.passed);

        console.log(JSON.stringify({
            status: failedValidations.length === 0 ? 'completed' : 'needs_revision',
            task_id: 'T6',
            summary:
                failedValidations.length === 0
                    ? 'T6 reexecutada em 4173 com a amostra JCLDB001 carregando corretamente; os 10 subtipos ficaram recuperaveis pelo filtro no Column-Level e a trilha DEMO-NULL1/DEMO-NULL2/DEMO-FILL exibiu a progressao visual esperada.'
                    : 'A reexecucao da T6 encontrou divergencias visuais na taxonomia filtrada ou na trilha null/unfilled da amostra JCLDB001.',
            validation: {
                url: 'http://127.0.0.1:4173/mainframe/',
                sample_loaded: true,
                filter_options: filterOptions,
                validations,
            },
            details: {
                console_error_count: consoleErrors.length,
                console_errors: consoleErrors,
                network_failure_count: unique(networkFailures).length,
                network_failures: unique(networkFailures),
            },
        }, null, 2));
    } catch (error) {
        console.log(JSON.stringify({
            status: 'failed',
            task_id: 'T6',
            summary: 'A reexecucao da T6 falhou antes de concluir a validacao browser-based da amostra JCLDB001 em 4173.',
            failure_type: 'transient',
            validation: {
                url: 'http://127.0.0.1:4173/mainframe/',
                sample_loaded: false,
            },
            details: {
                error: error instanceof Error ? error.message : String(error),
                console_error_count: consoleErrors.length,
                console_errors: consoleErrors,
                network_failure_count: unique(networkFailures).length,
                network_failures: unique(networkFailures),
            },
        }, null, 2));
    } finally {
        await browser.close();
    }
})();

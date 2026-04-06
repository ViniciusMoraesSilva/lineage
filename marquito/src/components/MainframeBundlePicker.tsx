'use client';

import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import { ParsedLineage } from '@/lib/types';
import { parseCanonicalBundle } from '@/lib/mainframe/parseCanonicalBundle';
import { useThemeContext } from './ThemeProvider';

interface MainframeBundlePickerProps {
  onDataLoaded: (data: ParsedLineage[]) => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  compact?: boolean;
}

const REQUIRED_FILES = [
  'entities.csv',
  'entity_columns.csv',
  'column_mappings.csv',
  'transform_rules.csv',
] as const;

const OPTIONAL_FILES = [
  'steps.csv',
  'artifacts.csv',
  'evidence.csv',
] as const;

const MainframeBundlePicker = ({
  onDataLoaded,
  onError,
  onLoading,
  compact = false,
}: MainframeBundlePickerProps) => {
  const { isDark } = useThemeContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadedFiles, setLoadedFiles] = useState<Record<string, boolean>>({});

  const handleSample = async () => {
    onLoading(true);
    try {
      const [entities, entityColumns, columnMappings, transformRules, steps, artifacts, evidence] = await Promise.all([
        fetch('/mainframe-sample/entities.csv').then(readResponseText),
        fetch('/mainframe-sample/entity_columns.csv').then(readResponseText),
        fetch('/mainframe-sample/column_mappings.csv').then(readResponseText),
        fetch('/mainframe-sample/transform_rules.csv').then(readResponseText),
        fetchOptionalText('/mainframe-sample/steps.csv'),
        fetchOptionalText('/mainframe-sample/artifacts.csv'),
        fetchOptionalText('/mainframe-sample/evidence.csv'),
      ]);

      const parsed = parseCanonicalBundle({
        entities,
        entityColumns,
        columnMappings,
        transformRules,
        steps,
        artifacts,
        evidence,
      });

      setLoadedFiles(
        Object.fromEntries(
          [...REQUIRED_FILES.map((fileName) => [fileName, true]), ...OPTIONAL_FILES.map((fileName) => [fileName, true])],
        ),
      );
      onDataLoaded([parsed]);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load sample');
    } finally {
      onLoading(false);
    }
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    onLoading(true);
    try {
      const bundles = await readBundlesFromFiles(files);

      if (!bundles.length) {
        throw new Error('Nenhum bundle valido foi encontrado nos arquivos enviados.');
      }

      setLoadedFiles(
        Object.fromEntries(
          [...REQUIRED_FILES, ...OPTIONAL_FILES].map((fileName) => [fileName, bundles.some((bundle) => Boolean(bundle[fileName]))]),
        ),
      );

      const parsedBundles = bundles.map((bundle, index) => {
        const missing = REQUIRED_FILES.filter((fileName) => !bundle[fileName]);
        if (missing.length) {
          throw new Error(`Bundle ${index + 1} com arquivos faltando: ${missing.join(', ')}`);
        }

        return parseCanonicalBundle({
          entities: bundle['entities.csv'],
          entityColumns: bundle['entity_columns.csv'],
          columnMappings: bundle['column_mappings.csv'],
          transformRules: bundle['transform_rules.csv'],
          steps: bundle['steps.csv'],
          artifacts: bundle['artifacts.csv'],
          evidence: bundle['evidence.csv'],
        });
      });

      onDataLoaded(parsedBundles);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Falha ao carregar bundle canonico');
    } finally {
      event.target.value = '';
      onLoading(false);
    }
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.zip,text/csv,application/zip"
          style={{ display: 'none' }}
          onChange={handleFiles}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ ...primaryButton(), width: 'auto', padding: '10px 14px', fontSize: '13px' }}
        >
          Adicionar JCL
        </button>
        <button
          type="button"
          onClick={handleSample}
          style={{ ...secondaryButton(isDark), width: 'auto', padding: '10px 14px', fontSize: '13px', marginTop: 0 }}
        >
          Adicionar amostra
        </button>
        <span style={{ fontSize: '12px', color: isDark ? '#A19F9D' : '#605E5C' }}>
          Envie varios `.zip` de uma vez ou um conjunto unico de CSVs soltos. O viewer acumula os JCLs automaticamente.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 96px)',
        padding: '48px 24px',
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          backgroundColor: isDark ? '#252423' : '#FFFFFF',
          border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
          borderRadius: '12px',
          padding: '32px',
          boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.24)' : '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#D83B01',
              marginBottom: '8px',
            }}
          >
            Mainframe Canonical Bundle
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              color: isDark ? '#FAF9F8' : '#323130',
            }}
          >
            Column lineage de mainframe no estilo Marquito
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: isDark ? '#A19F9D' : '#605E5C',
              lineHeight: '1.6',
              maxWidth: '780px',
            }}
          >
            Carregue o bundle canônico do extractor e o site converte os datasets e campos
            para a mesma experiência visual do column lineage do Marquito, incluindo origem
            por `hard_code`, regras e dependências entre colunas.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '16px',
          }}
        >
          <div
            style={{
              border: `1px dashed ${isDark ? '#484644' : '#C8C6C4'}`,
              borderRadius: '10px',
              padding: '20px',
              backgroundColor: isDark ? '#201F1E' : '#FAF9F8',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.zip,text/csv,application/zip"
              style={{ display: 'none' }}
              onChange={handleFiles}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={primaryButton()}
            >
              Selecionar ZIP ou CSVs do bundle
            </button>
            <button
              type="button"
              onClick={handleSample}
              style={{ ...secondaryButton(isDark), marginTop: '12px' }}
            >
              Carregar amostra JCLDB001
            </button>
            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {REQUIRED_FILES.map((fileName) => (
                <span
                  key={fileName}
                  style={{
                    fontSize: '12px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    backgroundColor: loadedFiles[fileName]
                      ? 'rgba(16,124,16,0.12)'
                      : isDark ? '#323130' : '#F3F2F1',
                    color: loadedFiles[fileName]
                      ? '#107C10'
                      : isDark ? '#D2D0CE' : '#605E5C',
                    fontWeight: 600,
                  }}
                >
                  {fileName}
                </span>
              ))}
              {OPTIONAL_FILES.map((fileName) => (
                <span
                  key={fileName}
                  style={{
                    fontSize: '12px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    backgroundColor: loadedFiles[fileName]
                      ? 'rgba(216,59,1,0.12)'
                      : isDark ? '#323130' : '#F3F2F1',
                    color: loadedFiles[fileName]
                      ? '#D83B01'
                      : isDark ? '#D2D0CE' : '#605E5C',
                    fontWeight: 600,
                  }}
                >
                  {fileName} opcional
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
              borderRadius: '10px',
              padding: '20px',
              backgroundColor: isDark ? '#201F1E' : '#FCFBFA',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: isDark ? '#FAF9F8' : '#323130' }}>
              Arquivos obrigatorios
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: isDark ? '#D2D0CE' : '#605E5C', fontSize: '13px', lineHeight: '1.8' }}>
              <li>`entities.csv`</li>
              <li>`entity_columns.csv`</li>
              <li>`column_mappings.csv`</li>
              <li>`transform_rules.csv`</li>
            </ul>
            <div style={{ fontSize: '13px', fontWeight: 700, margin: '14px 0 10px', color: isDark ? '#FAF9F8' : '#323130' }}>
              Arquivos opcionais
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: isDark ? '#D2D0CE' : '#605E5C', fontSize: '13px', lineHeight: '1.8' }}>
              <li>`steps.csv`</li>
              <li>`artifacts.csv`</li>
              <li>`evidence.csv`</li>
            </ul>
            <div style={{ marginTop: '14px', fontSize: '12px', color: isDark ? '#A19F9D' : '#605E5C', lineHeight: '1.6' }}>
              Envie varios `.zip` com bundles completos ou um unico conjunto de CSVs separados. Depois, dentro da tela do lineage, voce pode continuar adicionando outros JCLs e ir acumulando.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function primaryButton(): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0078D4',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function secondaryButton(isDark: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
    backgroundColor: isDark ? '#252423' : '#FFFFFF',
    color: isDark ? '#FAF9F8' : '#323130',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

async function readResponseText(response: Response): Promise<string> {
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${response.url}`);
  }
  return response.text();
}

async function readBundlesFromFiles(files: File[]): Promise<Array<Record<string, string>>> {
  const bundles: Array<Record<string, string>> = [];
  const looseBundle: Record<string, string> = {};

  for (const file of files) {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      const zipBundle = await readBundleFromZip(file);
      if (Object.keys(zipBundle).length) {
        bundles.push(zipBundle);
      }
      continue;
    }

    if (isBundleFileName(lowerName)) {
      looseBundle[lowerName] = await file.text();
    }
  }

  if (Object.keys(looseBundle).length) {
    bundles.push(looseBundle);
  }

  return bundles;
}

async function readBundleFromZip(file: File): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const bundle: Record<string, string> = {};

  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) {
        return;
      }

      const normalizedName = entry.name.split('/').pop()?.toLowerCase() || '';
      if (!isBundleFileName(normalizedName)) {
        return;
      }

      bundle[normalizedName] = await entry.async('text');
    }),
  );

  return bundle;
}

function isBundleFileName(name: string): boolean {
  return (
    REQUIRED_FILES.includes(name as (typeof REQUIRED_FILES)[number]) ||
    OPTIONAL_FILES.includes(name as (typeof OPTIONAL_FILES)[number])
  );
}

async function fetchOptionalText(url: string): Promise<string | undefined> {
  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }
  return response.text();
}

export default MainframeBundlePicker;

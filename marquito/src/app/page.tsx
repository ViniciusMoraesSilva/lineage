'use client';

import { useMemo, useState } from 'react';
import { ParsedLineage } from '@/lib/types';
import HeroSection from '@/components/HeroSection';
import TableLineage from '@/components/TableLineage';
import ColumnLineage from '@/components/ColumnLineage';
import JobsTable from '@/components/JobsTable';
import DatasetsTable from '@/components/DatasetsTable';
import EventsTimeline from '@/components/EventsTimeline';
import DataSourcePicker, { UploadedLineageFile } from '@/components/DataSourcePicker';
import { useThemeContext } from '@/components/ThemeProvider';
import { parseLineageText } from '@/lib/parseLineage';

export default function Home() {
  const [loadedFiles, setLoadedFiles] = useState<UploadedLineageFile[]>([]);
  const [sampleData, setSampleData] = useState<ParsedLineage | null>(null);
  const [view, setView] = useState<'import' | 'lineage'>('import');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { isDark } = useThemeContext();

  const { uploadedData, aggregationError } = useMemo(() => {
    if (!loadedFiles.length) {
      return { uploadedData: null as ParsedLineage | null, aggregationError: null as string | null };
    }

    try {
      return {
        uploadedData: parseLineageText(
          loadedFiles
            .map((file) => file.text.trim())
            .filter(Boolean)
            .join('\n'),
        ),
        aggregationError: null,
      };
    } catch (err: unknown) {
      return {
        uploadedData: null,
        aggregationError: err instanceof Error ? err.message : 'Failed to aggregate uploaded lineage data.',
      };
    }
  }, [loadedFiles]);

  const data = uploadedData || sampleData;

  const resetState = () => {
    setError(null);
    setLoadedFiles([]);
    setSampleData(null);
    setView('import');
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 96px)',
          fontFamily: "'Segoe UI', sans-serif",
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: `3px solid ${isDark ? '#323130' : '#EDEBE9'}`,
            borderTop: '3px solid #0078D4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '14px', color: isDark ? '#A19F9D' : '#605E5C' }}>
          Loading OpenLineage data…
        </span>
      </div>
    );
  }

  if (error || aggregationError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 96px)',
          fontFamily: "'Segoe UI', sans-serif",
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '16px', color: '#A4262C', fontWeight: 600 }}>Failed to load data</span>
        <span style={{ fontSize: '13px', color: isDark ? '#A19F9D' : '#605E5C' }}>{error || aggregationError}</span>
        <button
          onClick={resetState}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: '#0078D4',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: "'Segoe UI', sans-serif",
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (view === 'import' || !data) {
    return (
      <DataSourcePicker
        loadedFiles={loadedFiles}
        onFilesAdded={(files) => {
          setLoadedFiles((current) => [...current, ...files]);
          setSampleData(null);
          setError(null);
        }}
        onFileRemoved={(fileId) => {
          setLoadedFiles((current) => current.filter((file) => file.id !== fileId));
        }}
        onUseUploaded={() => {
          if (loadedFiles.length) {
            setView('lineage');
          }
        }}
        onSampleLoaded={(nextData) => {
          setSampleData(nextData);
          setLoadedFiles([]);
          setError(null);
          setView('lineage');
        }}
        onError={setError}
        onLoading={setLoading}
      />
    );
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      <section style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px 20px' }}>
        <div
          style={{
            backgroundColor: isDark ? '#252423' : '#FFFFFF',
            border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
            borderRadius: '10px',
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D83B01', marginBottom: '8px' }}>
                OpenLineage Viewer
              </div>
              <div style={{ fontSize: '14px', color: isDark ? '#A19F9D' : '#605E5C' }}>
                {loadedFiles.length
                  ? `${loadedFiles.length} arquivo(s) carregado(s) • ${loadedFiles.reduce((total, file) => total + file.eventCount, 0)} eventos válidos`
                  : 'Dataset carregado a partir de amostra'}
              </div>
            </div>
            <button
              onClick={() => setView('import')}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
                backgroundColor: isDark ? '#201F1E' : '#FFFFFF',
                color: isDark ? '#FAF9F8' : '#323130',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Voltar para importação
            </button>
          </div>
          {loadedFiles.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {loadedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? '#323130' : '#F3F2F1',
                    color: isDark ? '#D2D0CE' : '#605E5C',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{file.fileName}</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>{file.eventCount} eventos</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <HeroSection data={data} />
      <TableLineage data={data} />
      <ColumnLineage data={data} />
      <JobsTable data={data} />
      <DatasetsTable data={data} />
      <EventsTimeline data={data} />
    </div>
  );
}

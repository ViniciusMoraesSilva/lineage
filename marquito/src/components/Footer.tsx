'use client';

import { useThemeContext } from './ThemeProvider';

const Footer = () => {
  const { isDark } = useThemeContext();

  return (
    <footer
      style={{
        backgroundColor: isDark ? '#1B1A19' : '#F3F2F1',
        borderTop: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
        padding: '12px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1 1 220px',
            minWidth: '220px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#D83B01" />
            <text x="16" y="22" textAnchor="middle" fill="white" fontFamily="Segoe UI, sans-serif" fontSize="18" fontWeight="600">M</text>
          </svg>
          <span style={{ fontSize: '12px', color: isDark ? '#F3F2F1' : '#323130', fontWeight: 600, fontFamily: "'Segoe UI', sans-serif" }}>
            Mainframe Lineage Viewer
          </span>
        </div>

        <div
          style={{
            flex: '1 1 220px',
            minWidth: '220px',
            display: 'flex',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: isDark ? '#D2D0CE' : '#484644', fontWeight: 600, fontFamily: "'Segoe UI', sans-serif" }}>
            Desenvolvido por Vinicius Moraes
          </div>
        </div>

        <div
          style={{
            flex: '1 1 220px',
            minWidth: '220px',
            display: 'flex',
            justifyContent: 'flex-end',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '11px', color: isDark ? '#A19F9D' : '#605E5C', fontFamily: "'Segoe UI', sans-serif" }}>
            Baseado no{' '}
            <a href="https://github.com/mdrakiburrahman/openlineage-sandbox" target="_blank" rel="noopener noreferrer" style={{ color: '#D83B01', textDecoration: 'none' }}>
              Marquito
            </a>
            {' / '}
            <a href="https://openlineage.io" target="_blank" rel="noopener noreferrer" style={{ color: '#D83B01', textDecoration: 'none' }}>
              OpenLineage
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

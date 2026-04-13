'use client';

import { useState, useRef, useEffect } from 'react';
import { useThemeContext } from './ThemeProvider';
import ThemeToggle from './ThemeToggle';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const Header = () => {
  const { isDark } = useThemeContext();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      style={{
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: isDark ? '#1B1A19' : '#FFFFFF',
        borderBottom: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
        height: '48px',
      }}
    >
      <div
        style={{
          padding: '0 24px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1600px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#D83B01" />
            <text
              x="16"
              y="22"
              textAnchor="middle"
              fill="white"
              fontFamily="Segoe UI, sans-serif"
              fontSize="18"
              fontWeight="600"
            >
              ML
            </text>
          </svg>
          <Link
            href="/"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: isDark ? '#FAF9F8' : '#323130',
              fontFamily: "'Segoe UI', sans-serif",
              textDecoration: 'none',
            }}
          >
            Mainframe Lineage Viewer
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '16px' }}>
            <Link
              href="/mainframe"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                textDecoration: 'none',
                fontSize: '13px',
                fontFamily: "'Segoe UI', sans-serif",
                padding: '4px 10px',
                borderRadius: '4px',
                color: pathname === '/' || pathname === '/mainframe'
                  ? '#D83B01'
                  : isDark ? '#D2D0CE' : '#605E5C',
                backgroundColor: pathname === '/' || pathname === '/mainframe'
                  ? isDark ? 'rgba(216,59,1,0.18)' : 'rgba(216,59,1,0.08)'
                  : 'transparent',
                fontWeight: pathname === '/' || pathname === '/mainframe' ? 600 : 400,
              }}
            >
              Mainframe
            </Link>

            <div ref={moreRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More navigation links"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontFamily: "'Segoe UI', sans-serif",
                  color: isDark ? '#D2D0CE' : '#605E5C',
                  backgroundColor: moreOpen
                    ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                    : 'transparent',
                }}
              >
                ⋯
              </button>

              {moreOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    minWidth: '160px',
                    backgroundColor: isDark ? '#292827' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#484644' : '#EDEBE9'}`,
                    borderRadius: '6px',
                    boxShadow: isDark
                      ? '0 4px 12px rgba(0,0,0,0.4)'
                      : '0 4px 12px rgba(0,0,0,0.12)',
                    padding: '4px 0',
                    zIndex: 200,
                  }}
                >
                  <Link
                    href="/openlineage"
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontFamily: "'Segoe UI', sans-serif",
                      padding: '6px 12px',
                      color: pathname === '/openlineage'
                        ? '#0078D4'
                        : isDark ? '#D2D0CE' : '#323130',
                      backgroundColor: pathname === '/openlineage'
                        ? isDark ? 'rgba(0,120,212,0.15)' : 'rgba(0,120,212,0.08)'
                        : 'transparent',
                      fontWeight: pathname === '/openlineage' ? 600 : 400,
                    }}
                  >
                    OpenLineage
                  </Link>
                  <Link
                    href="/fabric-livy"
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontFamily: "'Segoe UI', sans-serif",
                      padding: '6px 12px',
                      color: pathname === '/fabric-livy'
                        ? '#117a3e'
                        : isDark ? '#D2D0CE' : '#323130',
                      backgroundColor: pathname === '/fabric-livy'
                        ? isDark ? 'rgba(17,122,62,0.18)' : 'rgba(17,122,62,0.08)'
                        : 'transparent',
                      fontWeight: pathname === '/fabric-livy' ? 600 : 400,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/fabric.svg" alt="Fabric" width={16} height={16} style={{ objectFit: 'contain' }} />
                    Fabric Livy
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;

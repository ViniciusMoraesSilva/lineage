import {
  getMainframeExportHelperText,
  MAINFRAME_CLASSIFICATION_EXCEL_LABEL,
  MAINFRAME_DETAILED_EXCEL_LABEL,
} from '@/lib/mainframe/exportWorkbookActions';

interface MainframeExportActionsProps {
  isDark: boolean;
  selectedFieldsCount: number;
  onDetailedExport: () => void;
  onClassificationExport: () => void;
}

export default function MainframeExportActions({
  isDark,
  selectedFieldsCount,
  onDetailedExport,
  onClassificationExport,
}: MainframeExportActionsProps) {
  return (
    <div style={{ display: 'grid', gap: '8px', justifyItems: 'end' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {selectedFieldsCount > 0 ? (
          <button
            type="button"
            onClick={onDetailedExport}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
              backgroundColor: '#0078D4',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {MAINFRAME_DETAILED_EXCEL_LABEL}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClassificationExport}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
            backgroundColor: isDark ? '#252423' : '#FFFFFF',
            color: isDark ? '#FAF9F8' : '#323130',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {MAINFRAME_CLASSIFICATION_EXCEL_LABEL}
        </button>
      </div>
      <div style={{ fontSize: '12px', color: isDark ? '#A19F9D' : '#605E5C', maxWidth: '520px', textAlign: 'right' }}>
        {getMainframeExportHelperText(selectedFieldsCount)}
      </div>
    </div>
  );
}
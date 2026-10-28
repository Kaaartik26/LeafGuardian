'use client';

import { useState, useRef } from 'react';

interface Props {
  onDiagnose: (file: File) => void;
  loading: boolean;
}

export default function DiagnoseForm({ onDiagnose, loading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selected: File) => {
    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (file && !loading) onDiagnose(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>

      {/* Upload zone / preview */}
      {preview ? (
        <div style={{
          flex: 1,
          minHeight: 220,
          borderRadius: 14,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--preview-bg)',
          border: '1px solid var(--border-strong)',
        }}>
          {/* Scan line animation */}
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 2,
              background: 'var(--scan-green)',
              boxShadow: '0 0 8px var(--scan-green)',
              animation: 'scanLine 2.2s ease-in-out infinite',
              zIndex: 10,
            }} />
          )}
          <img
            src={preview}
            alt="Leaf preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 220 }}
          />
          {/* Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            padding: '28px 14px 12px',
            background: 'linear-gradient(transparent, rgba(10,20,8,0.82))',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--preview-filename)', fontFamily: 'monospace' }}>
              {file?.name}
            </span>
            <button
              onClick={handleReset}
              aria-label="Remove selected image"
              style={{
                background: 'rgba(200,50,50,0.8)',
                border: 'none',
                borderRadius: '50%',
                width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
                flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor="file-upload"
          aria-label="Upload leaf image. Click or drag and drop a photo here."
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            flex: 1,
            minHeight: 220,
            border: `1.5px dashed ${dragOver ? 'var(--green-dark)' : '#c8d9b8'}`,
            borderRadius: 16,
            background: dragOver ? 'var(--green-light)' : 'var(--surface-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: 'pointer',
            padding: '24px',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{
            width: 56, height: 56,
            background: 'var(--upload-icon-bg)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3a7a20" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Click to upload or drag & drop
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Take a clear, close-up photo of the affected leaf.<br />Good lighting makes a big difference!
            </p>
          </div>
          <span style={{
            background: 'var(--green-dark)',
            color: '#fff',
            border: 'none',
            borderRadius: 24,
            padding: '9px 22px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Choose photo
          </span>
          <input
            ref={inputRef}
            id="file-upload"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {/* Analyze button */}
      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        aria-busy={loading}
        aria-disabled={!file || loading}
        style={{
          width: '100%',
          padding: 13,
          borderRadius: 12,
          background: file && !loading ? 'var(--green-dark)' : 'var(--btn-disabled)',
          border: 'none',
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          cursor: file && !loading ? 'pointer' : 'not-allowed',
          letterSpacing: '0.2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'background 0.15s ease',
        }}
      >
        {loading ? (
          <>
            <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            Analyze photo
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </>
        )}
      </button>

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 0; opacity: 1; }
          50% { top: calc(100% - 2px); opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { getPrediction } from '../lib/api';
import { PredictionResponse, ScanFeedback } from '../types/prediction';
import DiagnoseForm from '../components/DiagnoseForm';
import PredictionResult from '../components/PredictionResult';
import RecentScans, { ScanRecord } from '../components/RecentScans';

export default function DiagnosePage() {
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);

  const handleDiagnose = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const prediction = await getPrediction(file);
      setResult(prediction);
      const id = Date.now().toString();
      setCurrentScanId(id);
      setScans((prev) => [
        {
          id,
          label: prediction.label,
          confidence: prediction.confidence,
          timestamp: new Date(),
          fileName: file.name,
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      console.error('Diagnosis error:', err);
      setError(err instanceof Error ? err.message : 'Diagnosis failed. Please try a clearer photo.');
    }
    setLoading(false);
  };

  const handleFeedback = (feedback: ScanFeedback) => {
    if (!currentScanId) return;
    setScans((prev) => prev.map((scan) => (
      scan.id === currentScanId ? { ...scan, feedback } : scan
    )));
  };

  const currentScan = scans.find((scan) => scan.id === currentScanId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background)' }}>

      {/* Nav */}
      <nav style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/logo-icon.png"
            alt="Green Guardian"
            width={32}
            height={32}
            style={{ objectFit: 'contain' }}
          />
          <span style={{ fontFamily: "'Faustina', Georgia, serif", fontSize: 17, color: 'var(--text-primary)', fontWeight: 600 }}>
            Green Guardian
          </span>
        </div>

        <div className="site-links">
          <a
            className="site-link"
            href="https://github.com/kameron-ctrl/GreenGuardian"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source
          </a>
          <span className="site-link-sep" aria-hidden="true">&middot;</span>
          <a
            className="site-link"
            href="https://github.com/kameron-ctrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span className="site-link-sep" aria-hidden="true">&middot;</span>
          <a className="site-link" href="mailto:kameron1.benjamin@famu.edu">
            Contact me
          </a>
          <span className="site-link-sep" aria-hidden="true">&middot;</span>
          <a
            className="site-link"
            href="https://kameron-ctrl.github.io/portfolio/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Portfolio
          </a>
        </div>
      </nav>

      {/* Split body */}
      <div className="main-grid">

        {/* Left panel */}
        <div style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          overflowY: 'auto',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '1.4px',
            color: 'var(--text-faint)', textTransform: 'uppercase',
          }}>
            01 &middot; Upload your leaf
          </span>

          <DiagnoseForm onDiagnose={handleDiagnose} loading={loading} />

          {/* Recent scans divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          <RecentScans scans={scans} onClear={() => setScans([])} />
        </div>

        {/* Right panel */}
        <div style={{
          background: 'var(--background)',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '1.4px',
            color: 'var(--text-faint)', textTransform: 'uppercase',
          }}>
            02 &middot; Diagnosis
          </span>

          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 13,
                color: 'var(--error-text)',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {!result && !error && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              opacity: 0.4,
              padding: '60px 20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52,
                border: '1.5px solid var(--green-dark)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-dark)" strokeWidth="1.5">
                  <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6 }}>
                Upload a leaf photo and tap <strong>Analyze</strong><br />to see what&rsquo;s going on.
              </p>
            </div>
          )}

          {result && (
            <PredictionResult
              result={result}
              feedback={currentScan?.feedback}
              onFeedback={handleFeedback}
              scanHistory={scans.map(s => ({
                label: s.label,
                confidence: s.confidence,
                timestamp: s.timestamp,
                fileName: s.fileName,
                feedback: s.feedback,
              }))}
            />
          )}
        </div>

      </div>
    </div>
  );
}
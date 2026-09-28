import { useEffect, useState } from 'react';
import {
  FileText, CheckCircle2, XCircle, RefreshCw, AlertTriangle,
  Shield, X, Lock, Copy, Check, Search, Download, FileSpreadsheet, Eye
} from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import type { Report } from '../types';

type VerdictFilter = 'all' | 'PASS' | 'FAIL';
interface VerifyResult {
  report_number: string; sha256_hash: string;
  instrument_model?: string; inspector_name?: string;
  overall_verdict?: string; status: 'verified' | 'not found'; issued_at?: string;
}

const cardStyle = {
  background: 'var(--color-surface-1)',
  border: '1.5px solid var(--color-border-default)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-md)',
};

export const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerdictFilter>('all');
  const [search, setSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // On-screen detailed view
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [activeReportData, setActiveReportData] = useState<any | null>(null);

  const fetchReports = async () => {
    setLoading(true); setError(null);
    try { const res = await api.getReports(); setReports(res.data ?? []); }
    catch { setError('Failed to load reports. Ensure the backend server is reachable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchReports(); }, []);

  const handleVerify = async (reportNumber: string) => {
    setVerifyOpen(true); setVerifyLoading(true); setVerifyResult(null); setVerifyError(null);
    try {
      const res = await api.verifyReport(reportNumber); setVerifyResult(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) setVerifyResult({ report_number: reportNumber, sha256_hash: '', status: 'not found' });
      else setVerifyError('Verification failed. Check backend connectivity.');
    } finally { setVerifyLoading(false); }
  };

  const handleViewReport = async (reportNumber: string) => {
    setViewOpen(true); setViewLoading(true); setActiveReportData(null);
    try {
      const res = await fetch(`/api/reports/${reportNumber}/data`);
      if (res.ok) {
        const data = await res.json();
        setActiveReportData(data);
      }
    } catch {
      // ignore
    } finally {
      setViewLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text); setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filtered = reports.filter((r) => {
    const matchFilter = filter === 'all' || r.overall_verdict.toUpperCase() === filter;
    const matchSearch = r.report_number.toLowerCase().includes(search.toLowerCase()) ||
      (r.instrument_model || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.inspector_name || '').toLowerCase().includes(search.toLowerCase()) ||
      r.sha256_hash.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(30,64,175,0.25)' }}>
              <Lock size={17} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(17px,3vw,21px)', fontWeight: 900, color: 'var(--color-text-primary)', letterSpacing: '-0.025em', margin: 0 }}>Certificate Vault &amp; Export Center</h1>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>Cryptographically signed OIML R-76 test reports with PDF and Word .docx exports</p>
            </div>
          </div>
        </div>
        <button onClick={fetchReports} disabled={loading} className="btn btn-secondary btn-sm self-start sm:self-auto">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Vault
        </button>
      </div>

      {error && (
        <div className="alert alert-warning animate-fade-in-up">
          <AlertTriangle size={14} className="shrink-0" /><span>{error}</span>
          <button onClick={fetchReports} className="ml-auto font-semibold underline" style={{ fontSize: 'var(--text-xs)' }}>Retry</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4" style={cardStyle}>
        <div className="input-with-icon w-full md:w-80">
          <Search size={14} className="icon" />
          <input type="text" placeholder="Search certificate #, model, hash…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="input" />
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          <div className="pill-group">
            {(['all','PASS','FAIL'] as VerdictFilter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`pill-item ${filter === f ? 'active' : ''}`}
                style={filter === f ? {
                  color: f === 'PASS' ? '#065f46' : f === 'FAIL' ? '#991b1b' : 'var(--color-primary)',
                  background: f === 'PASS' ? 'rgba(16,185,129,0.10)' : f === 'FAIL' ? 'rgba(239,68,68,0.10)' : 'var(--color-primary-bg)',
                  borderColor: f === 'PASS' ? 'rgba(16,185,129,0.30)' : f === 'FAIL' ? 'rgba(239,68,68,0.30)' : 'var(--color-primary-border)',
                } : {}}
              >
                {f === 'all' ? 'All Records' : f === 'PASS' ? '✓ Approved' : '✗ Rejected'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {filtered.length} cert{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map((i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'rgba(30,64,175,0.08)', borderColor: 'rgba(30,64,175,0.20)', color: '#1e40af' }}>
              <FileText size={22} />
            </div>
            <p className="empty-state-title">{search || filter !== 'all' ? 'No certificates match' : 'No certificates yet'}</p>
            <p className="empty-state-description">
              {search || filter !== 'all' ? 'Try adjusting your search criteria.' : 'Complete a test session to generate your first SHA-256 signed certificate.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>{['Certificate No.','Instrument','Inspector','Verdict','SHA-256 Digest','Downloads','Actions'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>{r.report_number}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.instrument_model}</td>
                    <td>{r.inspector_name}</td>
                    <td><StatusBadge status={r.overall_verdict.toLowerCase()} /></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                          {r.sha256_hash ? r.sha256_hash.slice(0,14) + '…' : '—'}
                        </span>
                        {r.sha256_hash && (
                          <button onClick={() => copyToClipboard(r.sha256_hash)} title="Copy SHA-256"
                            className="btn-icon-sm flex items-center justify-center"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedHash === r.sha256_hash ? '#10b981' : 'var(--color-text-tertiary)' }}>
                            {copiedHash === r.sha256_hash ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/reports/${r.report_number}/pdf`}
                          download
                          className="btn btn-sm btn-secondary flex items-center gap-1"
                          style={{ padding: '3px 8px', fontSize: '11px', textDecoration: 'none' }}
                          title="Download Printable PDF"
                        >
                          <Download size={11} /> PDF
                        </a>
                        <a
                          href={`/api/reports/${r.report_number}/docx`}
                          download
                          className="btn btn-sm btn-ghost flex items-center gap-1"
                          style={{ padding: '3px 8px', fontSize: '11px', textDecoration: 'none', color: '#1e40af' }}
                          title="Download Editable Word Docx"
                        >
                          <FileSpreadsheet size={11} /> Word
                        </a>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleViewReport(r.report_number)} className="btn btn-ghost btn-sm" title="View Full On-Screen Report">
                          <Eye size={12} /> View
                        </button>
                        <button onClick={() => handleVerify(r.report_number)} className="btn btn-ghost btn-sm" style={{ color: '#10b981' }} title="Verify Seal">
                          <Shield size={12} /> Verify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* On-Screen Full Report Modal */}
      {viewOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewOpen(false); }}>
          <div className="modal-panel animate-fade-in-up" style={{ maxWidth: 850 }}>
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1.5px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(30,64,175,0.10)', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                    OIML R-76 Type Evaluation Report &bull; {activeReportData?.report_number}
                  </h2>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>Single shared ReportModel matching PDF and Word exports</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeReportData && (
                  <>
                    <a href={`/api/reports/${activeReportData.report_number}/pdf`} download className="btn btn-sm btn-primary">
                      <Download size={12} /> Download PDF
                    </a>
                    <a href={`/api/reports/${activeReportData.report_number}/docx`} download className="btn btn-sm btn-secondary">
                      <FileSpreadsheet size={12} /> Word .docx
                    </a>
                  </>
                )}
                <button onClick={() => setViewOpen(false)} className="btn btn-icon btn-ghost">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: 'var(--space-6)', maxHeight: '75vh', overflowY: 'auto' }}>
              {viewLoading && (
                <div className="flex flex-col items-center py-12 gap-3">
                  <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Loading report...</p>
                </div>
              )}

              {activeReportData && !viewLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl" style={{ background: 'var(--color-base)', border: '1.5px solid var(--color-border-subtle)' }}>
                    <div>
                      <div className="label-overline">Certificate Number</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-primary)' }}>{activeReportData.report_number}</div>
                    </div>
                    <div>
                      <div className="label-overline">Issue Date</div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{activeReportData.issued_at}</div>
                    </div>
                    <div>
                      <div className="label-overline">Standard</div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{activeReportData.rule_version}</div>
                    </div>
                    <div>
                      <div className="label-overline">Verdict</div>
                      <div><StatusBadge status={activeReportData.overall_verdict.toLowerCase()} /></div>
                    </div>
                  </div>

                  {/* Instrument & Lab */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--color-border-subtle)', background: 'var(--color-surface-1)' }}>
                      <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: 8 }}>
                        1. Instrument Specifications
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-xs)' }}>
                        <div className="flex justify-between"><span className="text-slate-500">Model:</span><b>{activeReportData.instrument?.model_number}</b></div>
                        <div className="flex justify-between"><span className="text-slate-500">Manufacturer:</span><span>{activeReportData.instrument?.manufacturer}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Serial No:</span><span className="font-mono">{activeReportData.instrument?.serial_number}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Accuracy Class:</span><b>Class {activeReportData.instrument?.accuracy_class}</b></div>
                        <div className="flex justify-between"><span className="text-slate-500">Max Capacity:</span><span className="font-mono">{activeReportData.instrument?.max_capacity} {activeReportData.instrument?.unit}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Scale Interval e / d:</span><span className="font-mono">e={activeReportData.instrument?.scale_interval_e} / d={activeReportData.instrument?.scale_interval_d}</span></div>
                      </div>
                    </div>

                    <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--color-border-subtle)', background: 'var(--color-surface-1)' }}>
                      <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: 8 }}>
                        2. Laboratory &amp; Environment
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-xs)' }}>
                        <div className="flex justify-between"><span className="text-slate-500">Facility:</span><span>{activeReportData.session?.lab_location}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Lead Inspector:</span><b>{activeReportData.session?.inspector_name}</b></div>
                        <div className="flex justify-between"><span className="text-slate-500">Ambient Temp:</span><span className="font-mono">{activeReportData.session?.ambient_temp_c} °C</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Relative Humidity:</span><span className="font-mono">{activeReportData.session?.relative_humidity} % RH</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Pressure:</span><span className="font-mono">{activeReportData.session?.pressure_hpa} hPa</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Test Type:</span><span>{activeReportData.session?.test_type?.replace('_', ' ').toUpperCase()}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Weighing Points */}
                  {activeReportData.weighing_points?.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: 8 }}>
                        3. Weighing Performance Test (§3.5)
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs data-table">
                          <thead>
                            <tr>{['#', 'Load (L)', 'Indication (I)', 'Direction', 'Error (Ec)', 'MPE Limit', 'Verdict'].map(h => <th key={h}>{h}</th>)}</tr>
                          </thead>
                          <tbody className="font-mono">
                            {activeReportData.weighing_points.map((pt: any, idx: number) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{pt.load_applied?.toFixed(4)}</td>
                                <td>{pt.indication_raw?.toFixed(4)}</td>
                                <td className="uppercase text-[10px]">{pt.direction}</td>
                                <td style={{ fontWeight: 700, color: pt.is_compliant ? '#059669' : '#dc2626' }}>{pt.corrected_error?.toFixed(4)}</td>
                                <td>±{pt.mpe_limit?.toFixed(4)}</td>
                                <td><StatusBadge status={pt.is_compliant ? 'pass' : 'fail'} size="sm" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Signature Block */}
                  <div className="p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'var(--color-base)', border: '1.5px solid var(--color-border-subtle)' }}>
                    <div>
                      <div className="text-xs text-slate-500">Certified by:</div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{activeReportData.inspector_sign_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{activeReportData.inspector_sign_designation} &bull; Date: {activeReportData.inspector_sign_date}</div>
                    </div>
                    <div className="text-right sm:text-right">
                      <div className="text-xs text-slate-500">SHA-256 PDF File Digest:</div>
                      <div className="font-mono text-[10px] text-blue-600 font-bold break-all max-w-sm">{activeReportData.sha256_hash}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setVerifyOpen(false); }}>
          <div className="modal-panel animate-fade-in-up">
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1.5px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.10)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} />
                </div>
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>Certificate Seal Verification</h2>
              </div>
              <button onClick={() => setVerifyOpen(false)} className="btn btn-icon btn-ghost">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 'var(--space-6)' }}>
              {verifyLoading && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Verifying cryptographic seal…</p>
                </div>
              )}

              {verifyError && !verifyLoading && (
                <div className="alert alert-error"><AlertTriangle size={14} /><span>{verifyError}</span></div>
              )}

              {verifyResult && !verifyLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div className="flex flex-col items-center py-8 text-center rounded-2xl gap-3"
                    style={{
                      background: verifyResult.status === 'verified' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                      border: `1.5px solid ${verifyResult.status === 'verified' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      borderRadius: 'var(--radius-xl)',
                    }}
                  >
                    {verifyResult.status === 'verified'
                      ? <CheckCircle2 size={52} style={{ color: '#10b981' }} />
                      : <XCircle size={52} style={{ color: '#ef4444' }} />}
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 17, color: verifyResult.status === 'verified' ? '#065f46' : '#991b1b', letterSpacing: '0.04em' }}>
                      {verifyResult.status === 'verified' ? 'AUTHENTIC RECORD CONFIRMED' : 'RECORD NOT FOUND'}
                    </span>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', maxWidth: 300, margin: 0 }}>
                      {verifyResult.status === 'verified'
                        ? 'SHA-256 seal matches the official Legal Metrology vault.'
                        : 'No certificate matching this hash was found in the vault.'}
                    </p>
                  </div>

                  {verifyResult.status === 'verified' && (
                    <div style={{ background: 'var(--color-base)', border: '1.5px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                      {[
                        { label: 'Certificate No', val: verifyResult.report_number },
                        { label: 'Instrument Model', val: verifyResult.instrument_model },
                        { label: 'Certifying Officer', val: verifyResult.inspector_name },
                        { label: 'Verdict', val: verifyResult.overall_verdict },
                      ].map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < 3 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: 'var(--text-xs)' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{row.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.label === 'Verdict' ? (row.val === 'PASS' ? '#065f46' : '#991b1b') : 'var(--color-text-primary)' }}>
                            {row.val}
                          </span>
                        </div>
                      ))}
                      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
                        <div className="label-overline mb-2">SHA-256 Verified Digest</div>
                        <div style={{ background: '#f8f9fc', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6366f1', wordBreak: 'break-all', border: '1.5px solid var(--color-border-subtle)' }}>
                          {verifyResult.sha256_hash}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setVerifyOpen(false)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
                Close Verification Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

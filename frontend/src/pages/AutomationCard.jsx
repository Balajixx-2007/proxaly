import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Loader2, Play, Square, ExternalLink } from 'lucide-react';
import automationApi from '../lib/automationApi';
import toast from 'react-hot-toast';

function getApiErrorMessage(err, fallback) {
  const status = err?.response?.status;
  const apiMsg = err?.response?.data?.error || err?.response?.data?.message;
  if (status === 401) return 'Session expired. Please sign in again.';
  return apiMsg || err?.message || fallback;
}

export default function AutomationCard() {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus({ silent: true }), 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const res = await automationApi.status();
      setStatus(res.data);
    } catch (err) {
      // Keep last known state to avoid false "Stopped" UI during transient failures.
      console.warn('[AutomationCard] status fetch failed:', err?.message || err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleToggle() {
    setRunLoading(true);
    try {
      const shouldStart = !status.running;

      if (shouldStart) await automationApi.start();
      else await automationApi.stop();
      await fetchStatus({ silent: true });
      toast.success(shouldStart ? 'Automation started' : 'Automation stopped');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update automation'));
    } finally {
      setRunLoading(false);
    }
  }

  async function handleRunNow() {
    setRunLoading(true);
    try {
      await automationApi.runNow();
      await fetchStatus({ silent: true });
      toast.success('Automation run complete');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to run automation'));
    } finally {
      setRunLoading(false);
    }
  }

  return (
    <div className="glass" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(34,211,238,0.05))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}><Zap size={16} /> Automation</h2>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: status.running ? '#4ade80' : '#f87171',
          boxShadow: status.running ? '0 0 0 2px rgba(74,222,128,0.2)' : '0 0 0 2px rgba(248,113,113,0.2)',
          animation: status.running ? 'pulse 2s infinite' : 'none'
        }}></div>
      </div>
      <div style={{ fontSize: 12, marginBottom: 12 }}>
        <p style={{ margin: '6px 0', color: 'rgba(148,163,184,0.8)' }}>
          <strong>Status:</strong> <span style={{ color: status.running ? '#4ade80' : '#f87171' }}>
            {loading ? <Loader2 size={14} className="spin" /> : status.running ? 'Running' : 'Stopped'}
          </span>
        </p>
        <p style={{ margin: '6px 0', color: 'rgba(148,163,184,0.8)' }}>
          <strong>Last Run:</strong> {status.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}
        </p>
        <p style={{ margin: '6px 0', color: 'rgba(148,163,184,0.8)' }}>
          <strong>Next Run:</strong> {status.nextRun ? new Date(status.nextRun).toLocaleString() : 'N/A'}
        </p>
        <p style={{ margin: '6px 0', color: 'rgba(148,163,184,0.8)' }}>
          <strong>Leads Today:</strong> {status.totalLeadsToday || 0}
        </p>
        <p style={{ margin: '6px 0', color: 'rgba(148,163,184,0.8)' }}>
          <strong>Saved Today:</strong> {status.totalSavedToday || 0}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexDirection: 'row', marginBottom: 10 }}>
        <button
          className={`btn ${status.running ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleToggle}
          disabled={runLoading || loading}
        >
          {runLoading ? <Loader2 size={14} className="spin" /> : status.running ? <Square size={14} /> : <Play size={14} />}
          {status.running ? 'Stop' : 'Start'}
        </button>
        <button className="btn btn-ghost" onClick={handleRunNow} disabled={runLoading || loading}>
          <Zap size={14} /> Run Now
        </button>
        <Link to="/automation">
          <button className="btn btn-ghost">
            <ExternalLink size={13} /> Settings
          </button>
        </Link>
      </div>
    </div>
  );
}

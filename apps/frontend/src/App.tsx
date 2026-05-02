import { useState, useEffect } from 'react'

interface ServerInfo {
  appName: string;
  environment: string;
  version: string;
}

interface HealthInfo {
  status: string;
  timestamp: string;
}

function App() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [status, setStatus] = useState<'Checking' | 'Online' | 'Offline'>('Checking');
  const [error, setError] = useState<string | null>(null);

  const backendUrl = 'http://localhost:3001';

  const checkHealth = async () => {
    try {
      const res = await fetch(`${backendUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealthInfo(data);
        setStatus('Online');
        setError(null);
      } else {
        setHealthInfo(null);
        setStatus('Offline');
        setError('Could not connect to the backend server.');
      }
    } catch {
      setHealthInfo(null);
      setStatus('Offline');
      setError('Could not connect to the backend server.');
    }
  };

  const fetchInfo = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/info`);
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
      }
    } catch {
      // Ignore error
    }
  };

  useEffect(() => {
    let active = true;

    const runTelemetry = async () => {
      try {
        const res = await fetch(`${backendUrl}/health`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setHealthInfo(data);
          setStatus('Online');
          setError(null);
        } else {
          setHealthInfo(null);
          setStatus('Offline');
          setError('Could not connect to the backend server.');
        }
      } catch {
        if (active) {
          setHealthInfo(null);
          setStatus('Offline');
          setError('Could not connect to the backend server.');
        }
      }

      try {
        const res = await fetch(`${backendUrl}/api/info`);
        if (active && res.ok) {
          const data = await res.json();
          setServerInfo(data);
        }
      } catch {
        // Ignored
      }
    };

    runTelemetry();

    const intervalId = setInterval(runTelemetry, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="dashboard">
      <header className="header">
        <div className="title-section">
          <h1>System Diagnostics</h1>
          <p>Real-time telemetry and status monitor for your CI/CD setup</p>
        </div>
        <div className={`status-badge ${status.toLowerCase()}`}>
          <div className="pulse-dot"></div>
          {status}
        </div>
      </header>

      <section className="content-grid">
        <div className="card">
          <h3>Health Status</h3>
          <div className={`card-value ${status === 'Online' ? 'success' : 'error'}`}>
            {status === 'Online' ? 'Healthy' : status === 'Checking' ? 'Diagnosing...' : 'Disconnected'}
          </div>
        </div>

        <div className="card">
          <h3>App Information</h3>
          {serverInfo ? (
            <div className="card-value" style={{ fontSize: '15px', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Name:</strong> {serverInfo.appName}</div>
              <div><strong>Env:</strong> {serverInfo.environment}</div>
              <div><strong>Version:</strong> {serverInfo.version}</div>
            </div>
          ) : (
            <div className="card-value error" style={{ fontSize: '14px' }}>Backend Unavailable</div>
          )}
        </div>

        <div className="card">
          <h3>Server Timestamp</h3>
          {healthInfo ? (
            <div className="card-value" style={{ fontSize: '15px', wordBreak: 'break-all' }}>
              {new Date(healthInfo.timestamp).toLocaleTimeString()} <br />
              <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(healthInfo.timestamp).toLocaleDateString()}</span>
            </div>
          ) : (
            <div className="card-value error" style={{ fontSize: '14px' }}>No telemetrics</div>
          )}
        </div>
      </section>

      {error && (
        <div style={{ background: 'rgba(248, 113, 113, 0.1)', color: '#fca5a5', padding: '16px', borderRadius: '12px', border: '1px solid rgba(248, 113, 113, 0.2)', fontSize: '14px' }}>
          ⚠️ {error}. Ensure your Fastify server is running at port 3001.
        </div>
      )}

      <div className="actions">
        <button onClick={() => {
          checkHealth();
          fetchInfo();
        }}>Refresh Telemetry</button>
      </div>

      <footer>
        CI/CD Pipeline & Modern Application System. Fully automated & responsive.
      </footer>
    </div>
  )
}

export default App

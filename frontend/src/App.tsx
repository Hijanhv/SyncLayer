import { useState, useEffect } from 'react';
import './App.css';

interface SyncLog {
  timestamp: string;
  action: string;
  source: 'sheet' | 'db';
  rowsAffected: number;
  details: string;
}

interface SyncRow {
  id: string;
  name: string;
  email: string;
  status: string;
  version: number;
  updated_at: string;
  last_updated_by: string;
}

interface Stats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

function App() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<Stats>({ waiting: 0, active: 0, completed: 0, failed: 0 });
  const [sheetData, setSheetData] = useState<SyncRow[]>([]);
  const [dbData, setDbData] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', status: 'active' });
  const [formLoading, setFormLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/sync/logs');
      const data = await response.json();
      setLogs(data.logs.reverse().slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/sync/stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchData = async () => {
    try {
      const [sheetRes, dbRes] = await Promise.all([
        fetch('/api/data/sheet'),
        fetch('/api/data/db'),
      ]);
      
      const sheetData = await sheetRes.json();
      const dbData = await dbRes.json();
      
      setSheetData(sheetData.rows);
      setDbData(dbData.rows);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const triggerSync = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sync/trigger', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setTimeout(() => {
          fetchLogs();
          fetchStats();
          fetchData();
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchData();

    const interval = setInterval(() => {
      fetchLogs();
      fetchStats();
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    
    setFormLoading(true);
    try {
      const response = await fetch('/api/data/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setFormData({ name: '', email: '', status: 'active' });
        setTimeout(() => fetchData(), 500);
      }
    } catch (error) {
      console.error('Failed to add record:', error);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>SyncLayer</h1>
        <p>Live Two-Way Sync Between Google Sheets & MySQL</p>
      </div>

      <div className="container">
        <div className="controls">
          <h2>Add to Database</h2>
          <form onSubmit={handleAddRecord} className="add-form">
            <input 
              type="text" 
              placeholder="Name" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
            <select 
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="submit" className="btn primary" disabled={formLoading}>
              {formLoading ? 'Adding...' : '➕ Add Record'}
            </button>
          </form>
          <div className="button-group">
            <button className="btn" onClick={triggerSync} disabled={loading}>
              {loading ? 'Syncing...' : '🔄 Trigger Sync'}
            </button>
            <button className="btn" onClick={fetchData}>
              🔃 Refresh Data
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat-card">
            <h3>Waiting</h3>
            <div className="value">{stats.waiting}</div>
          </div>
          <div className="stat-card">
            <h3>Active</h3>
            <div className="value">{stats.active}</div>
          </div>
          <div className="stat-card">
            <h3>Completed</h3>
            <div className="value">{stats.completed}</div>
          </div>
          <div className="stat-card">
            <h3>Failed</h3>
            <div className="value">{stats.failed}</div>
          </div>
        </div>

        <div className="data-section">
          <div className="data-panel">
            <h2>📊 Google Sheet Data</h2>
            <div className="data-table">
              {sheetData.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Ver</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetData.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>{row.status}</td>
                        <td>{row.version}</td>
                        <td>{row.last_updated_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No data in sheet</div>
              )}
            </div>
          </div>

          <div className="data-panel">
            <h2>🗄️ MySQL Data</h2>
            <div className="data-table">
              {dbData.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Ver</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbData.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>{row.status}</td>
                        <td>{row.version}</td>
                        <td>{row.last_updated_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No data in database</div>
              )}
            </div>
          </div>
        </div>

        <div className="logs">
          <h2>📝 Sync Logs</h2>
          <div className="log-list">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`log-item ${log.action === 'error' ? 'error' : log.rowsAffected > 0 ? 'success' : ''}`}
                >
                  <span className="timestamp">[{formatTimestamp(log.timestamp)}]</span>
                  <span className="action">{log.action}</span>
                  <span>from {log.source.toUpperCase()}</span>
                  {log.rowsAffected > 0 && <span> - {log.rowsAffected} rows</span>}
                  <div>{log.details}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">No logs yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

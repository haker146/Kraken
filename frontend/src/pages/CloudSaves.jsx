import React, { useState, useEffect } from 'react';
import { Cloud, DownloadCloud, UploadCloud, Save, FolderOpen, RefreshCw, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { bridge } from '../lib/bridge';
import { useAppStore } from '../store/useAppStore';
import './CloudSaves.css';

export default function CloudSaves() {
  const [steamPath, setSteamPath] = useState('');
  const [steam32Id, setSteam32Id] = useState('');
  const [destFolder, setDestFolder] = useState('');
  
  const [appId, setAppId] = useState('');
  const [gameName, setGameName] = useState('');

  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [logs, setLogs] = useState([]);
  
  const { games } = useAppStore();

  useEffect(() => {
    const init = async () => {
      try {
        const p = await bridge.call('get_secret_setting', 'steam_path');
        const id = await bridge.call('get_secret_setting', 'steam32_id');
        const d = await bridge.call('get_secret_setting', 'cloud_local_backup_dest');
        
        if (p) setSteamPath(p);
        if (id) setSteam32Id(id);
        if (d) setDestFolder(d);
      } catch (err) {
        console.error("Failed to load settings for cloud saves:", err);
      } finally {
        setLoading(false);
      }
    };
    init();

    if (window.Bridge?.task_finished?.connect) {
      window.Bridge.task_finished.connect(handleTaskFinished);
    }
    return () => {
      try { window.Bridge?.task_finished?.disconnect(handleTaskFinished); } catch(e){}
    };
  }, []);

  const handleTaskFinished = (jsonStr) => {
    try {
      const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (res.task === 'cloud_backup' || res.task === 'cloud_restore') {
        setActiveTask(null);
        if (res.data?.logs) {
           setLogs(prev => [...prev, ...res.data.logs]);
        }
        if (res.data?.success) {
           setLogs(prev => [...prev, "Success!"]);
        } else {
           setLogs(prev => [...prev, "Error: " + (res.data?.error || "Unknown")]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const doBackup = async () => {
    if (!steamPath || !steam32Id || !appId || !gameName) {
      setLogs(["Please fill in all required fields."]);
      return;
    }
    setActiveTask('backup');
    setLogs(["Starting backup for " + gameName + "..."]);
    try {
      await bridge.call('cloud_backup', steamPath, steam32Id, appId, gameName, destFolder || '');
    } catch (e) {
      setLogs(prev => [...prev, "IPC Error: " + e.message]);
      setActiveTask(null);
    }
  };

  const doRestore = async () => {
    if (!steamPath || !steam32Id || !appId) {
      setLogs(["Please fill in all required fields."]);
      return;
    }
    setActiveTask('restore');
    setLogs(["Starting restore for App ID " + appId + "..."]);
    try {
      await bridge.call('cloud_restore', destFolder || '', steamPath, steam32Id, appId);
    } catch (e) {
      setLogs(prev => [...prev, "IPC Error: " + e.message]);
      setActiveTask(null);
    }
  };

  if (loading) {
    return (
      <div className="cloudsaves-page center">
        <RefreshCw className="spin" size={24} />
      </div>
    );
  }

  return (
    <div className="cloudsaves-page">
      <div className="cloudsaves-header">
        <div className="header-title">
          <Cloud size={28} className="icon-accent" />
          <h2>Cloud Saves</h2>
        </div>
        <p>Backup and restore your local saves to/from your configured location.</p>
      </div>

      <div className="cloudsaves-grid">
        <motion.div className="cs-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}>
          <h3>Configuration</h3>
          
          <div className="cs-field">
            <label>Steam Path</label>
            <input 
              value={steamPath}
              onChange={e => setSteamPath(e.target.value)}
              placeholder="C:\Program Files (x86)\Steam"
            />
          </div>

          <div className="cs-field">
            <label>Steam32 ID</label>
            <input 
              value={steam32Id}
              onChange={e => setSteam32Id(e.target.value)}
              placeholder="e.g. 12345678"
            />
            <p className="field-hint">Required to locate userdata folders.</p>
          </div>

          <div className="cs-field">
            <label>Backup Destination (Optional)</label>
            <input 
              value={destFolder}
              onChange={e => setDestFolder(e.target.value)}
              placeholder="Defaults to AppData/SteaMidra/save_backups"
            />
          </div>
        </motion.div>

        <motion.div className="cs-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: 0.1}}>
          <h3>Action</h3>
          
          <div className="cs-field">
            <label>Select Game (from Library)</label>
            <select 
              value={appId}
              onChange={e => {
                setAppId(e.target.value);
                const g = games.find(x => x.app_id === e.target.value);
                if (g) setGameName(g.name);
              }}
            >
              <option value="">-- Select a game --</option>
              {games.map(g => (
                <option key={g.app_id} value={g.app_id}>{g.name} ({g.app_id})</option>
              ))}
            </select>
          </div>
          
          <div className="cs-field">
             <label>App ID (Manual override)</label>
             <input value={appId} onChange={e => setAppId(e.target.value)} placeholder="App ID" />
          </div>
          
          <div className="cs-field">
             <label>Game Name (Manual override)</label>
             <input value={gameName} onChange={e => setGameName(e.target.value)} placeholder="Game Name" />
          </div>

          <div className="cs-actions">
            <button 
              className="cs-btn backup" 
              onClick={doBackup} 
              disabled={activeTask !== null}
            >
              <UploadCloud size={16} /> 
              {activeTask === 'backup' ? 'Backing up...' : 'Backup Save'}
            </button>
            <button 
              className="cs-btn restore" 
              onClick={doRestore}
              disabled={activeTask !== null}
            >
              <DownloadCloud size={16} /> 
              {activeTask === 'restore' ? 'Restoring...' : 'Restore Save'}
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div className="cs-logs" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: 0.2}}>
        <div className="logs-header">
          <Archive size={16} /> Activity Log
        </div>
        <div className="logs-body">
          {logs.length === 0 ? (
            <span className="log-empty">No activity yet.</span>
          ) : (
            logs.map((l, i) => <div key={i} className="log-line">{l}</div>)
          )}
        </div>
      </motion.div>
    </div>
  );
}

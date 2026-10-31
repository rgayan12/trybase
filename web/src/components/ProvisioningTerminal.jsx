import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, Terminal as TerminalIcon } from 'lucide-react';

const MESSAGES = [
  "Initializing Fargate container task...",
  "Allocating dedicated CPU cycles...",
  "Calibrating flux capacitors...",
  "Provisioning isolated Postgres schema...",
  "Generating secure encryption keys...",
  "Routing traffic through AWS Global Accelerator...",
  "Downloading more RAM... (Just kidding, we have plenty)",
  "Applying security group ingress rules...",
  "Verifying health check endpoints...",
  "Polishing your dedicated workspace dashboard...",
  "Optimizing runtime execution engine...",
  "Injecting secret credentials...",
  "Almost there! Infrastructure is spinning up in the background...",
  "Bribing the local AWS region to hurry up...",
  "Finalizing orchestration pipeline...",
  "Don't wanna wait? No problem. We'll email you the link as soon as it's ready!"
];

const ProvisioningTerminal = ({ status, tenantId, startedAt, finishedAt, onTriggerGame }) => {
  const [logs, setLogs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [prompted, setPrompted] = useState(false);
  const scrollRef = useRef(null);

  // Timer logic
  useEffect(() => {
    if (status === 'provisioning' && startedAt) {
      if (finishedAt) {
        const start = new Date(startedAt).getTime();
        const end = new Date(finishedAt).getTime();
        setElapsed(Math.floor((end - start) / 1000));
        return;
      }

      const interval = setInterval(() => {
        const start = new Date(startedAt).getTime();
        const now = new Date().getTime();
        setElapsed(Math.floor((now - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }

    if (status === 'active' && startedAt) {
      const start = new Date(startedAt).getTime();
      const end = finishedAt ? new Date(finishedAt).getTime() : new Date().getTime();
      setElapsed(Math.floor((end - start) / 1000));
    }
  }, [status, startedAt, finishedAt]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (status !== 'active' && currentIndex < MESSAGES.length) {
      const timer = setTimeout(() => {
        setLogs(prev => [...prev, { 
          text: MESSAGES[currentIndex], 
          time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'info'
        }]);
        setCurrentIndex(prev => prev + 1);

        // Inject Game Prompt after a few entries
        if (currentIndex === 6 && !prompted) {
          setPrompted(true);
          setTimeout(() => {
            setLogs(prev => [...prev, {
              text: "Its taking a while wanna play a game ?",
              time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: 'system_prompt'
            }]);
          }, 1500);
        }
      }, Math.random() * 3000 + 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, status, prompted]);

  // Handle the final status flip
  useEffect(() => {
    if (status === 'active' && startedAt) {
      // Calculate final execution time directly to avoid race conditions with 'elapsed' state
      let finalSeconds = 0;
      if (finishedAt) {
        finalSeconds = Math.floor((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
      } else {
        // Legacy fallback: if workspace is active but we missed the end timestamp, 
        // default to a "reasonable" 3 minutes rather than showing 500+ minutes.
        finalSeconds = 180; 
      }
      
      setLogs(prev => {
        // Prevent duplicate success messages from React 18 Strict Mode
        if (prev.some(log => log.text.includes("SUCCESS"))) return prev;
        
        return [...prev, { 
          text: `SUCCESS: Provisioning Complete! Bang, it took ${formatTime(finalSeconds)}! 🎉`, 
          time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'success'
        }];
      });

      // Also ensure the header timer is frozen at the correct value
      setElapsed(finalSeconds);
    }
  }, [status, startedAt, finishedAt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="terminal-window" style={{ 
      background: 'rgba(0,0,0,0.4)', 
      borderRadius: '12px', 
      border: '1px solid var(--border-subtle)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '350px',
      fontFamily: 'monospace'
    }}>
      <div style={{ 
        padding: '0.75rem 1rem', 
        background: 'rgba(255,255,255,0.05)', 
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <TerminalIcon size={14} className="text-secondary" />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flexGrow: 1 }}>
          Infrastructure Logs
        </span>
        {status === 'provisioning' && (
          <span style={{ fontSize: '0.8rem', color: elapsed > 120 ? '#f59e0b' : 'var(--text-secondary)', fontFamily: 'monospace' }}>
            Elapsed: {formatTime(elapsed)}
          </span>
        )}
      </div>
      
      <div 
        ref={scrollRef}
        style={{ 
          padding: '1rem', 
          overflowY: 'auto', 
          flexGrow: 1, 
          fontSize: '0.9rem',
          lineHeight: '1.6',
          color: '#8DC891'
        }}
      >
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>[{log.time}]</span>
            {log.type === 'system_prompt' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>SYSTEM:</span>
                <span style={{ color: 'white' }}>{log.text}</span>
                <button 
                  onClick={onTriggerGame}
                  style={{ 
                    background: 'var(--accent-blue)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '2px 10px', 
                    borderRadius: '4px', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  PLAY NOW
                </button>
              </div>
            ) : (
              <span style={{ color: log.type === 'success' ? '#10b981' : log.type === 'error' ? '#ef4444' : '#8DC891' }}>
                {log.text}
              </span>
            )}
          </div>
        ))}
        {status !== 'active' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader2 className="animate-spin" size={14} />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Processing...</span>
          </div>
        )}
        
        {status === 'active' && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1.5rem', 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            textAlign: 'center',
            color: 'white'
          }}>
             <h3 style={{ margin: '0 0 1rem 0', color: '#10b981' }}>Instance is Ready!</h3>
             <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>
               Your dedicated workspace is live at:
             </p>
             <a 
               href={`https://${tenantId}.trybase.io`} 
               target="_blank" 
               rel="noopener noreferrer"
               className="btn btn-primary"
               style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
             >
               Open Workspace <CheckCircle2 size={18} />
             </a>
          </div>
        )}

        {status === 'provisioning' && elapsed > 600 && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1.5rem', 
            background: 'rgba(244, 63, 94, 0.1)', 
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: '8px',
            color: 'white'
          }}>
             <h3 style={{ margin: '0 0 0.5rem 0', color: '#f43f5e' }}>Taking longer than expected...</h3>
             <p className="text-secondary" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
               Infrastructure deployment usually takes 3 minutes. If it's been over 10, something might be stuck.
             </p>
             <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
                <a 
                  href="mailto:bastiyan@blymo.co.uk?subject=Stuck Provisioning Help" 
                  className="text-accent-blue"
                  style={{ fontSize: '0.9rem' }}
                >
                  Contact Support
                </a>
                <span className="text-secondary">or</span>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Scroll up to try resetting.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvisioningTerminal;

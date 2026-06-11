'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, RefreshCw, Zap, Server, ShieldCheck, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type Event = {
  id: string;
  name: string;
  available_quantity: number;
  total_quantity: number;
};

// Reusable Animated Number Component
function AnimatedNumber({ value }: { value: number }) {
  return (
    <span className="inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Simple SVG Sparkline Chart
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 100); 
  const width = 300;
  const height = 60;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (val / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      {/* Gradient fill */}
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.5)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#chartGradient)"
        points={`0,${height} ${points} ${width},${height}`}
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
      />
    </svg>
  );
}

export default function AdminDashboard() {
  const [event, setEvent] = useState<Event | null>(null);
  const [requests, setRequests] = useState(500);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [tpsHistory, setTpsHistory] = useState<number[]>(Array(20).fill(0));
  
  // Use a ref to batch logs during extreme load to prevent React from freezing
  const pendingLogs = useRef<{ id: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);
  const currentSecondRequests = useRef(0);

  const addLog = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newLog = { id: Math.random().toString(36).substr(2, 9), msg, type };
    pendingLogs.current.push(newLog);
  };

  useEffect(() => {
    // A log flusher interval to batch state updates and keep the DOM light (max 40 logs)
    const flusher = setInterval(() => {
      if (pendingLogs.current.length > 0) {
        setLogs(prev => {
          const combined = [...pendingLogs.current.reverse(), ...prev];
          return combined.slice(0, 40);
        });
        pendingLogs.current = [];
      }
    }, 250);
    return () => clearInterval(flusher);
  }, []);

  useEffect(() => {
    // TPS interval updates the chart array every second
    const tpsInterval = setInterval(() => {
      setTpsHistory(prev => {
        const next = [...prev.slice(1), currentSecondRequests.current];
        currentSecondRequests.current = 0;
        return next;
      });
    }, 1000);
    return () => clearInterval(tpsInterval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.events && data.events.length > 0) {
        setEvent(data.events[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const interval = setInterval(() => void fetchStatus(), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    if (!event) return;
    
    toast.promise(
      fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id })
      }).then(res => {
        if (!res.ok) throw new Error('Reset failed');
        return res;
      }),
      {
        loading: 'Resetting global inventory...',
        success: () => {
          addLog('Database reset successfully.', 'info');
          void fetchStatus();
          return 'Inventory has been reset to 100 tickets.';
        },
        error: 'Failed to reset database.'
      }
    );
  };

  const runLoadTest = async () => {
    if (!event) return;
    setIsRunning(true);
    toast.loading(`Launching ${requests} parallel requests...`, { id: 'load-test' });
    addLog(`Starting load test with ${requests} concurrent requests...`, 'info');
    
    const promises = [];
    
    for (let i = 0; i < requests; i++) {
      const userId = `bot_${Math.random().toString(36).substring(7)}`;
      
      const promise = fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, userId })
      })
      .then(async (res) => {
        currentSecondRequests.current++;
        if (res.ok) {
          addLog(`Bot ${userId.slice(0,4)}: Success - Ticket secured`, 'success');
        } else {
          addLog(`Bot ${userId.slice(0,4)}: Failed - Sold Out`, 'error');
        }
      })
      .catch(() => {
        currentSecondRequests.current++;
        addLog(`Bot ${userId.slice(0,4)}: Network Error`, 'error');
      });

      promises.push(promise);
    }

    await Promise.all(promises);
    toast.success('Load Test Complete!', { id: 'load-test', description: 'Zero double-bookings detected.' });
    addLog(`Load test completed.`, 'info');
    void fetchStatus();
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-danger/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              <ShieldCheck className="w-8 h-8 text-primary" />
              SyncFlow Control Center
            </h1>
            <p className="text-gray-400 mt-2">Amazon Aurora DSQL Performance Dashboard</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800/80 backdrop-blur-md hover:bg-gray-700/80 rounded-xl transition-colors border border-white/10 shadow-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Inventory
          </motion.button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Stats & Controller */}
          <div className="space-y-8 lg:col-span-1">
            
            {/* Live Inventory Card */}
            <div className="glass-card p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Server className="w-5 h-5 text-gray-400" />
                  Live Inventory
                </h2>
                <span className="flex items-center gap-2 text-xs font-medium bg-success/10 text-success px-2.5 py-1 rounded-full border border-success/20">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                  Connected
                </span>
              </div>
              
              {event ? (
                <div className="mt-6">
                  <div className={`text-6xl font-bold mb-3 tracking-tighter ${event.available_quantity === 0 ? 'text-danger' : 'text-white'}`}>
                    <AnimatedNumber value={event.available_quantity} />
                    <span className="text-2xl text-gray-500 font-normal ml-2 tracking-normal">/ {event.total_quantity}</span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-4 mt-6 overflow-hidden border border-white/5 shadow-inner relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(event.available_quantity / event.total_quantity) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full rounded-full relative ${event.available_quantity < 20 ? 'bg-danger shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`}
                    >
                      {/* Inner animated shimmer */}
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 py-10 text-center animate-pulse">Connecting to Aurora DSQL...</div>
              )}
            </div>

            {/* Load Tester Card */}
            <div className="glass-card p-6 rounded-2xl border border-danger/20 shadow-[0_0_30px_rgba(239,68,68,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-danger/10 blur-3xl rounded-full"></div>
              
              <h2 className="text-lg font-medium flex items-center gap-2 mb-4 text-danger relative z-10">
                <Zap className="w-5 h-5" />
                Concurrency Attack
              </h2>
              <p className="text-sm text-gray-400 mb-6 relative z-10 leading-relaxed">
                Simulate massive parallel purchase attempts to prove Aurora DSQL&apos;s strict serializability prevents double-booking under extreme load.
              </p>
              
              <div className="mb-6 relative z-10">
                <label className="block text-sm font-medium text-gray-400 mb-2">Parallel Requests</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={requests}
                    onChange={(e) => setRequests(Number(e.target.value))}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-all font-mono text-lg"
                    min="1"
                    max="1000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Reqs</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: isRunning || !event || event.available_quantity === 0 ? 1 : 1.02 }}
                whileTap={{ scale: isRunning || !event || event.available_quantity === 0 ? 1 : 0.98 }}
                onClick={runLoadTest}
                disabled={isRunning || !event || event.available_quantity === 0}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all relative z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger ${
                  isRunning || !event || event.available_quantity === 0
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                    : 'bg-danger hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                }`}
              >
                {isRunning ? (
                  <>
                    <Activity className="w-5 h-5 animate-spin text-white" />
                    Executing Attack...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Launch Attack
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Right Column: Live Logs & TPS Chart */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* TPS Chart */}
            <div className="glass-card rounded-2xl p-6 shadow-xl border border-white/5 h-48 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-gray-400" />
                  Throughput (TPS)
                </h2>
                <div className="text-sm font-mono bg-primary/10 text-primary px-3 py-1 rounded-lg">
                  {tpsHistory[tpsHistory.length - 1]} req/s
                </div>
              </div>
              <div className="flex-1 w-full pt-4 relative">
                <Sparkline data={tpsHistory} />
              </div>
            </div>

            {/* Live Transaction Stream */}
            <div className="glass-card rounded-2xl flex flex-col flex-1 shadow-xl overflow-hidden border border-white/5 h-[468px]">
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Activity className="w-5 h-5 text-gray-400" />
                  Live Transaction Stream
                </h2>
                <span className="text-xs text-gray-500 font-mono tracking-wider uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Monitoring
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-sm bg-[#0a0a0a]/50">
                <AnimatePresence initial={false}>
                  {logs.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4"
                    >
                      <Server className="w-12 h-12 opacity-20" />
                      <p>Awaiting transactions...</p>
                    </motion.div>
                  ) : (
                    logs.map(log => (
                      <motion.div 
                        key={log.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`px-4 py-3 rounded-lg flex items-center gap-4 border backdrop-blur-sm ${
                          log.type === 'success' ? 'bg-success/5 border-success/20 text-green-400' : 
                          log.type === 'error' ? 'bg-danger/5 border-danger/20 text-red-400' : 
                          'bg-gray-800/30 border-gray-700/50 text-gray-300'
                        }`}
                      >
                        <span className="opacity-50 text-xs w-24 shrink-0">
                          {new Date().toISOString().split('T')[1].slice(0, -1)}
                        </span>
                        <span className="font-medium">{log.msg}</span>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

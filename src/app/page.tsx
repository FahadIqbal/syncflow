'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Ticket, AlertCircle, Timer, Download, QrCode } from 'lucide-react';
import { toast } from 'sonner';

type Event = {
  id: string;
  name: string;
  description: string;
  price: string;
  total_quantity: number;
  available_quantity: number;
};

// Beautiful animated number component for the ticket counter
function AnimatedNumber({ value, isDanger }: { value: number, isDanger: boolean }) {
  return (
    <span className={`inline-flex overflow-hidden ${isDanger ? 'text-danger' : 'text-primary'}`}>
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

// Interactive 3D Holographic VIP Ticket
function HolographicTicket({ event, userId }: { event: Event, userId: string }) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const rotateX = useTransform(y, [0, 1], [15, -15]);
  const rotateY = useTransform(x, [0, 1], [-15, 15]);
  
  const springConfig = { damping: 20, stiffness: 200 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  const backgroundPosition = useTransform(
    [x, y],
    ([latestX, latestY]: number[]) => `${latestX * 100}% ${latestY * 100}%`
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width);
    y.set(mouseY / height);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, rotateY: -90 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
      className="holo-ticket w-full max-w-sm mx-auto cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
      }}
    >
      <div className="relative glass-card rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 aspect-[1/1.6]">
        {/* Holographic Glare Layer */}
        <motion.div 
          className="absolute inset-0 holo-glare z-20"
          style={{ backgroundPosition }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent opacity-50"></div>
        
        <div className="relative z-10 p-8 h-full flex flex-col">
          <div className="flex justify-between items-start mb-auto">
            <div>
              <p className="text-primary font-mono text-xs uppercase tracking-widest mb-1">VIP Access</p>
              <h2 className="text-2xl font-bold leading-tight">{event.name}</h2>
            </div>
            <Ticket className="w-8 h-8 text-primary opacity-80" />
          </div>

          <div className="flex justify-center my-8">
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <QrCode className="w-32 h-32 text-black" />
            </div>
          </div>

          <div className="mt-auto space-y-4">
            <div className="flex justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs text-gray-400 font-medium">Ticket ID</p>
                <p className="text-sm font-mono text-white/90">{userId.toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 font-medium">Secured On</p>
                <p className="text-sm font-mono text-white/90">Aurora DSQL</p>
              </div>
            </div>
            <button className="w-full py-3 rounded-lg flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium">
              <Download className="w-4 h-4" />
              Save to Apple Wallet
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchasedTicket, setPurchasedTicket] = useState<{ event: Event, userId: string } | null>(null);
  const eventsRef = useRef(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const interval = setInterval(() => void fetchStatus(), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleBuy = async (eventId: string) => {
    setBuyingId(eventId);
    const previousEvents = eventsRef.current;
    const targetEvent = previousEvents.find(e => e.id === eventId);

    // Optimistic UI Update: instantly subtract 1
    setEvents(prev => prev.map(e => 
      e.id === eventId && e.available_quantity > 0 
        ? { ...e, available_quantity: e.available_quantity - 1 } 
        : e
    ));

    const userId = `user_${Math.random().toString(36).substring(7)}`;

    try {
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, userId })
      });
      
      if (!res.ok) {
        // Revert optimistic update
        setEvents(previousEvents);
        toast.error('Missed it! The tickets are sold out.', {
          description: 'Aurora DSQL prevented double-booking.'
        });
      } else {
        toast.success('Ticket Secured!', {
          description: 'Your transaction was perfectly synchronized.'
        });
        if (targetEvent) {
          setPurchasedTicket({ event: targetEvent, userId });
        }
      }
    } catch {
      setEvents(previousEvents);
      toast.error('Network error occurred.');
    } finally {
      setBuyingId(null);
      void fetchStatus(); // Ensure sync
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-screen relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="z-10 w-full max-w-md perspective-1000">
        <AnimatePresence mode="wait">
          {!purchasedTicket && (
            <motion.div 
              key="header"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center mb-10"
            >
              <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                SyncFlow Drops
              </h1>
              <p className="text-gray-400">Powered by AWS Aurora DSQL & Vercel</p>
            </motion.div>
          )}
        </AnimatePresence>

        {purchasedTicket ? (
          <HolographicTicket event={purchasedTicket.event} userId={purchasedTicket.userId} />
        ) : loading ? (
          <div className="glass-card rounded-2xl overflow-hidden animate-pulse">
            <div className="h-48 bg-gray-800/50"></div>
            <div className="p-6">
              <div className="h-6 bg-gray-700/50 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-700/50 rounded w-full mb-8"></div>
              <div className="flex justify-between mb-8">
                <div className="h-10 bg-gray-700/50 rounded w-1/3"></div>
                <div className="h-10 bg-gray-700/50 rounded w-1/3"></div>
              </div>
              <div className="h-14 bg-gray-700/50 rounded-xl w-full"></div>
            </div>
          </div>
        ) : events.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540039155733-d7696c66914b?q=80&w=2674&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-700"></div>
              <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium border-white/10 shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                </span>
                Live Now
              </div>
            </div>
            
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{events[0].name}</h2>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">{events[0].description}</p>
              
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                <div>
                  <p className="text-sm text-gray-400 mb-1 font-medium">Price</p>
                  <p className="text-2xl font-semibold">${events[0].price}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1 font-medium">Available</p>
                  <div className="text-2xl font-bold flex items-center justify-end gap-1">
                    <AnimatedNumber 
                      value={events[0].available_quantity} 
                      isDanger={events[0].available_quantity === 0} 
                    />
                    <span className="text-gray-500 font-normal">/ {events[0].total_quantity}</span>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: events[0].available_quantity > 0 ? 1.02 : 1 }}
                whileTap={{ scale: events[0].available_quantity > 0 ? 0.98 : 1 }}
                onClick={() => handleBuy(events[0].id)}
                disabled={buyingId === events[0].id || events[0].available_quantity === 0}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  events[0].available_quantity === 0
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark text-white shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                }`}
              >
                {buyingId === events[0].id ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : events[0].available_quantity === 0 ? (
                  'Sold Out'
                ) : (
                  <>
                    <Ticket className="w-5 h-5" />
                    Buy Ticket Now
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-10 rounded-2xl text-center shadow-2xl border border-white/5 relative overflow-hidden"
          >
            {/* Ambient inner glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
            
            <Timer className="w-16 h-16 text-primary mx-auto mb-6 opacity-80" />
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Next Drop Outbound</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Inventory is currently empty. Our next massive VIP release is being scheduled. Stay tuned to secure your ticket.
            </p>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-300">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
              Awaiting Database Seed
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}


import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAppStore } from '../store/useAppStore';
import './ToastHost.css';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

export default function ToastHost() {
  const notifications = useAppStore(s => s.notifications);
  const pushNotification = useAppStore(s => s.pushNotification);
  const dismissNotification = useAppStore(s => s.dismissNotification);

  useEffect(() => {
    const unsub = bridge.on('ui_notification', (raw) => {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data?.message) return;
        pushNotification({
          title: data.title || 'Kraken',
          message: data.message,
          kind: data.kind || 'info',
        });
      } catch { /* ignore */ }
    });
    return unsub;
  }, [pushNotification]);

  useEffect(() => {
    if (!notifications.length) return undefined;
    const timers = notifications.map(n =>
      setTimeout(() => dismissNotification(n.id), n.kind === 'error' ? 10000 : 5500)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, dismissNotification]);

  return (
    <div className="toast-host" aria-live="polite">
      <AnimatePresence>
        {notifications.slice(0, 5).map(n => {
          const Icon = ICONS[n.kind] || Info;
          return (
            <motion.div
              key={n.id}
              className={`toast-card toast-${n.kind || 'info'}`}
              initial={{ opacity: 0, x: 28, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18 }}
            >
              <Icon size={16} className="toast-icon" />
              <div className="toast-body">
                <div className="toast-title">{n.title}</div>
                <div className="toast-msg">{n.message}</div>
              </div>
              <button className="toast-close" onClick={() => dismissNotification(n.id)} aria-label="Dismiss">
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

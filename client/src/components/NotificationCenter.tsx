import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: NotificationAction;
  createdAt: number;
}

export interface NotificationOptions {
  title?: string;
  duration?: number;
  persistent?: boolean;
  action?: NotificationAction;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  notify: {
    success: (message: string, options?: NotificationOptions) => string;
    error: (message: string, options?: NotificationOptions) => string;
    warning: (message: string, options?: NotificationOptions) => string;
    info: (message: string, options?: NotificationOptions) => string;
    loading: (message: string, options?: NotificationOptions) => string;
    dismiss: (id: string) => void;
    clearAll: () => void;
  };
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Global notification dispatcher instance for non-component calls
let globalNotifyHandler: {
  add: (type: NotificationType, message: string, options?: NotificationOptions) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
} | null = null;

export const notify = {
  success: (message: string, options?: NotificationOptions) =>
    globalNotifyHandler?.add('success', message, options) || '',
  error: (message: string, options?: NotificationOptions) =>
    globalNotifyHandler?.add('error', message, options) || '',
  warning: (message: string, options?: NotificationOptions) =>
    globalNotifyHandler?.add('warning', message, options) || '',
  info: (message: string, options?: NotificationOptions) =>
    globalNotifyHandler?.add('info', message, options) || '',
  loading: (message: string, options?: NotificationOptions) =>
    globalNotifyHandler?.add('loading', message, options) || '',
  dismiss: (id: string) => globalNotifyHandler?.dismiss(id),
  clearAll: () => globalNotifyHandler?.clearAll()
};

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 4000,
  info: 5000,
  warning: 8000,
  error: 7000,
  loading: 0 // persistent by default until completed/dismissed
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const recentDedupeRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const add = useCallback((type: NotificationType, message: string, options?: NotificationOptions): string => {
    if (!message || !message.trim()) return '';

    const cleanMsg = message.trim();
    const dedupeKey = `${type}:${cleanMsg}`;
    const now = Date.now();
    const lastSeen = recentDedupeRef.current.get(dedupeKey);

    // Prevent notification loops/duplicates if fired within 3000ms
    if (lastSeen && now - lastSeen < 3000) {
      return '';
    }
    recentDedupeRef.current.set(dedupeKey, now);

    // Clean old dedupe entries
    if (recentDedupeRef.current.size > 50) {
      for (const [k, v] of recentDedupeRef.current.entries()) {
        if (now - v > 10000) recentDedupeRef.current.delete(k);
      }
    }

    const id = `notif-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = options?.duration !== undefined
      ? options.duration
      : DEFAULT_DURATIONS[type];

    const newItem: NotificationItem = {
      id,
      type,
      title: options?.title,
      message: cleanMsg,
      duration,
      persistent: options?.persistent ?? (type === 'loading' ? true : false),
      action: options?.action,
      createdAt: now
    };

    setNotifications(prev => {
      // Limit visible stack to 5 items
      const updated = [newItem, ...prev];
      return updated.slice(0, 5);
    });

    // Auto-dismiss if duration > 0 and not marked persistent
    if (duration > 0 && !options?.persistent && type !== 'loading') {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, [dismiss]);

  useEffect(() => {
    globalNotifyHandler = {
      add,
      dismiss,
      clearAll
    };
    return () => {
      globalNotifyHandler = null;
    };
  }, [add, dismiss, clearAll]);

  // Keyboard shortcut: Escape dismisses newest notification
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notifications.length > 0) {
        dismiss(notifications[0].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notifications, dismiss]);

  const contextValue: NotificationContextType = {
    notifications,
    notify: {
      success: (msg, opts) => add('success', msg, opts),
      error: (msg, opts) => add('error', msg, opts),
      warning: (msg, opts) => add('warning', msg, opts),
      info: (msg, opts) => add('info', msg, opts),
      loading: (msg, opts) => add('loading', msg, opts),
      dismiss,
      clearAll
    }
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
};

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notifications: [],
      notify
    };
  }
  return context;
}

interface NotificationContainerProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss
}) => {
  if (notifications.length === 0) return null;

  return (
    <aside
      className="toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {notifications.map(item => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </aside>
  );
};

interface ToastCardProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ item, onDismiss }) => {
  const renderIcon = () => {
    switch (item.type) {
      case 'success':
        return <CheckCircle2 size={16} className="toast-icon success" aria-hidden="true" />;
      case 'error':
        return <AlertCircle size={16} className="toast-icon error" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle size={16} className="toast-icon warning" aria-hidden="true" />;
      case 'loading':
        return <Loader2 size={16} className="toast-icon loading spin" aria-hidden="true" />;
      case 'info':
      default:
        return <Info size={16} className="toast-icon info" aria-hidden="true" />;
    }
  };

  return (
    <div
      className={`toast-card ${item.type}`}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <div className="toast-icon-wrapper">
        {renderIcon()}
      </div>

      <div className="toast-content">
        {item.title && <div className="toast-title">{item.title}</div>}
        <div className="toast-message">{item.message}</div>

        {item.action && (
          <div className="toast-action-row">
            <button
              type="button"
              className="toast-action-btn"
              onClick={() => {
                item.action?.onClick();
                onDismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="toast-dismiss-btn"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        title="Dismiss notification"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

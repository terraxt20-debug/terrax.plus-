import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global suppression of harmless browser ViewTransition abort exceptions
if (typeof window !== 'undefined') {
  const isTransitionAbort = (err: any) => {
    if (!err) return false;
    const msg = String(err.message || err || '');
    const name = String(err.name || '');
    return (
      msg.includes('Transition was skipped') ||
      msg.includes('Navigation aborted') ||
      (name === 'AbortError' && (msg.includes('Transition') || msg.includes('navigation')))
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isTransitionAbort(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event) => {
      const err = event.error || event.message;
      if (isTransitionAbort(err) || isTransitionAbort(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
    const origVt = document.startViewTransition;
    document.startViewTransition = function (cb?: () => Promise<void> | void) {
      if (document.visibilityState === 'hidden') {
        if (typeof cb === 'function') {
          try { cb(); } catch (err) {}
        }
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => {},
        } as unknown as ViewTransition;
      }
      try {
        const vt = origVt.call(document, cb);
        if (vt) {
          if (vt.finished && typeof vt.finished.catch === 'function') {
            vt.finished.catch(() => {});
          }
          if (vt.ready && typeof vt.ready.catch === 'function') {
            vt.ready.catch(() => {});
          }
        }
        return vt;
      } catch (e) {
        if (typeof cb === 'function') {
          try { cb(); } catch (cbErr) {}
        }
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => {},
        } as unknown as ViewTransition;
      }
    };
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}

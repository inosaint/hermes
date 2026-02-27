import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import styles from './App.module.css';
import FocusPage from './pages/FocusPage/FocusPage';
import { loadSettings } from './lib/settingsStorage';

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dusk' : '');
    if (!prefersDark) root.removeAttribute('data-theme');
  } else if (theme === 'dusk' || theme === 'dawn') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}

export default function App() {
  useEffect(() => {
    let cleanup;
    (async () => {
      const settings = await loadSettings();
      const theme = settings.theme || 'system';
      applyTheme(theme);

      if (theme === 'system') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        mq.addEventListener('change', handler);
        cleanup = () => mq.removeEventListener('change', handler);
      }
    })();
    return () => cleanup?.();
  }, []);

  return (
    <div className={styles.app}>
      <FocusPage />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--font-sm)',
          },
        }}
      />
    </div>
  );
}

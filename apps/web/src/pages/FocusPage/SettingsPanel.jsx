import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SettingsPanel.module.css';
import { loadSettings, saveSettings } from '../../lib/settingsStorage';
import { IS_TAURI } from '../../lib/platform';

import { getDefaultWorkspace, pickWorkspaceFolder } from '../../lib/workspaceStorage';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'system', label: 'System' },
];

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.setAttribute('data-theme', 'dusk');
    } else {
      root.removeAttribute('data-theme');
    }
  } else if (theme === 'dusk' || theme === 'dawn') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}

function ThemeIcon({ theme }) {
  if (theme === 'light') {
    // Sun icon (the old gear icon — spokes radiating from a circle)
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.9 2.9l1.1 1.1M12 12l1.1 1.1M2.9 13.1l1.1-1.1M12 4l1.1-1.1" />
      </svg>
    );
  }
  if (theme === 'dusk') {
    // Crescent moon
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6z" />
      </svg>
    );
  }
  if (theme === 'dawn') {
    // Sunrise / horizon
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 13h14" />
        <path d="M3 10a5 5 0 0 1 10 0" />
        <path d="M8 3v2" />
        <path d="M4.2 5.2l1 1" />
        <path d="M11.8 5.2l-1 1" />
      </svg>
    );
  }
  // System — monitor icon
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2" width="13" height="9" rx="1.5" />
      <path d="M6 14h4" />
      <path d="M8 11v3" />
    </svg>
  );
}

function InlineSaveInput({ label, type, value, onChange, placeholder, originalValue, onSave }) {
  const dirty = value !== originalValue;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave(value);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [value, onSave]);

  return (
    <label className={styles.label}>
      {label}
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        {(dirty || saving || saved) && (
          <button
            className={`${styles.inlineSaveBtn} ${saved ? styles.inlineSaveBtnSaved : ''}`}
            onClick={handleSave}
            disabled={saving || saved}
            type="button"
          >
            {saving && (
              <svg className={styles.saveSpinner} width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="7" cy="7" r="5.5" strokeOpacity="0.25" />
                <path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" />
              </svg>
            )}
            {saving ? '' : saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
    </label>
  );
}

const APP_VERSION = '0.3.0';

const SETTINGS_TABS = [
  { key: 'styling', label: 'Styling' },
  { key: 'llm', label: 'LLM' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'about', label: 'About' },
];

export default function SettingsPanel({ isOpen, onClose, onSettingsSaved }) {
  const [activeTab, setActiveTab] = useState('styling');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [theme, setTheme] = useState('system');
  const [originalKeys, setOriginalKeys] = useState({ anthropic: '', openai: '', workspace: '' });
  const [pickingWorkspace, setPickingWorkspace] = useState(false);
  const [devtoolsMessage, setDevtoolsMessage] = useState('');
  const [hasDebugTools, setHasDebugTools] = useState(false);
  const panelRef = useRef(null);

  // Load keys when panel opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      const applySettings = (settings) => {
        setAnthropicKey(settings.anthropicApiKey || '');
        setOpenaiKey(settings.openaiApiKey || '');
        setWorkspacePath(settings.workspacePath || '');
        setTheme(settings.theme || 'system');
        setOriginalKeys({
          anthropic: settings.anthropicApiKey || '',
          openai: settings.openaiApiKey || '',
          workspace: settings.workspacePath || '',
        });
      };

      const settings = await loadSettings();
      if (cancelled) return;
      applySettings(settings);

      // Auto-provision default workspace if none is set.
      if (IS_TAURI && !settings.workspacePath) {
        try {
          const defaultPath = await getDefaultWorkspace();
          if (cancelled) return;
          if (defaultPath) {
            const nextSettings = { ...settings, workspacePath: defaultPath };
            await saveSettings(nextSettings);
            if (cancelled) return;
            applySettings(nextSettings);
            onSettingsSaved?.(nextSettings);
          }
        } catch {
          // Fall through — user can manually set workspace later
        }
      }

      // Check if debug tools are available
      if (IS_TAURI) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const result = await invoke('has_debug_tools');
          if (!cancelled) setHasDebugTools(!!result);
        } catch {
          // not available
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, onSettingsSaved]);

  const saveField = useCallback(async (field, value) => {
    const settings = await loadSettings();
    settings[field] = typeof value === 'string' ? value.trim() : value;
    settings.theme = theme;
    await saveSettings(settings);
    setOriginalKeys((prev) => ({
      ...prev,
      [field === 'anthropicApiKey' ? 'anthropic' : field === 'openaiApiKey' ? 'openai' : 'workspace']: value,
    }));
    onSettingsSaved?.(settings);
  }, [theme, onSettingsSaved]);

  const handleThemeChange = useCallback((value) => {
    setTheme(value);
    applyTheme(value);
  }, []);

  const handlePickWorkspace = useCallback(async () => {
    if (!IS_TAURI) return;
    setPickingWorkspace(true);
    try {
      const selected = await pickWorkspaceFolder();
      if (typeof selected === 'string' && selected.trim()) {
        setWorkspacePath(selected);
        await saveField('workspacePath', selected);
      }
    } finally {
      setPickingWorkspace(false);
    }
  }, [saveField]);

  const handleOpenWorkspace = useCallback(async () => {
    if (!IS_TAURI || !workspacePath) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_in_finder', { path: workspacePath });
    } catch {
      // no-op
    }
  }, [workspacePath]);

  const handleToggleDevtools = useCallback(async () => {
    if (!IS_TAURI) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('toggle_devtools');
      setDevtoolsMessage('');
    } catch {
      setDevtoolsMessage('DevTools unavailable in this build. Start with `npm run native:dev:debugtools`.');
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {activeTab === 'styling' && (
            <>
              <div className={styles.themeSection}>
                <span className={styles.themeLabel}>Theme</span>
                <div className={styles.themeRow}>
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${styles.themeBtn} ${theme === opt.value ? styles.themeBtnActive : ''}`}
                      onClick={() => handleThemeChange(opt.value)}
                      type="button"
                      title={opt.label}
                    >
                      <ThemeIcon theme={opt.value} />
                      <span className={styles.themeBtnLabel}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </>
          )}

          {activeTab === 'llm' && (
            <>
              <span className={styles.hint}>Keys are stored locally on your device and sent with each request.</span>

              <InlineSaveInput
                label="Anthropic"
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                originalValue={originalKeys.anthropic}
                onSave={(v) => saveField('anthropicApiKey', v)}
              />

              <InlineSaveInput
                label="OpenAI"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                originalValue={originalKeys.openai}
                onSave={(v) => saveField('openaiApiKey', v)}
              />
            </>
          )}

          {activeTab === 'workspace' && (
            <>
              <span className={styles.hint}>
                Drafts are saved as markdown files per project folder and indexed in <code>.hermes/index.sqlite</code>.
              </span>

              <InlineSaveInput
                label="Folder"
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder={IS_TAURI ? '~/Documents/Hermes' : 'Available in desktop app'}
                originalValue={originalKeys.workspace}
                onSave={(v) => saveField('workspacePath', v)}
              />

              {IS_TAURI && (
                <div className={styles.workspaceActions}>
                  <button className={styles.secondaryBtn} onClick={handlePickWorkspace} type="button" disabled={pickingWorkspace}>
                    {pickingWorkspace ? 'Selecting...' : 'Select folder'}
                  </button>
                  <button className={styles.secondaryBtn} onClick={handleOpenWorkspace} type="button" disabled={!workspacePath}>
                    Open in Finder
                  </button>
                </div>
              )}

              {hasDebugTools && (
                <>
                  <button className={styles.debugBtn} onClick={handleToggleDevtools} type="button">
                    Toggle DevTools (Debug)
                  </button>
                  {devtoolsMessage && (
                    <span className={styles.debugHint}>{devtoolsMessage}</span>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'about' && (
            <>
              <div className={styles.aboutHeader}>
                <span className={styles.aboutName}>Hermes</span>
                <span className={styles.aboutVersion}>v{APP_VERSION}</span>
              </div>

              <p className={styles.aboutText}>
                A local-first AI writing tool that structures your thinking without doing the writing for you.
              </p>

              <p className={styles.aboutText}>
                Forked from{' '}
                <a href="https://dearhermes.com" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
                  dearhermes.com
                </a>{' '}
                by Kenneth{' '}
                (<a href="https://x.com/kenneth" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>X</a>
                {' / '}
                <a href="https://bsky.app/profile/ken.cv" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>Bluesky</a>)
              </p>

              <p className={styles.aboutText}>
                Built on the{' '}
                <a href="https://dearhermes.com/read/kfniw9y/what-does-a-tool-owe-you" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
                  Dignified Technology
                </a>{' '}
                design philosophy.
              </p>

              <a
                href="https://github.com/inosaint/hermes/issues"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.secondaryBtn}
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                Report an issue
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

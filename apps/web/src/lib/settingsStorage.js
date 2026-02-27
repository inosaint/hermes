import { IS_TAURI } from './platform';

const SETTINGS_KEY = 'hermes-settings';
const SETTINGS_STORE_FILE = 'hermes-settings.json';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

let tauriStorePromise = null;

async function getTauriStore() {
  if (!IS_TAURI) return null;
  if (!tauriStorePromise) {
    tauriStorePromise = import('@tauri-apps/plugin-store')
      .then(({ Store }) => Store.load(SETTINGS_STORE_FILE))
      .catch(() => null);
  }
  return tauriStorePromise;
}

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      anthropicApiKey: '',
      openaiApiKey: '',
      model: DEFAULT_MODEL,
      workspacePath: '',
    };
  }

  return {
    anthropicApiKey: typeof raw.anthropicApiKey === 'string' ? raw.anthropicApiKey : '',
    openaiApiKey: typeof raw.openaiApiKey === 'string' ? raw.openaiApiKey : '',
    model: typeof raw.model === 'string' ? raw.model : DEFAULT_MODEL,
    workspacePath: typeof raw.workspacePath === 'string' ? raw.workspacePath : '',
    theme: typeof raw.theme === 'string' ? raw.theme : 'system',
    appIcon: typeof raw.appIcon === 'string' ? raw.appIcon : 'wing',
  };
}

function loadLegacyLocalSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return normalizeSettings(parsed);
  } catch {
    return normalizeSettings(null);
  }
}

export async function loadSettings() {
  if (!IS_TAURI) return loadLegacyLocalSettings();

  const store = await getTauriStore();
  if (!store) return loadLegacyLocalSettings();

  const [anthropicApiKey, openaiApiKey, model, workspacePath, theme, appIcon] = await Promise.all([
    store.get('anthropicApiKey'),
    store.get('openaiApiKey'),
    store.get('model'),
    store.get('workspacePath'),
    store.get('theme'),
    store.get('appIcon'),
  ]);

  const settings = normalizeSettings({ anthropicApiKey, openaiApiKey, model, workspacePath, theme, appIcon });

  const legacy = loadLegacyLocalSettings();
  const hasLegacyKeys = !!legacy.anthropicApiKey || !!legacy.openaiApiKey;
  const missingStoredKeys = !settings.anthropicApiKey && !settings.openaiApiKey;

  if (hasLegacyKeys && missingStoredKeys) {
    await saveSettings(legacy);
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {
      // localStorage unavailable
    }
    return legacy;
  }

  return settings;
}

export async function saveSettings(next) {
  const settings = normalizeSettings(next);

  if (!IS_TAURI) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // localStorage unavailable
    }
    return;
  }

  const store = await getTauriStore();
  if (!store) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // localStorage unavailable
    }
    return;
  }

  await Promise.all([
    store.set('anthropicApiKey', settings.anthropicApiKey || ''),
    store.set('openaiApiKey', settings.openaiApiKey || ''),
    store.set('model', settings.model || DEFAULT_MODEL),
    store.set('workspacePath', settings.workspacePath || ''),
    store.set('theme', settings.theme || 'system'),
    store.set('appIcon', settings.appIcon || 'wing'),
  ]);
  await store.save();
}

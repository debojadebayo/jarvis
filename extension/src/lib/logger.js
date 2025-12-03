//checks whether the extension is in development mode
function isDevelopment() {
  try {
    const manifest = chrome.runtime.getManifest();
    if (manifest.update_url) return false;

    return !('update_url' in manifest);
  } catch {
    return true;
  }
}

const LOG_LEVEL = isDevelopment() ? 'debug' : 'warn';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };

export const log = {
  debug: (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.debug && console.log('[Jarvis]', ...args),
  info:  (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.info && console.info('[Jarvis]', ...args),
  warn:  (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.warn && console.warn('[Jarvis]', ...args),
  error: (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.error && console.error('[Jarvis]', ...args),
};

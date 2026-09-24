// Небольшие пользовательские настройки (язык, тема). Хранилище может быть
// недоступно (приватный режим, заблокированные cookies) — тогда молча
// работаем без него.
const PREFIX = 'mbsm:';

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* хранилище недоступно */
  }
}

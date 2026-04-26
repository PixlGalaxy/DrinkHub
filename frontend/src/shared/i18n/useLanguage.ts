import { useSyncExternalStore } from 'react';
import type { Language } from './translations';

const LANG_KEY = 'dh_game_language';

function readStored(): Language {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch { /* localStorage unavailable */ }
  return 'en';
}

let currentLang: Language = readStored();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== LANG_KEY) return;
    if ((e.newValue === 'en' || e.newValue === 'es') && e.newValue !== currentLang) {
      currentLang = e.newValue;
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Language {
  return currentLang;
}

const setLang = (l: Language) => {
  if (l === currentLang) return;
  currentLang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  emit();
};

export function useLanguage(): [Language, (l: Language) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [lang, setLang];
}

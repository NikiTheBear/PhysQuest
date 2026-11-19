import { useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

const KEY = 'physquest.theme.v1';

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
}

function resolved(t: Theme): 'light' | 'dark' {
  if (t !== 'auto') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', resolved(t));
}

/** 挂上主题，自动跟随系统切换 */
export function useTheme(t: Theme) {
  useEffect(() => {
    applyTheme(t);
    if (t !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [t]);
}

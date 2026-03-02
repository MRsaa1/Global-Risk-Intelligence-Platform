/**
 * useRivaTts — Озвучка алертов и отчётов.
 * Сначала пробует NVIDIA Riva TTS; при 503/ошибке — озвучивает через браузер (Web Speech API).
 * Текст интерфейса на русском.
 */
import { useState, useCallback } from 'react';
import { getApiV1Base } from '../config/env';

const ERROR_MESSAGES_RU: Record<string, string> = {
  'Not authenticated': 'Войдите в систему для озвучки',
  'Could not validate credentials': 'Войдите в систему для озвучки',
  'Unauthorized': 'Войдите в систему для озвучки',
  'Riva is disabled or not configured': 'Сервис озвучки недоступен',
  'Riva TTS unavailable or failed': 'Сервис озвучки недоступен',
  'No audio returned': 'Нет аудио',
  'Playback failed': 'Ошибка воспроизведения',
};

function toRussianError(msg: string): string {
  const lower = msg.toLowerCase();
  for (const [en, ru] of Object.entries(ERROR_MESSAGES_RU)) {
    if (lower.includes(en.toLowerCase())) return ru;
  }
  return msg || 'Ошибка озвучки';
}

/** Озвучка через встроенный синтез речи браузера (работает без Riva). */
function speakWithBrowser(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Озвучка в браузере недоступна'));
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ru' || lang.startsWith('ru') ? 'ru-RU' : lang || 'en-US';
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => reject(new Error('Ошибка воспроизведения'));
    window.speechSynthesis.speak(u);
  });
}

export function useRivaTts() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (text: string, language?: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      setError('Нет текста для озвучки');
      return;
    }
    setError(null);
    setIsPlaying(true);
    const lang = language || 'en-US';

    try {
      const url = `${getApiV1Base()}/nvidia/riva/tts`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: trimmed, language: lang }),
      });

      if (res.ok) {
        const data = await res.json();
        const b64 = data?.audio_base64;
        if (!b64) throw new Error('No audio returned');
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const format = (data?.format || 'wav').toLowerCase();
        const mime = format === 'wav' ? 'audio/wav' : format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
        const blob = new Blob([bytes], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Playback failed'));
          };
          audio.play().catch(reject);
        });
        return;
      }

      // 503 или другая ошибка API — озвучиваем через браузер
      if (res.status === 503 || res.status === 502 || res.status === 504) {
        await speakWithBrowser(trimmed, lang);
        return;
      }

      const detail = (await res.json().catch(() => ({}))).detail ?? res.statusText;
      throw new Error(typeof detail === 'string' ? detail : 'Ошибка озвучки');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Если это ошибка Riva/сети — пробуем озвучку браузером
      if (msg && !msg.includes('No audio') && !msg.includes('Playback')) {
        try {
          await speakWithBrowser(trimmed, lang);
          return;
        } catch {
          // показать ошибку ниже
        }
      }
      setError(toRussianError(msg || 'Ошибка озвучки'));
    } finally {
      setIsPlaying(false);
    }
  }, []);

  return { speak, isPlaying, error };
}

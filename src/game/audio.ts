const SOUND_FILES = {
  correct: 'correct.mp3',
  incorrect: 'incorrect.mp3',
  gameFinished: 'game-finished.mp3',
  gameOverFail: 'game-over-fail.mp3',
} as const;

export type SoundName = keyof typeof SOUND_FILES;

const STORAGE_KEY = 'ttcguessr:muted';
const cache = new Map<SoundName, HTMLAudioElement>();

let muted = localStorage.getItem(STORAGE_KEY) === 'true';

function getAudio(name: SoundName): HTMLAudioElement {
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}sounds/${SOUND_FILES[name]}`);
    cache.set(name, audio);
  }
  return audio;
}

export function playSound(name: SoundName): void {
  if (muted) return;
  const audio = getAudio(name);
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem(STORAGE_KEY, String(value));
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

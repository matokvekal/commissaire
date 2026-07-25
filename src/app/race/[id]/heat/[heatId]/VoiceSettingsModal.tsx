import styles from './voiceSettingsModal.module.css';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface VoiceSettingsModalProps {
  onClose: () => void;
}

/**
 * iOS home-screen PWAs (standalone WebView) do NOT support the Web Speech API,
 * so voice recognition silently fails there. Detect it so we can tell the user
 * to open the page in Safari instead, where recognition works.
 */
function isIosStandalonePwa(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIphoneOrIpod = /iP(hone|od)/.test(ua);
  // iPadOS 13+ reports as "Mac"; distinguish real iPads by touch support.
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isIos = isIphoneOrIpod || isIpad;
  const isStandalone =
    (navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  return isIos && isStandalone;
}

export function VoiceSettingsModal({ onClose }: VoiceSettingsModalProps) {
  const { settings, setLanguage, setAutoConfirm } = useVoiceSettingsStore();
  const iosPwa = isIosStandalonePwa();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Voice Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {iosPwa && (
            <div className={styles.iosWarning}>
              ⚠️ On iPhone/iPad, voice input does not work in the installed app.
              Open this page in <strong>Safari</strong> to use voice.
            </div>
          )}

          <div className={styles.section}>
            <label className={styles.label}>Language</label>
            <div className={styles.languageToggle}>
              <button
                className={`${styles.languageBtn} ${settings.language === 'en' ? styles.active : ''}`}
                onClick={() => setLanguage('en')}
              >
                English
              </button>
              <button
                className={`${styles.languageBtn} ${settings.language === 'he' ? styles.active : ''}`}
                onClick={() => setLanguage('he')}
              >
                עברית
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Engine</label>
            <div className={styles.engineInfo}>
              <span className={styles.badge}>Web Speech API</span>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Auto-Confirm</label>
            <div className={styles.toggleContainer}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.autoConfirm}
                  onChange={(e) => setAutoConfirm(e.target.checked)}
                />
                <span>Auto-record lap on spoken bib number</span>
              </label>
              <p className={styles.hint}>
                {settings.autoConfirm
                  ? 'Experimental — speaking a bib number records the lap immediately, same as tapping the rider. Not 100% reliable yet, so double-check the board. Every spoken bib is also saved to the voice buffer (the list icon next to the mic on Live) so you can review what was heard.'
                  : 'Assist mode: speaking a bib number records nothing by itself — it only gets saved to the voice buffer (tap the list icon next to the mic on Live to see the last 30 bibs heard, with the time). Useful when riders arrive faster than you can write bibs down by hand.'}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeModalBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

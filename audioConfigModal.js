/**
 * =============================================================================
 * Dictionario IALA - Dialogo de Configuration de Voce e Audio (TTS Modal)
 * =============================================================================
 * 
 * Modulo independente que gere le fenestra modal pro seliger le voce (Neural2-E / Neural2-F),
 * regular le velocitate de synthese (speakingRate) e testar le audio in directo.
 */

(function(global) {
  'use strict';

  function initAudioConfigModal() {
    // Verificar si le modal ja existe in le DOM
    if (document.getElementById('modal-tts-config-backdrop')) return;

    // Crear le structura HTML del modal in stilo Windows 95 e Moderno
    const modalHtml = `
      <div class="modal-backdrop" id="modal-tts-config-backdrop" role="dialog" aria-modal="true" aria-labelledby="tts-config-modal-title">
        <div class="win95-dialog" style="max-width: 460px;">
          
          <!-- Titlebar -->
          <div class="win95-titlebar modal-titlebar">
            <div class="win95-titlebar-text">
              <span class="win95-titlebar-icon">🔊</span>
              <span id="tts-config-modal-title">Configuration de Audio &amp; Voce</span>
            </div>
            <div class="win95-titlebar-controls">
              <button class="win95-btn win95-title-btn win-close-btn" id="tts-config-close" aria-label="Clauder">✕</button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body-wrapper">
            <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 14px;">
              <div style="font-size: 2.2rem; line-height: 1;">🎙️</div>
              <div>
                <h3 style="margin: 0 0 3px; font-size: 1.05rem; font-weight: 700; color: var(--win-text);">
                  Voces Neural Google Cloud (IALA)
                </h3>
                <div style="font-size: 11.5px; color: var(--win-text-muted);">
                  Synthese per phonemas IPA e regulas del UMI
                </div>
              </div>
            </div>

            <!-- Seleccion de Voce -->
            <div class="win95-inset-box" style="padding: 12px; margin-bottom: 14px;">
              <label style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--win-text-muted); display: block; margin-bottom: 8px;">
                Voce de Interlingua
              </label>
              
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="tts-voice-radio" value="it-IT-Neural2-E" id="voice-opt-e" style="cursor: pointer;">
                  <span><strong>it-IT-Neural2-E</strong> &bull; Voce Feminina (Predefinite)</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="tts-voice-radio" value="it-IT-Neural2-F" id="voice-opt-f" style="cursor: pointer;">
                  <span><strong>it-IT-Neural2-F</strong> &bull; Voce Masculina</span>
                </label>
              </div>
            </div>

            <!-- Velocitate de Parola (Speaking Rate) -->
            <div class="win95-inset-box" style="padding: 12px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="tts-rate-slider" style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--win-text-muted);">
                  Velocitate de Parola
                </label>
                <span id="tts-rate-value" style="font-size: 12px; font-weight: 700; color: var(--win-accent-blue);">0.95x</span>
              </div>
              <input type="range" id="tts-rate-slider" min="0.70" max="1.30" step="0.05" value="0.95" style="width: 100%; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: var(--win-text-muted); margin-top: 4px;">
                <span>0.70x (Lente)</span>
                <span>0.95x (Normal)</span>
                <span>1.30x (Rapide)</span>
              </div>
            </div>

            <!-- Limite de Rata Nota -->
            <div style="font-size: 11px; color: var(--win-text-muted); line-height: 1.45; margin-bottom: 14px;">
              ℹ️ <strong>Securitate:</strong> Synthese directe con limite de securitate de 100 characteres per reproduction. Audio es immagasinate in cache local pro acceleration instantanee.
            </div>

            <!-- Actiones -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px solid var(--border-subtle, #d1d5db); padding-top: 12px;">
              <button id="tts-test-btn" class="win95-btn btn-action" style="padding: 5px 12px; font-size: 12px;">
                ▶ Proba de Voce
              </button>
              <div style="display: flex; gap: 8px;">
                <button id="tts-save-btn" class="win95-btn modal-ok-btn" style="min-width: 80px; font-weight: 700;">
                  Salvar
                </button>
                <button id="tts-cancel-btn" class="win95-btn" style="min-width: 70px;">
                  Cancellar
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = modalHtml;
    document.body.appendChild(container.firstElementChild);

    bindEvents();
  }

  function bindEvents() {
    const backdrop = document.getElementById('modal-tts-config-backdrop');
    const closeBtn = document.getElementById('tts-config-close');
    const cancelBtn = document.getElementById('tts-cancel-btn');
    const saveBtn = document.getElementById('tts-save-btn');
    const testBtn = document.getElementById('tts-test-btn');
    const rateSlider = document.getElementById('tts-rate-slider');
    const rateValue = document.getElementById('tts-rate-value');

    function closeModal() {
      backdrop.classList.remove('open');
      if (global.GoogleTTS && typeof global.GoogleTTS.stop === 'function') {
        global.GoogleTTS.stop();
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (backdrop) {
      backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) closeModal();
      });
    }

    if (rateSlider && rateValue) {
      rateSlider.addEventListener('input', function() {
        rateValue.textContent = parseFloat(rateSlider.value).toFixed(2) + 'x';
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', function() {
        const checkedVoice = document.querySelector('input[name="tts-voice-radio"]:checked');
        const voiceId = checkedVoice ? checkedVoice.value : 'it-IT-Neural2-E';
        const rate = parseFloat(rateSlider.value) || 0.95;

        testBtn.disabled = true;
        testBtn.textContent = '⏳ Sonante...';

        if (global.GoogleTTS && typeof global.GoogleTTS.speak === 'function') {
          global.GoogleTTS.speak('Benvenite al Dictionario de Interlingua.', {
            voice: voiceId,
            speakingRate: rate,
            onEnd: function() {
              testBtn.disabled = false;
              testBtn.textContent = '▶ Proba de Voce';
            },
            onError: function() {
              testBtn.disabled = false;
              testBtn.textContent = '▶ Proba de Voce';
            }
          });
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        const checkedVoice = document.querySelector('input[name="tts-voice-radio"]:checked');
        const voiceId = checkedVoice ? checkedVoice.value : 'it-IT-Neural2-E';
        const rate = parseFloat(rateSlider.value) || 0.95;

        if (global.GoogleTTS) {
          global.GoogleTTS.setVoice(voiceId);
          global.GoogleTTS.setSpeakingRate(rate);
        }

        closeModal();
      });
    }
  }

  function openModal() {
    initAudioConfigModal();
    const backdrop = document.getElementById('modal-tts-config-backdrop');
    if (!backdrop) return;

    // Actualisar valores currente
    if (global.GoogleTTS) {
      const curVoice = global.GoogleTTS.getVoice();
      const radio = document.querySelector(`input[name="tts-voice-radio"][value="${curVoice}"]`);
      if (radio) radio.checked = true;

      const curRate = global.GoogleTTS.getSpeakingRate();
      const slider = document.getElementById('tts-rate-slider');
      const valLabel = document.getElementById('tts-rate-value');
      if (slider) slider.value = curRate;
      if (valLabel) valLabel.textContent = curRate.toFixed(2) + 'x';
    }

    backdrop.classList.add('open');
  }

  // Exponer API del modulo
  const AudioConfigModal = {
    open: openModal,
    init: initAudioConfigModal
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioConfigModal;
  }
  global.AudioConfigModal = AudioConfigModal;

  // Auto-init post carga del DOM
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAudioConfigModal);
    } else {
      initAudioConfigModal();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);

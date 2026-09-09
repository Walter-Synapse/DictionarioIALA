import type { VerbParadigm, AdjParadigm, NounParadigm, AnalysisResult, RawDictEntry } from './types/global';
import { DICTIONARIO_DATA } from './data/data';
import './conjugator';
import './transcriber';
import './tts';
import './components/AudioConfigModal';

(function() {
  const data: readonly RawDictEntry[] = DICTIONARIO_DATA;
  const morpho = window.IALAConjugator;

  // Indices rapide de Verbos, Adjectivos, Substantivos, Adverbios e Multi-entrattas (prototype-safe)
  const dictMap = Object.create(null) as Record<string, readonly [string, string, string, string?, string?]>;
  const dictMulti = Object.create(null) as Record<string, Array<readonly [string, string, string, string?, string?]>>;
  const verbMap = Object.create(null) as Record<string, number>;
  const adjMap = Object.create(null) as Record<string, number>;
  const sbMap = Object.create(null) as Record<string, number>;
  const advMap = Object.create(null) as Record<string, number>;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;
    const wordLower = (item[0] || '').toLowerCase();
    const pos = (item[1] || '').toLowerCase();

    if (!dictMulti[wordLower]) dictMulti[wordLower] = [];
    dictMulti[wordLower]!.push(item);

    dictMap[wordLower] = item;
    if (pos.includes('vb')) verbMap[wordLower] = i;
    if (pos.includes('adj')) adjMap[wordLower] = i;
    if (pos.includes('sb')) sbMap[wordLower] = i;
    if (pos.includes('adv')) advMap[wordLower] = i;
  }

  // Contractiones canonicas e particulas essentiales (IALA §17, §21)
  dictMulti['al'] = [['al', 'prep + art def', '']];
  dictMulti['del'] = [['del', 'prep + art def', '']];
  dictMulti['iala'] = [['IALA', 'npr (acronymo)', '']];

  const vocabList = Object.keys(dictMulti);

  // Stato
  let currentView = 'search'; // 'search' o 'analyzer'
  let searchTerm = '';
  let activeLetter = 'ALL';
  let activePos = 'ALL';
  let matchMode = 'prefix'; // 'prefix', 'exact', 'contains'
  let stressFilter = 'ALL'; // 'ALL', 'stressed', 'regular'
  let currentPage = 1;
  const pageSize = 48;
  let filteredIndices: number[] = [];

  // Elementos DOM - Tabs de Navigation
  const tabBtnSearch = document.getElementById('tab-btn-search') as HTMLButtonElement | null;
  const tabBtnAnalyzer = document.getElementById('tab-btn-analyzer') as HTMLButtonElement | null;
  const viewDictionary = document.getElementById('view-dictionary') as HTMLElement | null;
  const viewAnalyzer = document.getElementById('view-analyzer') as HTMLElement | null;

  // Elementos DOM - Vista de Busca
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement | null;
  const searchStats = document.getElementById('search-stats') as HTMLElement | null;
  const wordsGrid = document.getElementById('words-grid') as HTMLElement | null;
  const paginationContainer = document.getElementById('pagination') as HTMLElement | null;
  const alphaNav = document.getElementById('alphabet-nav') as HTMLElement | null;
  const morphologyBanner = document.getElementById('morphology-banner') as HTMLElement | null;

  // Elementos DOM - Vista de Analysator
  const analyzerInputText = document.getElementById('analyzer-input-text') as HTMLTextAreaElement | null;
  const btnAnalyzeRun = document.getElementById('btn-analyze-run') as HTMLButtonElement | null;
  const btnAnalyzeSample = document.getElementById('btn-analyze-sample') as HTMLButtonElement | null;
  const btnAnalyzeClear = document.getElementById('btn-analyze-clear') as HTMLButtonElement | null;
  const analyzerOutputArea = document.getElementById('analyzer-output-area') as HTMLElement | null;
  const analyzerStatsBadges = document.getElementById('analyzer-stats-badges') as HTMLElement | null;
  const interactiveReaderBody = document.getElementById('interactive-reader-body') as HTMLElement | null;
  const inspectorContent = document.getElementById('inspector-content') as HTMLElement | null;

  // Elementos del Modal
  const modalBackdrop = document.getElementById('modal-backdrop') as HTMLElement | null;
  const modalClose = document.getElementById('modal-close') as HTMLButtonElement | null;
  const modalWordTitle = document.getElementById('modal-word-title') as HTMLElement | null;
  const modalPosTag = document.getElementById('modal-pos-tag') as HTMLElement | null;
  const modalPronunciation = document.getElementById('modal-pronunciation') as HTMLElement | null;
  const modalDefinitions = document.getElementById('modal-definitions') as HTMLElement | null;
  const modalSpeakBtn = document.getElementById('modal-speak-btn') as HTMLButtonElement | null;
  const modalCopyBtn = document.getElementById('modal-copy-btn') as HTMLButtonElement | null;
  const modalIEDLink = document.getElementById('modal-ied-link') as HTMLAnchorElement | null;
  const modalMorphologySection = document.getElementById('modal-morphology-section') as HTMLElement | null;

  const themeToggle = document.getElementById('theme-toggle') as HTMLElement | null;
  const styleToggle = document.getElementById('style-toggle') as HTMLElement | null;

  let currentModalWord: string | null = null;
  let currentAnalyzedTokens: AnalysisResult[] = [];

  // Commutator de Vistas
  function switchView(view: string): void {
    currentView = view;
    if (view === 'search') {
      tabBtnSearch!.classList.add('active');
      tabBtnAnalyzer!.classList.remove('active');
      (viewDictionary as HTMLElement).style.display = 'block';
      (viewAnalyzer as HTMLElement).style.display = 'none';
    } else {
      tabBtnAnalyzer!.classList.add('active');
      tabBtnSearch!.classList.remove('active');
      (viewDictionary as HTMLElement).style.display = 'none';
      (viewAnalyzer as HTMLElement).style.display = 'block';
    }
  }

  tabBtnSearch!.addEventListener('click', () => switchView('search'));
  tabBtnAnalyzer!.addEventListener('click', () => switchView('analyzer'));

  // Navigation alphabetic
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  function renderAlphabetNav(): void {
    let html = `<button class="alpha-btn active" data-letter="ALL">Tote</button>`;
    alphabet.forEach(letter => {
      html += `<button class="alpha-btn" data-letter="${letter}">${letter}</button>`;
    });
    alphaNav!.innerHTML = html;

    alphaNav!.addEventListener('click', function(e: MouseEvent) {
      if (!e.target) return;
      const btn = (e.target as Element).closest('button[data-letter]') as HTMLButtonElement | null;
      if (!btn) return;
      alphaNav!.querySelectorAll('button').forEach(function(b: Element) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      activeLetter = btn.dataset['letter'] ?? 'ALL';
      currentPage = 1;
      filterData();
    });
  }

  // POS Class resolver
  function getPosClass(pos: string | undefined): string {
    if (!pos) return 'pos-other';
    const p = pos.toLowerCase();
    if (p.includes('sb')) return 'pos-sb';
    if (p.includes('vb')) return 'pos-vb';
    if (p.includes('adj')) return 'pos-adj';
    if (p.includes('adv')) return 'pos-adv';
    if (p.includes('num')) return 'pos-num';
    return 'pos-other';
  }

  function getPosLabel(pos: string | undefined): string {
    if (!pos) return 'General';
    return pos;
  }

  function renderVerbParadigmHTML(p: VerbParadigm | null, highlightWord = ''): string {
    if (!p) return '';
    const h = (highlightWord || '').toLowerCase().trim();

    function hl(text: string, isWord = false): string {
      if (!text) return '';
      if (!h) return text;
      // If direct match or text contains the searched word
      const textLower = text.toLowerCase();
      if (textLower === h || (isWord && textLower.startsWith(h))) {
        return `<span class="matched-form-highlight">${text}</span>`;
      }
      if (textLower.includes(h)) {
        // Highlight just the token or phrase
        const reg = new RegExp(`\\b(${h})\\b`, 'gi');
        if (reg.test(text)) {
          return text.replace(reg, '<span class="matched-form-highlight">$1</span>');
        }
      }
      return text;
    }

    return `
      <table class="verb-paradigm-table">
        <thead>
          <tr>
            <th>Tempore / Modo</th>
            <th>Forma Active Simple</th>
            <th>Forma Active Perfecte</th>
            <th>Forma Passive Simple</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Presente</strong></td>
            <td><strong>${hl(p.active_simple.presente)}</strong></td>
            <td>${hl(p.active_perfecte.presente)}</td>
            <td>${hl(p.passive_simple.presente)}</td>
          </tr>
          <tr>
            <td><strong>Passato</strong></td>
            <td><strong>${hl(p.active_simple.passato)}</strong></td>
            <td>${hl(p.active_perfecte.passato)}</td>
            <td>${hl(p.passive_simple.passato)}</td>
          </tr>
          <tr>
            <td><strong>Futuro</strong></td>
            <td><strong>${hl(p.active_simple.futuro)}</strong></td>
            <td>${hl(p.active_perfecte.futuro)}</td>
            <td>${hl(p.passive_simple.futuro)}</td>
          </tr>
          <tr>
            <td><strong>Conditional</strong></td>
            <td><strong>${hl(p.active_simple.conditional)}</strong></td>
            <td>${hl(p.active_perfecte.conditional)}</td>
            <td>${hl(p.passive_simple.conditional)}</td>
          </tr>
          <tr>
            <td><strong>Imperativo</strong></td>
            <td colspan="3"><strong>${hl(p.imperative)}</strong> (sin subjecto / emphatic)</td>
          </tr>
          <tr>
            <td><strong>Participios</strong></td>
            <td colspan="3">
              Presente: <strong>${hl(p.part_pres)}</strong> &bull; 
              Passate: <strong>${hl(p.part_pass)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  function renderAdjectiveParadigmHTML(adjData: AdjParadigm | null, highlightWord = ''): string {
    if (!adjData) return '';
    const h = (highlightWord || '').toLowerCase().trim();

    function hl(text: string): string {
      if (!text || !h) return text;
      const textLower = text.toLowerCase();
      if (textLower === h || textLower.includes(h)) {
        const reg = new RegExp(`\\b(${h})\\b`, 'gi');
        if (reg.test(text)) return text.replace(reg, '<span class="matched-form-highlight">$1</span>');
        return `<span class="matched-form-highlight">${text}</span>`;
      }
      return text;
    }

    let irregNotice = '';
    if (adjData.irregular && typeof adjData.irregular === 'object') {
      const irr = adjData.irregular as { comp?: string; sup?: string; adv?: string; advComp?: string };
      irregNotice = `
        <div style="margin-top: 10px; padding: 8px 12px; background: rgba(245, 158, 11, 0.12); border-left: 3px solid var(--accent-amber); border-radius: 4px; font-size: 0.85rem;">
          <strong>Synonymos Irregular (IALA §37, §47):</strong> Comparativo: <strong>${hl(irr.comp ?? '')}</strong> &bull; Superlativo: <strong>${hl(irr.sup ?? '')}</strong> &bull; Adverbio: <strong>${hl(irr.adv ?? '')}</strong> (${irr.advComp ? hl(irr.advComp) : ''})
        </div>
      `;
    }

    return `
      <table class="verb-paradigm-table">
        <thead>
          <tr>
            <th>Grado / Categoria</th>
            <th>Forma Regular (IALA §§34-45)</th>
            <th>Signification / Uso</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Positivo</strong></td>
            <td><strong>${hl(adjData.adjective)}</strong></td>
            <td>Forma base invariabile (nulle accordo de genere o numero)</td>
          </tr>
          <tr>
            <td><strong>Comparativo Superior</strong></td>
            <td><strong>${hl(adjData.compPos)}</strong></td>
            <td>plus + adjectivo (§34)</td>
          </tr>
          <tr>
            <td><strong>Comparativo Inferior</strong></td>
            <td><strong>${hl(adjData.compNeg)}</strong></td>
            <td>minus + adjectivo (§34)</td>
          </tr>
          <tr>
            <td><strong>Superlativo Relative</strong></td>
            <td><strong>${hl(adjData.supPos)}</strong></td>
            <td>le plus + adjectivo (§34)</td>
          </tr>
          <tr>
            <td><strong>Superlativo Absolute</strong></td>
            <td><strong>${hl(adjData.absSup)}</strong></td>
            <td>Suffixo synthetic <em>-issime</em> / <em>-hissime</em> (§36)</td>
          </tr>
          <tr>
            <td><strong>Adverbio Derivate</strong></td>
            <td><strong>${hl(adjData.adverb)}</strong></td>
            <td>Adjectivo + suffixo <em>-mente</em> / <em>-amente</em> (§45)</td>
          </tr>
          <tr>
            <td><strong>Substantivation</strong></td>
            <td>
              ${adjData.isInvariantSubstantive 
                ? `<strong>${hl(adjData.substantiveM)}</strong> (invariabile)` 
                : `<strong>${hl(adjData.substantiveM)}</strong> (masc/abstr.) &bull; <strong>${hl(adjData.substantiveF)}</strong> (fem.)`}
            </td>
            <td>${adjData.substantivationNote || 'Adjectivos usate como substantivos (IALA §§38-41)'}</td>
          </tr>
        </tbody>
      </table>
      ${irregNotice}
    `;
  }

  function renderNounParadigmHTML(nounData: NounParadigm | null, highlightWord = ''): string {
    if (!nounData) return '';
    const h = (highlightWord || '').toLowerCase().trim();

    function hl(text: string): string {
      if (!text || !h) return text;
      const textLower = text.toLowerCase();
      if (textLower === h || textLower.includes(h)) {
        return `<span class="matched-form-highlight">${text}</span>`;
      }
      return text;
    }

    return `
      <table class="verb-paradigm-table">
        <thead>
          <tr>
            <th>Numero</th>
            <th>Forma</th>
            <th>Regula IALA (§§21-25)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Singular</strong></td>
            <td><strong>${hl(nounData.singular)}</strong></td>
            <td>Forma primari</td>
          </tr>
          <tr>
            <td><strong>Plural</strong></td>
            <td><strong>${hl(nounData.plural)}</strong></td>
            <td>${nounData.rule}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  function checkMorphologyMatch(term: string): string | null {
    if (!term || term.length < 2 || !morpho || !morphologyBanner) {
      if (morphologyBanner) {
        morphologyBanner.style.display = 'none';
        morphologyBanner.innerHTML = '';
      }
      return null;
    }

    // Evalutia si le termino de cerca coincide con ulle patron morphologic
    const match = morpho.deconstructUniversal(term, dictMap, verbMap, adjMap, sbMap);
    if (!match) {
      morphologyBanner.style.display = 'none';
      morphologyBanner.innerHTML = '';
      return null;
    }

    morphologyBanner.style.display = 'block';

    if (match.category === 'ia_verb' && match.data) {
      const v = match.data;
      const p = v.paradigm;
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">📖</div>
            <div>
              <div class="banner-title">Deconjugation Verbal: <em>${v.sourceWord}</em></div>
              <div class="banner-subtitle">
                Identificate como <strong>${v.tense}</strong> &bull; Formula: <code>${v.formula}</code>
              </div>
            </div>
          </div>
          <span class="banner-badge">Verbo IALA §115</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Infinitivo (Forma Base)</div>
            <div class="insight-val accent">${v.infinitive} <small style="font-size:0.8rem; color:var(--text-muted);">(radice: ${p ? p.stem : ''}-)</small></div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Tempore / Construction</div>
            <div class="insight-val accent">${v.tense}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">${v.equivalent ? 'Forma Collateral (§108)' : 'Tempore Presente (§99)'}</div>
            <div class="insight-val">${v.equivalent || (p ? p.active_simple.presente : '')}</div>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <strong style="font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">
            Tabula Complete pro "${v.infinitive}" (IALA §115)
          </strong>
          <div class="verb-table-container">${renderVerbParadigmHTML(p || null, v.sourceWord)}</div>
        </div>
      `;
      return v.infinitive;
    }

    if (match.category === 'adverb_mente' && match.paradigm) {
      const p = match.paradigm as AdjParadigm;
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">✨</div>
            <div>
              <div class="banner-title">Deconstruction de Adverbio: <em>${match.sourceWord}</em></div>
              <div class="banner-subtitle">
                Derivate del adjectivo <strong>${match.baseAdjective}</strong> &bull; Formula: <code>${match.formula}</code>
              </div>
            </div>
          </div>
          <span class="banner-badge">Adverbio IALA §45</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Adjectivo Radice</div>
            <div class="insight-val accent">${match.baseAdjective}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Superlativo Absolute</div>
            <div class="insight-val">${p.absSup}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Comparativo</div>
            <div class="insight-val">${p.compPos}</div>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <strong style="font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">
            Paradigma del Adjectivo "${match.baseAdjective}" (IALA §§34-45)
          </strong>
          <div class="verb-table-container">${renderAdjectiveParadigmHTML(p, match.sourceWord)}</div>
        </div>
      `;
      return match.baseAdjective ?? null;
    }

    if ((match.category === 'ia_superlative' || match.category === 'es_superlative') && match.paradigm) {
      const p = match.paradigm as AdjParadigm;
      const baseAdjVal = match.baseAdjective || match.iaWord || '';
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">💎</div>
            <div>
              <div class="banner-title">Superlativo Absolute Detectate: <em>${match.sourceWord}</em></div>
              <div class="banner-subtitle">
                Radice adjectival: <strong>${baseAdjVal}</strong> &bull; Formula: <code>${match.formula || '-issime'}</code>
              </div>
            </div>
          </div>
          <span class="banner-badge">Superlativo IALA §36</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Adjectivo Base</div>
            <div class="insight-val accent">${baseAdjVal}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Superlativo Synthetic</div>
            <div class="insight-val accent">${p.absSup}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Superlativo Analytic</div>
            <div class="insight-val">${p.supPos}</div>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <strong style="font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">
            Grados de Comparation de "${baseAdjVal}" (IALA §§34-36)
          </strong>
          <div class="verb-table-container">${renderAdjectiveParadigmHTML(p, match.sourceWord)}</div>
        </div>
      `;
      return baseAdjVal;
    }

    if (match.category === 'ia_plural' && match.nounData) {
      const n = match.nounData;
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">📚</div>
            <div>
              <div class="banner-title">Depluralisation de Substantivo: <em>${match.sourceWord}</em></div>
              <div class="banner-subtitle">
                Forma singular identificata: <strong>${n.singular}</strong> &bull; ${match.rule}
              </div>
            </div>
          </div>
          <span class="banner-badge">Substantivo IALA §§21-25</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Forma Singular (Radice)</div>
            <div class="insight-val accent">${n.singular}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Forma Plural Regular</div>
            <div class="insight-val accent">${n.plural}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Articulo Plural</div>
            <div class="insight-val">le ${n.plural}</div>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <strong style="font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">
            Flexion de Numero pro "${n.singular}" (IALA §§21-25)
          </strong>
          <div class="verb-table-container">${renderNounParadigmHTML(n, match.sourceWord)}</div>
        </div>
      `;
      return n.singular;
    }

    if (match.category === 'ia_collateral' && match.matches && match.matches.length > 0) {
      const best = match.matches[0]!;
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">📜</div>
            <div>
              <div class="banner-title">Orthographia Collateral: <em>${match.sourceWord}</em> ➔ <em>${best.classicalWord}</em></div>
              <div class="banner-subtitle">
                Forma simplificate autorisate per IALA §15 &bull; Entrada classic IED: <strong>${best.classicalWord}</strong>
              </div>
            </div>
          </div>
          <span class="banner-badge">IALA ${best.ruleId}</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Forma Collateral (Buscata)</div>
            <div class="insight-val accent">${match.sourceWord}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Forma Classic IED</div>
            <div class="insight-val accent">${best.classicalWord}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Regula IALA §15</div>
            <div class="insight-val" style="font-size:0.95rem;">${best.desc}</div>
          </div>
        </div>
      `;
      return best.classicalWord;
    }

    if (match.category === 'numeral') {
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">🔢</div>
            <div>
              <div class="banner-title">Numeral in Interlingua: <em>${match.sourceWord}</em></div>
              <div class="banner-subtitle">
                Transcription cardinal textual: <strong>${match.transcription}</strong> &bull; Formula: <code>${match.formula}</code>
              </div>
            </div>
          </div>
          <span class="banner-badge">Numeral IALA §47</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Cifra Arabica</div>
            <div class="insight-val accent">${match.sourceWord}</div>
          </div>
          <div class="insight-card" style="grid-column: span 2;">
            <div class="insight-label">Scriptura e Pronunciation Cardinal</div>
            <div class="insight-val accent" style="color: var(--accent-blue);">${match.transcription}</div>
          </div>
        </div>
      `;
      return null;
    }

    if (match.category === 'ia_prefixed') {
      morphologyBanner.innerHTML = `
        <div class="banner-header">
          <div class="banner-title-area">
            <div class="banner-icon">🧩</div>
            <div>
              <div class="banner-title">Derivation per Prefixo: <em>${match.sourceWord}</em></div>
              <div class="banner-subtitle">
                Radice lexical: <strong>${match.stem}</strong> (${match.stemCategory}) &bull; Formula: <code>${match.formula}</code>
              </div>
            </div>
          </div>
          <span class="banner-badge">Derivation IALA §155</span>
        </div>

        <div class="conjugation-insights">
          <div class="insight-card">
            <div class="insight-label">Prefixo Productive</div>
            <div class="insight-val accent">${match.prefix}-</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Parola Radice</div>
            <div class="insight-val accent">${match.stem}</div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Significato del Prefixo</div>
            <div class="insight-val" style="font-size:0.95rem;">${match.desc}</div>
          </div>
        </div>
      `;
      return match.stem ?? null;
    }

    return null;
  }

  // Fast filtering using compiled criteria
  function filterData() {
    const term = searchTerm.trim().toLowerCase();
    const isAllLetters = activeLetter === 'ALL';
    const letterLower = activeLetter.toLowerCase();
    const isAllPos = activePos === 'ALL';
    const isStressedOnly = stressFilter === 'stressed';
    const isRegularOnly = stressFilter === 'regular';

    const targetRoot = checkMorphologyMatch(term);

    const results = [];
    const total = data.length;

    let prioritizedIdx = -1;
    if (targetRoot) {
      if (verbMap[targetRoot] !== undefined) prioritizedIdx = verbMap[targetRoot];
      else if (adjMap[targetRoot] !== undefined) prioritizedIdx = adjMap[targetRoot];
      else if (sbMap[targetRoot] !== undefined) prioritizedIdx = sbMap[targetRoot];
      else if (dictMap[targetRoot]) prioritizedIdx = data.indexOf(dictMap[targetRoot]);
      
      if (prioritizedIdx >= 0) results.push(prioritizedIdx);
    }

    for (let i = 0; i < total; i++) {
      if (i === prioritizedIdx) continue;

      const item = data[i];
      if (!item) continue;
      const word = item[0] || '';
      const wordLower = word.toLowerCase();
      const pos = item[1] || '';
      const hasExplicitStress = !!item[2];

      if (isStressedOnly || isRegularOnly) {
        let isIrregular = hasExplicitStress;
        if (!isIrregular && morpho && morpho.computeIALAStressHTML) {
          isIrregular = morpho.computeIALAStressHTML(word, item[2] || '', pos).isIrregular;
        }
        if (isStressedOnly && !isIrregular) continue;
        if (isRegularOnly && isIrregular) continue;
      }

      if (!isAllPos) {
        if (!pos || !pos.toLowerCase().split(',').map((s: string) => s.trim()).includes(activePos)) {
          continue;
        }
      }

      if (!isAllLetters) {
        if (!wordLower.startsWith(letterLower)) continue;
      }

      if (term) {
        if (targetRoot && (wordLower === targetRoot || wordLower.startsWith(targetRoot))) {
          // match root
        } else {
          if (matchMode === 'prefix') {
            if (!wordLower.startsWith(term)) continue;
          } else if (matchMode === 'exact') {
            if (wordLower !== term) continue;
          } else {
            if (!wordLower.includes(term)) continue;
          }
        }
      }

      results.push(i);
    }

    filteredIndices = results;
    renderResults();
  }

  function renderResults(): void {
    if (!searchStats || !wordsGrid || !paginationContainer || !searchInput) return;
    const totalMatches = filteredIndices.length;
    searchStats.innerHTML = `Troivate: <strong>${totalMatches.toLocaleString()}</strong> parolas`;

    if (totalMatches === 0) {
      let suggestionsHtml = '';
      if (searchTerm.trim().length >= 3 && morpho) {
        const suggestions = morpho.findSpellingSuggestions(searchTerm.trim(), vocabList, 2, 4);
        if (suggestions && suggestions.length > 0) {
          suggestionsHtml = `
            <div style="margin-top: 18px; padding: 14px; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); max-width: 480px; margin-left: auto; margin-right: auto;">
              <div style="font-size: 0.84rem; font-weight: 700; text-transform: uppercase; color: var(--accent-rose); margin-bottom: 8px;">
                ¿Esque tu voleva dicer...?
              </div>
              <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
                ${suggestions.map(s => `
                  <button class="search-suggest-chip" data-word="${s.word}" style="cursor: pointer; padding: 6px 14px; background: var(--bg-surface); border: 1px solid var(--accent-rose); border-radius: var(--radius-full); font-weight: 600; font-size: 0.88rem; color: var(--text-primary); transition: all 0.2s;">
                    <span>${s.word}</span>
                    <span style="font-size: 0.75rem; opacity: 0.7; color: var(--text-muted);">(dist. ${s.distance})</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `;
        }
      }

      wordsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 style="font-size: 1.2rem; color: var(--text-primary); margin-bottom: 6px;">Nulle parola trovate</h3>
          <p>Tenta con un altere termino de recerca o ajusta le filtros de categoria.</p>
          ${suggestionsHtml}
        </div>
      `;

      wordsGrid.querySelectorAll('.search-suggest-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const w = btn.getAttribute('data-word') || '';
          searchInput.value = w;
          searchTerm = w;
          activeLetter = 'ALL';
          renderAlphabetNav();
          filterData();
        });
      });

      paginationContainer.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(totalMatches / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalMatches);
    const pageIndices = filteredIndices.slice(start, end);

    let html = '';
    for (let idx of pageIndices) {
      const item = data[idx];
      if (!item) continue;
      const wordPlain = item[0] || '';
      const pos = item[1];
      
      // Compute accurate phonologic stress for 100% of words according to IALA §10
      let wordHtml = wordPlain;
      if (morpho && morpho.computeIALAStressHTML) {
        const stressInfo = morpho.computeIALAStressHTML(wordPlain, item[2] || '', pos || '');
        wordHtml = stressInfo.html;
        if (stressInfo.isIrregular) {
          wordHtml = wordHtml.replace('<u>', '<u class="stress-irregular">');
        }
      } else {
        wordHtml = item[2] || wordPlain;
      }

      const posClass = getPosClass(pos);
      const posLabel = getPosLabel(pos);
      const ipaStr = (morpho && morpho.getInterlinguaIPA) ? morpho.getInterlinguaIPA(wordPlain, item[2]) : '';

      html += `
        <div class="word-card" data-index="${idx}">
          <div class="word-main">
            <span class="word-text">${wordHtml}</span>
            <span class="word-extra-info">${pos ? posLabel : 'interlingua'}</span>
            ${ipaStr ? `<span class="word-ipa">${ipaStr}</span>` : ''}
          </div>
          <span class="pos-tag ${posClass}">${pos ? pos.toUpperCase() : '—'}</span>
        </div>
      `;
    }
    wordsGrid.innerHTML = html;

    renderPagination(totalPages);
  }

  function renderPagination(totalPages: number): void {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Precedente</button>`;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
      html += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span style="color:var(--text-muted); padding: 0 4px;">…</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="color:var(--text-muted); padding: 0 4px;">…</span>`;
      html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Sequente →</button>`;
    paginationContainer.innerHTML = html;
  }

  // Fuctiones auxiliar pro modal de parolas e definitiones
  function getIEDUrl(word: string): string {
    return `https://www.interlingua.com/ied/cerca/?edit%5Bkeys%5D=${encodeURIComponent(word || '')}&edit%5B0%5D=Cerca`;
  }

  function getPronunciationHtml(stressInfo: { ruleDesc: string } | null, explicitStress?: string, ipaHtml = ''): string {
    const ipa = ipaHtml ? ` ${ipaHtml}` : '';
    if (stressInfo) {
      return `<strong>Accentuation:</strong> ${stressInfo.ruleDesc}${ipa}`;
    }
    if (explicitStress) {
      return `<strong>Accentuation:</strong> Le vocal accentuate es sublineate explicitemente proque devia del regula general.${ipa}`;
    }
    return `<strong>Accentuation:</strong> Regula general de Interlingua (accento sur le vocal ante le ultime consonante).${ipa}`;
  }

  // Modal display for any word type
  function openWordModal(idx: number): void {
    const item = data[idx];
    if (!item) return;
    const wordPlain = item[0] || '';
    const pos = item[1];
    currentModalWord = wordPlain;

    let wordHtml = wordPlain;
    let stressInfo: { html: string; isIrregular: boolean; ruleDesc: string } | null = null;
    if (morpho && morpho.computeIALAStressHTML) {
      stressInfo = morpho.computeIALAStressHTML(wordPlain, item[2] || '', pos || '');
      wordHtml = stressInfo.html;
      if (stressInfo.isIrregular) {
        wordHtml = wordHtml.replace('<u>', '<u class="stress-irregular">');
      }
    } else {
      wordHtml = item[2] || wordPlain;
    }

    if (!modalWordTitle || !modalPosTag || !modalPronunciation || !modalIEDLink || !modalMorphologySection || !modalDefinitions || !modalBackdrop) return;

    modalWordTitle.innerHTML = wordHtml;
    modalPosTag.className = `pos-tag ${getPosClass(pos)}`;
    modalPosTag.textContent = pos ? pos.toUpperCase() : 'GENERAL';

    const ipaStr = (morpho && morpho.getInterlinguaIPA) ? morpho.getInterlinguaIPA(wordPlain, item[2]) : '';
    const ipaHtml = ipaStr ? `<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; font-family: 'LibertinusMath', 'Segoe UI Symbol', monospace; font-size: 0.85rem; color: var(--accent-blue); font-weight: 600;">IPA: ${ipaStr}</span>` : '';

    modalPronunciation.innerHTML = getPronunciationHtml(stressInfo, item[2], ipaHtml);
    modalIEDLink.href = getIEDUrl(wordPlain);
    
    let morphoHtml = '';
    if (pos && pos.includes('vb') && morpho) {
      const p = morpho.conjugate(wordPlain);
      if (p) {
        morphoHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4>Tabula de Conjugation (IALA §115)</h4>
            <span style="font-size: 0.8rem; color: var(--accent-blue); font-weight: 600;">Radice: ${p.stem}-</span>
          </div>
          <div class="verb-table-container">${renderVerbParadigmHTML(p)}</div>
        `;
      }
    } else if (pos && pos.includes('adj') && morpho) {
      const p = morpho.inflectAdjective(wordPlain);
      if (p) {
        morphoHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4>Grados de Comparation e Derivation (IALA §§34-45)</h4>
            <span style="font-size: 0.8rem; color: var(--accent-amber); font-weight: 600;">Adjectivo Invariable (§32)</span>
          </div>
          <div class="verb-table-container">${renderAdjectiveParadigmHTML(p)}</div>
        `;
      }
    } else if (pos && pos.includes('sb') && morpho) {
      const n = morpho.pluralizeNoun(wordPlain);
      if (n) {
        morphoHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4>Flexion de Plural (IALA §§21-25)</h4>
            <span style="font-size: 0.8rem; color: var(--accent-blue); font-weight: 600;">Substantivo</span>
          </div>
          <div class="verb-table-container">${renderNounParadigmHTML(n)}</div>
        `;
      }
    }

    if (morphoHtml) {
      modalMorphologySection.style.display = 'block';
      modalMorphologySection.innerHTML = morphoHtml;
    } else {
      modalMorphologySection.style.display = 'none';
      modalMorphologySection.innerHTML = '';
    }

    modalDefinitions.innerHTML = `<span style="color: var(--text-muted);">Cercante definition in Wiktionary...</span>`;
    
    fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(wordPlain)}`)
      .then((r: Response) => {
        if (!r.ok) throw new Error('Not found');
        return r.json() as Promise<{ en?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string }> }> }>;
      })
      .then(res => {
        if (res && res.en && res.en.length) {
          let defHtml = '<ul style="padding-left: 20px; margin: 0;">';
          res.en.forEach((item: { partOfSpeech?: string; definitions?: Array<{ definition?: string }> }) => {
            if (item.definitions) {
              item.definitions.slice(0, 3).forEach((d: { definition?: string }) => {
                let cleanDef = d.definition || '';
                // Fix relative /wiki/ links so they point to en.wiktionary.org and open in new tab
                cleanDef = cleanDef.replace(/href="\/wiki\/([^"]+)"/g, 'href="https://en.wiktionary.org/wiki/$1" target="_blank" rel="noopener"');
                cleanDef = cleanDef.replace(/href='\/wiki\/([^']+)'/g, 'href="https://en.wiktionary.org/wiki/$1" target="_blank" rel="noopener"');
                defHtml += `<li style="margin-bottom: 6px;"><strong>${item.partOfSpeech || ''}:</strong> ${cleanDef}</li>`;
              });
            }
          });
          defHtml += '</ul>';
          modalDefinitions.innerHTML = defHtml;
        } else {
          modalDefinitions.innerHTML = `<em>Nulle definition trovate automaticamente in Wiktionary. Consulta le ligamine IED infra.</em>`;
        }
      })
      .catch(() => {
        modalDefinitions.innerHTML = `<em>Definition non disponibile offline. Usa le dictionario IED official o consultate le grammatica.</em>`;
      });

    modalBackdrop.classList.add('open');
  }

  function closeModal(): void {
    if (modalBackdrop) {
      modalBackdrop.classList.remove('open');
    }
    currentModalWord = null;
  }

  function speakWord(text: string, triggerButton: HTMLButtonElement | null): void {
    if (!text) return;
    if (window.GoogleTTS && typeof window.GoogleTTS.speak === 'function') {
      const originalHtml = triggerButton ? triggerButton.innerHTML : null;
      window.GoogleTTS.speak(text, {
        onStart: () => {
          if (triggerButton) {
            triggerButton.disabled = true;
            triggerButton.style.opacity = '0.75';
            triggerButton.classList.add('audio-playing');
          }
        },
        onEnd: () => {
          if (triggerButton) {
            triggerButton.disabled = false;
            triggerButton.style.opacity = '1';
            triggerButton.classList.remove('audio-playing');
            if (originalHtml) triggerButton.innerHTML = originalHtml;
          }
        },
        onError: () => {
          if (triggerButton) {
            triggerButton.disabled = false;
            triggerButton.style.opacity = '1';
            triggerButton.classList.remove('audio-playing');
            if (originalHtml) triggerButton.innerHTML = originalHtml;
          }
        }
      });
    }
  }

  // ==========================================
  // TEXT ANALYZER ENGINE & INTERACTIVE READER
  // ==========================================
  function runTextAnalysis(): void {
    if (!analyzerInputText || !interactiveReaderBody || !analyzerOutputArea || !analyzerStatsBadges) return;
    const rawText = analyzerInputText.value.trim();
    if (!rawText) return;

    const tokens = rawText.match(/\d+(?:[.,]\d+)+|[\wÀ-ÿ]+|[^\wÀ-ÿ]+/g) || [];
    const isWordToken = (tok: string): boolean => /^(?:\d+(?:[.,]\d+)+|[\wÀ-ÿ]+)$/.test(tok);
    
    // Pass 1: Extractor parolas con contexto positional
    const wordList: Array<{ tokenPos: number; tok: string; low: string }> = [];
    for (let i = 0; i < tokens.length; i++) {
      const tokVal = tokens[i];
      if (tokVal && isWordToken(tokVal)) {
        wordList.push({
          tokenPos: i,
          tok: tokVal,
          low: tokVal.toLowerCase()
        });
      }
    }

    // Pass 2: Analysar cata parola con contexto circunstanti
    const wordAnalysisMap: AnalysisResult[] = [];
    let wordCount = wordList.length;
    let recognizedCount = 0;
    let verbCount = 0;
    let nounCount = 0;
    let adjCount = 0;
    let advCount = 0;
    let numCount = 0;

    for (let w = 0; w < wordList.length; w++) {
      const item = wordList[w];
      if (!item) continue;
      const prevLow = w > 0 ? (wordList[w - 1]?.low ?? '') : '';
      const nextLow = w < wordList.length - 1 ? (wordList[w + 1]?.low ?? '') : '';

      const analysis = morpho.analyzeTextTokenContextual({
        tok: item.tok,
        low: item.low,
        prevLow: prevLow,
        nextLow: nextLow
      }, dictMulti, verbMap, adjMap, sbMap, vocabList);

      if (!analysis) continue;

      if (analysis.status !== 'unknown') {
        recognizedCount++;
      }

      const p = (analysis.pos || '').toLowerCase();
      if (p.includes('vb')) verbCount++;
      else if (p.includes('sb')) nounCount++;
      else if (p.includes('adj')) adjCount++;
      else if (p.includes('adv')) advCount++;
      else if (p.includes('num') || analysis.status === 'numeral') numCount++;

      wordAnalysisMap.push(analysis);
    }

    currentAnalyzedTokens = wordAnalysisMap;

    // Pass 3: Construer HTML interactiv
    let readerHtml = '';
    let currentWordIdx = 0;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok) continue;
      if (isWordToken(tok)) {
        const analysis = wordAnalysisMap[currentWordIdx];
        const tokenIdx = currentWordIdx;
        currentWordIdx++;

        let pClass = 'token-other';
        const p = analysis ? (analysis.pos || '').toLowerCase() : '';
        if (p.includes('vb')) pClass = 'token-vb';
        else if (p.includes('sb')) pClass = 'token-sb';
        else if (p.includes('adj')) pClass = 'token-adj';
        else if (p.includes('adv')) pClass = 'token-adv';
        else if (p.includes('num') || (analysis && analysis.status === 'numeral')) pClass = 'token-num';
        else if (analysis && analysis.status === 'unknown') pClass = 'token-unknown';

        readerHtml += `<span class="txt-token ${pClass}" data-token-idx="${tokenIdx}">${tok}</span>`;
      } else {
        const escaped = tok.replace(/\n/g, '<br>');
        readerHtml += escaped;
      }
    }

    // Renderisar badges de statistica
    const coveragePct = wordCount > 0 ? ((recognizedCount / wordCount) * 100).toFixed(1) : '0';
    analyzerStatsBadges.innerHTML = `
      <div class="stat-badge">Total parolas: <strong>${wordCount}</strong></div>
      <div class="stat-badge" style="border-color: var(--accent-emerald);">Recognoscentia: <strong style="color: var(--accent-emerald);">${coveragePct}%</strong> (${recognizedCount}/${wordCount})</div>
      <div class="stat-badge">Verbos: <strong style="color: var(--accent-emerald);">${verbCount}</strong></div>
      <div class="stat-badge">Substantivos: <strong style="color: var(--accent-blue);">${nounCount}</strong></div>
      <div class="stat-badge">Adjectivos: <strong style="color: var(--accent-amber);">${adjCount}</strong></div>
      <div class="stat-badge">Adverbios: <strong style="color: #a78bfa;">${advCount}</strong></div>
      <div class="stat-badge">Numerales: <strong style="color: #f59e0b;">${numCount}</strong></div>
    `;

    interactiveReaderBody.innerHTML = readerHtml;
    analyzerOutputArea.style.display = 'block';

    // Auto-selectir le prime token si disponibile
    if (currentAnalyzedTokens.length > 0) {
      selectTokenForInspection(0);
    }
  }

  // Inspector de parolas e analysator
  function selectTokenForInspection(tokenIdx: number): void {
    const analysis = currentAnalyzedTokens[tokenIdx];
    if (!analysis || !interactiveReaderBody || !inspectorContent) return;

    // Sublinear le token active in le lector
    interactiveReaderBody.querySelectorAll('.txt-token').forEach(t => t.classList.remove('active-token'));
    const tokenElem = interactiveReaderBody.querySelector(`.txt-token[data-token-idx="${tokenIdx}"]`);
    if (tokenElem) tokenElem.classList.add('active-token');

    // Construer HTML del panel inspector
    const word = analysis.word || '';
    const root = analysis.root || word;
    const pos = analysis.pos || 'General';
    const status = analysis.status || '';
    const desc = analysis.desc || '';
    const posClass = getPosClass(pos);

    let extraDetails = '';
    // If root is in dictionary or has paradigm
    if (pos.includes('vb') && morpho) {
      const p = morpho.conjugate(root);
      if (p) {
        extraDetails = `
          <div style="margin-top: 14px;">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
              Formas Temporal Clave (IALA §115)
            </div>
            <div style="font-size: 0.88rem; line-height: 1.6; color: var(--text-secondary);">
              &bull; <strong>Presente:</strong> ${p.active_simple.presente}<br>
              &bull; <strong>Passato:</strong> ${p.active_simple.passato}<br>
              &bull; <strong>Futuro:</strong> ${p.active_simple.futuro}<br>
              &bull; <strong>Conditional:</strong> ${p.active_simple.conditional}<br>
              &bull; <strong>Participio Passate:</strong> ${p.part_pass}
            </div>
          </div>
        `;
      }
    } else if (pos.includes('adj') && morpho) {
      const p = morpho.inflectAdjective(root);
      if (p) {
        const substText = p.isInvariantSubstantive 
          ? `<strong>${p.substantiveM}</strong> (invariabile: <em>${p.substantivationNote}</em>)`
          : `<strong>${p.substantiveM}</strong> (masc/abstr.) &bull; <strong>${p.substantiveF}</strong> (fem.)`;

        extraDetails = `
          <div style="margin-top: 14px;">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
              Grados e Derivationes (IALA §§34-45)
            </div>
            <div style="font-size: 0.88rem; line-height: 1.6; color: var(--text-secondary);">
              &bull; <strong>Comparativo:</strong> ${p.compPos}<br>
              &bull; <strong>Superlativo:</strong> ${p.absSup}<br>
              &bull; <strong>Adverbio:</strong> ${p.adverb}<br>
              &bull; <strong>Substantivo:</strong> ${substText}
            </div>
          </div>
        `;
      }
    } else if (pos.includes('sb') && morpho) {
      const n = morpho.pluralizeNoun(root);
      if (n) {
        extraDetails = `
          <div style="margin-top: 14px;">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
              Flexion de Numero (IALA §§21-25)
            </div>
            <div style="font-size: 0.88rem; line-height: 1.6; color: var(--text-secondary);">
              &bull; <strong>Singular:</strong> ${n.singular}<br>
              &bull; <strong>Plural:</strong> ${n.plural}<br>
              &bull; <em>${n.rule}</em>
            </div>
          </div>
        `;
      }
    } else if (status === 'prefixed' && morpho) {
      const plInfo = morpho.pluralizeNoun(word);
      extraDetails = `
        <div style="margin-top: 14px;">
          <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
            Flexion e Derivation (IALA §155)
          </div>
          <div style="font-size: 0.88rem; line-height: 1.6; color: var(--text-secondary);">
            &bull; <strong>Singular:</strong> ${word}<br>
            &bull; <strong>Plural:</strong> ${plInfo ? plInfo.plural : word + 'es'}<br>
            &bull; <em>Derivation productive super le radice "${root}"</em>
          </div>
        </div>
      `;
    } else if ((pos.includes('num') || status === 'numeral') && analysis.transcription) {
      extraDetails = `
        <div style="margin-top: 14px;">
          <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--accent-amber); margin-bottom: 6px;">
            Transcription Cardinal (IALA §47)
          </div>
          <div style="font-size: 0.95rem; line-height: 1.6; color: var(--accent-amber); font-weight: 700;">
            &bull; <strong>Scriptura:</strong> ${analysis.transcription}<br>
            <span style="font-size: 0.84rem; font-weight: 400; color: var(--text-secondary);">&bull; Numeros cardinales de Interlingua secundo le Grammatica de IALA.</span>
          </div>
        </div>
      `;
    }

      let suggestionsHTML = '';
      if (analysis.suggestions && analysis.suggestions.length > 0) {
        suggestionsHTML = `
          <div style="margin-bottom: 12px; padding: 10px 12px; background: rgba(244, 63, 94, 0.08); border-left: 3px solid var(--accent-rose); border-radius: var(--radius-sm);">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--accent-rose); margin-bottom: 6px;">
              Parola non registrate &bull; Esque tu voleva dicer...?
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
              ${analysis.suggestions.map(s => `
                <button class="btn-suggestion-chip" data-suggest-word="${s.word}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--bg-card); border: 1px solid var(--accent-rose); border-radius: var(--radius-full); font-size: 0.84rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <span>${s.word}</span>
                  <span style="font-size: 0.72rem; opacity: 0.7; color: var(--text-muted);">(dist. ${s.distance})</span>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      let inspectorWordHtml = word;
      if (morpho && morpho.computeIALAStressHTML) {
        const itemMatch = dictMap[word.toLowerCase()] || dictMap[root.toLowerCase()];
        const explicitHtml = itemMatch ? itemMatch[2] : '';
        const sInfo = morpho.computeIALAStressHTML(word, explicitHtml, pos);
        inspectorWordHtml = sInfo.html;
        if (sInfo.isIrregular) {
          inspectorWordHtml = inspectorWordHtml.replace('<u>', '<u class="stress-irregular">');
        }
      }

      const itemMatch = dictMap[word.toLowerCase()] || dictMap[root.toLowerCase()];
      const explicitHtml = itemMatch ? itemMatch[2] : '';
      const ipaStr = (morpho && morpho.getInterlinguaIPA) ? morpho.getInterlinguaIPA(word, explicitHtml) : '';

      inspectorContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div>
          <h3 class="word-text" style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">${inspectorWordHtml}</h3>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
            <span style="font-size: 0.88rem; color: var(--accent-blue); font-weight: 600;">Radice: ${root}</span>
            ${ipaStr ? `<code style="font-family: 'LibertinusMath', 'Segoe UI Symbol', monospace; font-size: 0.8rem; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 6px; border-radius: 4px; color: var(--accent-blue);">${ipaStr}</code>` : ''}
          </div>
        </div>
        <span class="pos-tag ${posClass}">${pos.toUpperCase()}</span>
      </div>

      ${suggestionsHTML}

      <div style="padding: 10px 12px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 12px; font-size: 0.88rem; color: var(--text-secondary);">
        <strong>Analyse:</strong> ${desc}
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 14px;">
        <button id="inspector-btn-speak" class="btn-action" style="padding: 6px 12px; font-size: 0.82rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          Audir
        </button>
        <button id="inspector-btn-modal" class="btn-action" style="padding: 6px 12px; font-size: 0.82rem;">
          Ficha Complete
        </button>
      </div>

      ${extraDetails}

      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle); font-size: 0.8rem; color: var(--text-muted);">
        Status: <strong style="color: var(--text-primary); text-transform: capitalize;">${status}</strong> &bull; Dictionario Cleij-Breinstrup
      </div>
    `;

    inspectorContent.querySelectorAll('.btn-suggestion-chip').forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        const targetWord = (e.currentTarget as HTMLElement).getAttribute('data-suggest-word') || '';
        const lowT = targetWord.toLowerCase();
        let matchIdx = dictMap[lowT] ? data.indexOf(dictMap[lowT]!) : -1;
        if (matchIdx >= 0) {
          openWordModal(matchIdx);
        }
      });
    });

    const btnSpeak = document.getElementById('inspector-btn-speak') as HTMLButtonElement | null;
    if (btnSpeak) {
      btnSpeak.addEventListener('click', () => {
        const toSpeak = analysis.transcription || word || '';
        speakWord(toSpeak, btnSpeak);
      });
    }
    const btnModalInspector = document.getElementById('inspector-btn-modal');
    if (btnModalInspector) {
      btnModalInspector.addEventListener('click', () => {
        // Cercar indice in le datos del dictionario
        const lowRoot = (root || '').toLowerCase();
        const lowWord = (word || '').toLowerCase();
        let matchIdx = (lowRoot && dictMap[lowRoot]) ? data.indexOf(dictMap[lowRoot]!) : ((lowWord && dictMap[lowWord]) ? data.indexOf(dictMap[lowWord]!) : -1);
        if (matchIdx >= 0) {
          openWordModal(matchIdx);
        } else {
          // Synthetisar entrata personalisate
          currentModalWord = word || null;
          let wordHtml = word || '';
          let stressInfo: { html: string; isIrregular: boolean; ruleDesc: string } | null = null;
          if (morpho && morpho.computeIALAStressHTML) {
            stressInfo = morpho.computeIALAStressHTML(word || '', '', pos);
            wordHtml = stressInfo.html;
            if (stressInfo.isIrregular) {
              wordHtml = wordHtml.replace('<u>', '<u class="stress-irregular">');
            }
          }
          if (modalWordTitle) modalWordTitle.innerHTML = wordHtml;
          if (modalPosTag) {
            modalPosTag.className = `pos-tag ${posClass}`;
            modalPosTag.textContent = pos.toUpperCase();
          }
          if (modalPronunciation) modalPronunciation.innerHTML = getPronunciationHtml(stressInfo);
          if (modalIEDLink) modalIEDLink.href = getIEDUrl(root || '');
          if (modalDefinitions) {
            if (pos.includes('num') || status === 'numeral') {
              modalDefinitions.innerHTML = `
                <div class="def-group">
                  <div class="def-category">Numeral Cardinal</div>
                  <ol class="def-list">
                    <li class="def-item">
                      <div class="def-dutch"><strong>Numeral in Interlingua:</strong> ${analysis.transcription || word}</div>
                      <div class="def-note">Regula de composition cardinal e decimal secundo le Grammatica de IALA (§47).</div>
                    </li>
                  </ol>
                </div>
              `;
            } else {
              modalDefinitions.innerHTML = `<em>Parola analysate como: ${desc}</em>`;
            }
          }
          if (modalMorphologySection) {
            modalMorphologySection.style.display = 'none';
          }
          if (modalBackdrop) {
            modalBackdrop.classList.add('open');
          }
        }
      });
    }
  }

  // Delegate de clic in le lector interactiv
  if (interactiveReaderBody) {
    interactiveReaderBody.addEventListener('click', (e: MouseEvent) => {
      const targetNode = e.target as Element | null;
      if (!targetNode) return;
      const tokenSpan = targetNode.closest('.txt-token') as HTMLElement | null;
      if (!tokenSpan) return;
      const idxStr = tokenSpan.dataset['tokenIdx'];
      if (idxStr !== undefined) {
        const idx = parseInt(idxStr, 10);
        selectTokenForInspection(idx);
      }
    });
  }

  if (btnAnalyzeRun) btnAnalyzeRun.addEventListener('click', runTextAnalysis);

  if (btnAnalyzeSample && analyzerInputText) {
    btnAnalyzeSample.addEventListener('click', () => {
      analyzerInputText.value = `Interlingua es un lingua auxiliar international basate sur le vocabulos commun del principal linguas occidental. 
Le parolas de interlingua es facilemente comprehensibile pro centenas de milliones de personas sin studio previe. 
Nos mangiava insimul in le restaurant e nos parlara de nostre planos pro le futuro con grandissime enthusiasmo.`;
      runTextAnalysis();
    });
  }

  if (btnAnalyzeClear && analyzerInputText && analyzerOutputArea && inspectorContent) {
    btnAnalyzeClear.addEventListener('click', () => {
      analyzerInputText.value = '';
      analyzerOutputArea.style.display = 'none';
      if (interactiveReaderBody) interactiveReaderBody.innerHTML = '';
      currentAnalyzedTokens = [];
      inspectorContent.innerHTML = `
        <div class="inspector-placeholder">
          <p>Pulsa qualcunque parola in le texto pro vider su radice, function grammatical, flexiones e definition.</p>
        </div>
      `;
    });
  }

  // Evenimentos - Vista de Cerca
  if (searchInput && clearBtn) {
    searchInput.addEventListener('input', (e: Event) => {
      searchTerm = (e.target as HTMLInputElement).value;
      clearBtn.style.display = searchTerm ? 'block' : 'none';
      currentPage = 1;
      filterData();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchTerm = '';
      clearBtn.style.display = 'none';
      currentPage = 1;
      searchInput.focus();
      filterData();
    });
  }

  if (wordsGrid) {
    wordsGrid.addEventListener('click', (e: MouseEvent) => {
      const targetNode = e.target as Element | null;
      if (!targetNode) return;
      const card = targetNode.closest('.word-card') as HTMLElement | null;
      if (!card) return;
      const idxStr = card.dataset['index'];
      if (idxStr !== undefined) {
        const idx = parseInt(idxStr, 10);
        openWordModal(idx);
      }
    });
  }

  if (paginationContainer) {
    paginationContainer.addEventListener('click', (e: MouseEvent) => {
      const targetNode = e.target as Element | null;
      if (!targetNode) return;
      const btn = targetNode.closest('.page-btn') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      const pStr = btn.dataset['page'];
      const p = pStr ? parseInt(pStr, 10) : NaN;
      if (!isNaN(p) && p !== currentPage) {
        currentPage = p;
        renderResults();
        window.scrollTo({ top: 200, behavior: 'smooth' });
      }
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e: MouseEvent) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modalBackdrop && modalBackdrop.classList.contains('open')) {
      closeModal();
    }
    if (e.key === '/' && currentView === 'search' && searchInput && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  if (modalSpeakBtn) {
    modalSpeakBtn.addEventListener('click', () => {
      if (currentModalWord) speakWord(currentModalWord, modalSpeakBtn);
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      if (currentModalWord && modalCopyBtn) {
        navigator.clipboard.writeText(currentModalWord).then(() => {
          if (!modalCopyBtn) return;
          const originalText = modalCopyBtn.innerHTML;
          modalCopyBtn.innerHTML = `✓ Copiate!`;
          setTimeout(() => { if (modalCopyBtn) modalCopyBtn.innerHTML = originalText; }, 1500);
        });
      }
    });
  }

  document.querySelectorAll('.filter-chip-pos').forEach(chip => {
    chip.addEventListener('click', (e: Event) => {
      document.querySelectorAll('.filter-chip-pos').forEach(c => c.classList.remove('active'));
      const targetChip = e.currentTarget as HTMLElement;
      targetChip.classList.add('active');
      activePos = targetChip.dataset['pos'] ?? 'ALL';
      currentPage = 1;
      filterData();
    });
  });

  document.querySelectorAll('.filter-chip-mode').forEach(chip => {
    chip.addEventListener('click', (e: Event) => {
      document.querySelectorAll('.filter-chip-mode').forEach(c => c.classList.remove('active'));
      const targetChip = e.currentTarget as HTMLElement;
      targetChip.classList.add('active');
      matchMode = targetChip.dataset['mode'] ?? 'prefix';
      currentPage = 1;
      filterData();
    });
  });

  document.querySelectorAll('.filter-chip-stress').forEach(chip => {
    chip.addEventListener('click', (e: Event) => {
      document.querySelectorAll('.filter-chip-stress').forEach(c => c.classList.remove('active'));
      const targetChip = e.currentTarget as HTMLElement;
      targetChip.classList.add('active');
      stressFilter = targetChip.dataset['stress'] ?? 'ALL';
      currentPage = 1;
      filterData();
    });
  });

  function applyTheme(theme: string): void {
    const validTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', validTheme);
    localStorage.setItem('dictionario-theme', validTheme);
    if (themeToggle) {
      const isDark = validTheme === 'dark';
      themeToggle.setAttribute('title', isDark ? 'Cambiar a Modo Clare' : 'Cambiar a Modo Obscur');
      const label = themeToggle.querySelector('.theme-label');
      const icon = themeToggle.querySelector('.theme-icon');
      if (label) label.textContent = isDark ? 'Modo: Obscur' : 'Modo: Clare';
      if (icon) icon.textContent = isDark ? '🌙' : '☀';
    }
  }

  function applyStyle(style: string): void {
    const validStyle = style === 'modern' ? 'modern' : 'w95';
    document.body.setAttribute('data-style', validStyle);
    localStorage.setItem('dictionario-style', validStyle);
    if (styleToggle) {
      const isModern = validStyle === 'modern';
      styleToggle.setAttribute('title', isModern ? 'Cambiar a Windows 95 (Retro)' : 'Cambiar a Moderno (Biblioteca & Archivo)');
      const label = styleToggle.querySelector('.style-label');
      const icon = styleToggle.querySelector('.style-icon');
      if (label) label.textContent = isModern ? 'Stilo: Moderno' : 'Stilo: W95';
      if (icon) icon.textContent = isModern ? '🏛️' : '💻';
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  if (styleToggle) {
    styleToggle.addEventListener('click', () => {
      const currentStyle = document.body.getAttribute('data-style') || 'modern';
      applyStyle(currentStyle === 'modern' ? 'w95' : 'modern');
    });
  }

  const savedStyle = localStorage.getItem('dictionario-style') || 'modern';
  applyStyle(savedStyle);

  const savedTheme = localStorage.getItem('dictionario-theme') || 'light';
  applyTheme(savedTheme);

  // --------------------------------------------------------------------------
  // Menubar Handlers (File/About, Stilo, Cerca, Analysator, Grammatica)
  // --------------------------------------------------------------------------
  const menuFile = document.getElementById('menu-file');
  const dropdownFile = document.getElementById('dropdown-file');
  const menuFileAbout = document.getElementById('menu-file-about');
  const menuFileAudio = document.getElementById('menu-file-audio');
  
  const menuStilo = document.getElementById('menu-stilo');
  const dropdownStilo = document.getElementById('dropdown-stilo');
  const menuStiloW95 = document.getElementById('menu-stilo-w95');
  const menuStiloModern = document.getElementById('menu-stilo-modern');
  const menuThemeLight = document.getElementById('menu-theme-light');
  const menuThemeDark = document.getElementById('menu-theme-dark');

  const aboutModalBackdrop = document.getElementById('about-modal-backdrop');
  const aboutModalClose = document.getElementById('about-modal-close');
  const aboutModalOkBtn = document.getElementById('about-modal-ok-btn');
  const menuCerca = document.getElementById('menu-cerca');
  const menuAnalysator = document.getElementById('menu-analysator');
  const menuGrammatica = document.getElementById('menu-grammatica');

  function openAboutModal() {
    if (dropdownFile) dropdownFile.classList.remove('show');
    if (dropdownStilo) dropdownStilo.classList.remove('show');
    if (menuFile) menuFile.classList.remove('active-menu');
    if (menuStilo) menuStilo.classList.remove('active-menu');
    if (aboutModalBackdrop) {
      aboutModalBackdrop.classList.add('open');
      if (aboutModalOkBtn) aboutModalOkBtn.focus();
    }
  }

  function closeAboutModal() {
    if (aboutModalBackdrop) {
      aboutModalBackdrop.classList.remove('open');
    }
  }

  if (menuFile) {
    menuFile.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!dropdownFile) return;
      const isOpen = dropdownFile.classList.contains('show');
      if (isOpen) {
        dropdownFile.classList.remove('show');
        menuFile.classList.remove('active-menu');
      } else {
        dropdownFile.classList.add('show');
        menuFile.classList.add('active-menu');
        if (dropdownStilo) dropdownStilo.classList.remove('show');
        if (menuStilo) menuStilo.classList.remove('active-menu');
      }
    });

    menuFile.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && dropdownFile) {
        e.preventDefault();
        dropdownFile.classList.add('show');
        menuFile.classList.add('active-menu');
        if (dropdownStilo) dropdownStilo.classList.remove('show');
        if (menuStilo) menuStilo.classList.remove('active-menu');
        if (menuFileAbout) menuFileAbout.focus();
      }
    });
  }

  if (menuStilo) {
    menuStilo.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!dropdownStilo) return;
      const isOpen = dropdownStilo.classList.contains('show');
      if (isOpen) {
        dropdownStilo.classList.remove('show');
        menuStilo.classList.remove('active-menu');
      } else {
        dropdownStilo.classList.add('show');
        menuStilo.classList.add('active-menu');
        if (dropdownFile) dropdownFile.classList.remove('show');
        if (menuFile) menuFile.classList.remove('active-menu');
      }
    });

    menuStilo.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && dropdownStilo) {
        e.preventDefault();
        dropdownStilo.classList.add('show');
        menuStilo.classList.add('active-menu');
        if (dropdownFile) dropdownFile.classList.remove('show');
        if (menuFile) menuFile.classList.remove('active-menu');
      }
    });
  }

  if (menuStiloW95) {
    menuStiloW95.addEventListener('click', () => {
      applyStyle('w95');
      if (dropdownStilo) dropdownStilo.classList.remove('show');
      if (menuStilo) menuStilo.classList.remove('active-menu');
    });
  }

  if (menuStiloModern) {
    menuStiloModern.addEventListener('click', () => {
      applyStyle('modern');
      if (dropdownStilo) dropdownStilo.classList.remove('show');
      if (menuStilo) menuStilo.classList.remove('active-menu');
    });
  }

  if (menuThemeLight) {
    menuThemeLight.addEventListener('click', () => {
      applyTheme('light');
      if (dropdownStilo) dropdownStilo.classList.remove('show');
      if (menuStilo) menuStilo.classList.remove('active-menu');
    });
  }

  if (menuThemeDark) {
    menuThemeDark.addEventListener('click', () => {
      applyTheme('dark');
      if (dropdownStilo) dropdownStilo.classList.remove('show');
      if (menuStilo) menuStilo.classList.remove('active-menu');
    });
  }

  if (menuFileAbout) {
    menuFileAbout.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      openAboutModal();
    });
  }

  if (menuFileAudio) {
    menuFileAudio.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      if (dropdownFile) dropdownFile.classList.remove('show');
      if (menuFile) menuFile.classList.remove('active-menu');
      if (window.AudioConfigModal && typeof window.AudioConfigModal.open === 'function') {
        window.AudioConfigModal.open();
      }
    });
  }

  if (aboutModalClose) aboutModalClose.addEventListener('click', closeAboutModal);
  if (aboutModalOkBtn) aboutModalOkBtn.addEventListener('click', closeAboutModal);
  if (aboutModalBackdrop) {
    aboutModalBackdrop.addEventListener('click', (e: MouseEvent) => {
      if (e.target === aboutModalBackdrop) closeAboutModal();
    });
  }

  // <u>C</u>erca Menu Item -> Focuses search input and selects text
  if (menuCerca) {
    menuCerca.addEventListener('click', () => {
      switchView('search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // <u>A</u>nalysator Menu Item -> Activates analyzer tab
  if (menuAnalysator) {
    menuAnalysator.addEventListener('click', () => {
      if (tabBtnAnalyzer) {
        tabBtnAnalyzer.click();
      } else {
        switchView('analyzer');
      }
    });
  }

  // <u>G</u>rammatica Menu Item -> Detonates download of Grammatica_de_Interlingua.md
  function downloadGrammatica(): void {
    const link = document.createElement('a');
    link.href = 'Grammatica_de_Interlingua.md';
    link.download = 'Grammatica_de_Interlingua.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (menuGrammatica) {
    menuGrammatica.addEventListener('click', () => {
      downloadGrammatica();
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e: MouseEvent) => {
    const targetNode = e.target as Node | null;
    if (dropdownFile && targetNode && !dropdownFile.contains(targetNode) && targetNode !== menuFile) {
      dropdownFile.classList.remove('show');
      if (menuFile) menuFile.classList.remove('active-menu');
    }
    if (dropdownStilo && targetNode && !dropdownStilo.contains(targetNode) && targetNode !== menuStilo) {
      dropdownStilo.classList.remove('show');
      if (menuStilo) menuStilo.classList.remove('active-menu');
    }
  });

  // Hotkeys & Esc support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (aboutModalBackdrop && aboutModalBackdrop.classList.contains('open')) {
        closeAboutModal();
        return;
      }
      if (dropdownFile && dropdownFile.classList.contains('show')) {
        dropdownFile.classList.remove('show');
        if (menuFile) menuFile.classList.remove('active-menu');
        return;
      }
      if (dropdownStilo && dropdownStilo.classList.contains('show')) {
        dropdownStilo.classList.remove('show');
        if (menuStilo) menuStilo.classList.remove('active-menu');
        return;
      }
    }
  });

  // Init
  renderAlphabetNav();
  filterData();
})();

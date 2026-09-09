/**
 * =============================================================================
 * Dictionario IALA - Transcriptor Fonetic e Regulas Phonetic pro Interlingua
 * =============================================================================
 *
 * Basate super le 14 regulas del UMI e le Grammatica de Interlingua (Gode & Blair).
 * Genera SSML e notation IPA con accentuation e syllabification correcte.
 */

'use strict';

// §1: Le litteras e lor nomines in Interlingua
const iaLetterName = function(c: string): string | null {
  const lower = c.toLowerCase();
  const map: Record<string, string> = {
    'a': 'a', 'b': 'be', 'c': 'ce', 'd': 'de', 'e': 'e', 'f': 'ef',
    'g': 'ge', 'h': 'ha', 'i': 'i', 'j': 'jota', 'k': 'ka', 'l': 'el',
    'm': 'em', 'n': 'en', 'o': 'o', 'p': 'pe', 'q': 'cu', 'r': 'er',
    's': 'es', 't': 'te', 'u': 'u', 'v': 've', 'w': 'duple ve',
    'x': 'ix', 'y': 'ypsilon', 'z': 'zeta'
  };
  return map[lower] ?? null;
};

// Atomos numeric basic pro Interlingua (IALA §47)
const numAtomInterlingua = function(n: number): string {
  const map: Record<number, string> = {
    0: 'zero', 1: 'un', 2: 'duo', 3: 'tres', 4: 'quatro', 5: 'cinque',
    6: 'sex', 7: 'septe', 8: 'octo', 9: 'novem', 10: 'dece',
    20: 'vinti', 30: 'trenta', 40: 'quaranta', 50: 'cinquanta',
    60: 'sexanta', 70: 'septanta', 80: 'octanta', 90: 'novanta',
    100: 'cento', 1000: 'mille', 1000000: 'million'
  };
  return map[n] ?? '';
};

// Conversion recursive de integros a texto in Interlingua
const transcribeIntInterlingua = function(n: number): string {
  if (n === 0) return numAtomInterlingua(0);

  const parts: string[] = [];
  const scales: [number, string, string][] = [
    [1000000000000000000, 'trillion', 'trilliones'],
    [1000000000000000, 'billiardo', 'billiardos'],
    [1000000000000, 'billion', 'billiones'],
    [1000000000, 'milliardo', 'milliardos'],
    [1000000, 'million', 'milliones']
  ];

  for (let i = 0; i < scales.length; i++) {
    const val = scales[i]![0];
    const nameSg = scales[i]![1];
    const namePl = scales[i]![2];
    if (n >= val) {
      const count = Math.floor(n / val);
      n = n % val;
      if (count === 1) {
        parts.push('un ' + nameSg);
      } else {
        parts.push(transcribeIntInterlingua(count) + ' ' + namePl);
      }
    }
  }

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    n = n % 1000;
    if (thousands === 1) {
      parts.push('mille');
    } else {
      parts.push(transcribeIntInterlingua(thousands) + ' milles');
    }
  }

  if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    n = n % 100;
    if (hundreds === 1) {
      parts.push('cento');
    } else {
      parts.push(transcribeIntInterlingua(hundreds) + ' centos');
    }
  }

  if (n > 0) {
    if (n <= 10) {
      parts.push(numAtomInterlingua(n));
    } else if (n < 20) {
      const unit = n - 10;
      parts.push('dece-' + numAtomInterlingua(unit));
    } else {
      const tens = Math.floor(n / 10) * 10;
      const unit = n % 10;
      const tensStr = numAtomInterlingua(tens);
      if (unit === 0) {
        parts.push(tensStr);
      } else {
        parts.push(tensStr + '-' + numAtomInterlingua(unit));
      }
    }
  }

  return parts.join(' ');
};

const transcribeNumberFullInterlingua = function(s: string | number): string | null {
  const str = (String(s) || '').trim();
  if (!str) return null;

  let neg = false;
  let core = str;

  if (str.startsWith('-') || str.startsWith('−')) {
    neg = true;
    core = str.slice(1);
  }

  if (/^\d+$/.test(core)) {
    const n = parseInt(core, 10);
    let txt = transcribeIntInterlingua(n);
    if (neg) txt = 'minus ' + txt;
    return txt;
  }

  const decRe = /^(\d+)[.,](\d+)$/;
  const caps = core.match(decRe);
  if (caps) {
    const intVal = parseInt(caps[1]!, 10);
    let out = transcribeIntInterlingua(intVal) + ' comma';
    const fracPart = caps[2]!;
    if (fracPart.length <= 2) {
      out += ' ' + transcribeIntInterlingua(parseInt(fracPart, 10));
    } else {
      for (let j = 0; j < fracPart.length; j++) {
        out += ' ' + numAtomInterlingua(parseInt(fracPart[j]!, 10));
      }
    }
    if (neg) out = 'minus ' + out;
    return out;
  }

  return null;
};

const preprocessInterlinguaText = function(text: string): string {
  if (!text) return '';
  // Remover markup e formatation
  let clean = text
    .replace(/##[^#]+##/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/[ \n\r\f\v]+/g, ' ')
    .trim();

  // Eliminar contento inter parentheses
  let noParens = '';
  let depth = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (c === '(') {
      depth++;
    } else if (c === ')') {
      if (depth > 0) depth--;
    } else if (depth === 0) {
      noParens += c;
    }
  }

  // Expandir numeros
  const numRe = /(?:[-−])?\b\d+(?:[.,]\d+)?\b/g;
  let textWithNums = noParens.replace(numRe, function(match) {
    const t = transcribeNumberFullInterlingua(match);
    return t ?? match;
  });

  // Expandir litteras individual isolate
  const letterRe = /\b([A-Za-z])\b/g;
  textWithNums = textWithNums.replace(letterRe, function(match, letter: string) {
    const name = iaLetterName(letter);
    return name ?? match;
  });

  return textWithNums;
};

// Transcriber parola individual a IPA stricte secondo phonetic IALA / UMI
const transcribeWordInterlingua = function(word: string): string {
  const lowerWord = (word || '').toLowerCase();
  const chars = Array.from(lowerWord);

  if (chars.length === 0) return '';

  const isVowel = function(c: string): boolean { return 'aeiouy'.includes(c); };
  const vowelIndices: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (isVowel(chars[i]!)) vowelIndices.push(i);
  }

  if (vowelIndices.length === 0) return lowerWord;

  const effectiveLen = (lowerWord.endsWith('s') && chars.length > 1 && !lowerWord.endsWith('ss'))
    ? chars.length - 1
    : chars.length;

  const baseVowelIndices = vowelIndices.filter(function(idx) { return idx < effectiveLen; });
  if (baseVowelIndices.length === 0) return lowerWord;

  const lastCharBase = chars[effectiveLen - 1]!;
  const endsInVowel = isVowel(lastCharBase);
  const numVowels = baseVowelIndices.length;

  let stressedCharIdx: number;
  if (endsInVowel) {
    if (numVowels >= 2) {
      stressedCharIdx = baseVowelIndices[numVowels - 2]!;
    } else {
      stressedCharIdx = baseVowelIndices[0]!;
    }
  } else {
    stressedCharIdx = baseVowelIndices[numVowels - 1]!;
  }

  const baseWord = chars.slice(0, effectiveLen).join('');

  if (numVowels >= 3) {
    if (baseWord.endsWith('le') || baseWord.endsWith('ne') || baseWord.endsWith('re')) {
      const suffixLen = 2;
      if (effectiveLen > suffixLen && isVowel(chars[effectiveLen - suffixLen - 1]!)) {
        stressedCharIdx = baseVowelIndices[numVowels - 3]!;
      }
    } else if (baseWord.endsWith('ic')) {
      stressedCharIdx = baseVowelIndices[numVowels - 2]!;
    } else if (baseWord.endsWith('ica') || baseWord.endsWith('ico')
      || baseWord.endsWith('ide') || baseWord.endsWith('ido')
      || baseWord.endsWith('ula') || baseWord.endsWith('ulo')) {
      const nonDerivedIcaIco = [
        'formica', 'amica', 'amico', 'apico', 'pudica', 'pudico',
        'antica', 'antico', 'unica', 'unico'
      ];
      if (!nonDerivedIcaIco.includes(baseWord)) {
        stressedCharIdx = baseVowelIndices[numVowels - 3]!;
      }
    } else if (baseWord.endsWith('ific') || baseWord.endsWith('ifico')) {
      stressedCharIdx = baseVowelIndices[numVowels - 3]!;
    } else if (baseWord.endsWith('issime') || ['optime', 'maxime', 'pessime', 'ultime'].includes(baseWord)) {
      stressedCharIdx = baseVowelIndices[numVowels - 3]!;
    }
  }

  const weakEndings = ['ia', 'ie', 'io', 'iu', 'ua', 'ue', 'uo', 'ea', 'eo', 'eu'];
  if (numVowels >= 3 && weakEndings.some(function(s) { return baseWord.endsWith(s); })) {
    const isAtonicIaOrNce = baseWord.endsWith('ntia') || [
      'gloria', 'gratia', 'victoria', 'memoria', 'historia', 'injuria',
      'curia', 'miseria', 'furia', 'penuria', 'invidia', 'perfidia',
      'comedia', 'tragedia', 'familia', 'milia', 'pecunia', 'venia',
      'italia', 'britannia', 'scandia', 'california', 'virginia'
    ].includes(baseWord);

    const isExplicitTonicHiatus = [
      'ia', 'logia', 'graphia', 'metria', 'scopia', 'mania', 'phobia',
      'latria', 'gonia', 'nomia', 'tomia', 'pathia', 'cratia',
      'archia', 'urgia', 'sophia', 'theoria', 'melodia', 'poesia',
      'maria', 'eria', 'ea', 'eo', 'eu'
    ].some(function(s) { return baseWord.endsWith(s); });

    if (isAtonicIaOrNce || (!isExplicitTonicHiatus && (
      baseWord.endsWith('ie') || baseWord.endsWith('io') || baseWord.endsWith('iu') ||
      baseWord.endsWith('ua') || baseWord.endsWith('ue') || baseWord.endsWith('uo')
    ))) {
      stressedCharIdx = baseVowelIndices[numVowels - 3]!;
    }
  }

  // Tupla: [phonema IPA, es_vocal]
  const ipaParts: [string, boolean][] = [];
  let charIdx = 0;
  let stressedIpaIndex = 0;

  while (charIdx < chars.length) {
    const char = chars[charIdx]!;
    const next = chars[charIdx + 1] ?? null;
    const afterNext = chars[charIdx + 2] ?? null;
    const prev = charIdx > 0 ? chars[charIdx - 1]! : null;

    const isStressed = (charIdx === stressedCharIdx);
    if (isStressed) {
      stressedIpaIndex = ipaParts.length;
    }

    let handled = false;

    // Digramas
    if (char === 'c' && next === 'h') {
      ipaParts.push(['k', false]); charIdx += 2; handled = true;
    } else if (char === 'p' && next === 'h') {
      ipaParts.push(['f', false]); charIdx += 2; handled = true;
    } else if (char === 'q' && next === 'u') {
      ipaParts.push(['kw', false]); charIdx += 2; handled = true;
    } else if (char === 't' && next === 'h') {
      ipaParts.push(['t', false]); charIdx += 2; handled = true;
    } else if (char === 'r' && next === 'h') {
      ipaParts.push(['r', false]); charIdx += 2; handled = true;
    }

    // Consonantes geminate
    if (!handled && next === char && 'bdfglmnprt'.includes(char)) {
      charIdx++;
      continue;
    }
    if (!handled && char === 's' && next === 's') {
      ipaParts.push(['s', false]); charIdx += 2; handled = true;
    }

    if (handled) continue;

    switch (char) {
      case 'a': ipaParts.push(['a', true]); break;
      case 'e': ipaParts.push(['e', true]); break;
      case 'o': ipaParts.push(['o', true]); break;
      case 'i':
      case 'y': {
        const nextIsVowel = next && isVowel(next);
        if (!isStressed && nextIsVowel) {
          ipaParts.push(['j', false]);
        } else {
          ipaParts.push(['i', true]);
        }
        break;
      }
      case 'u': {
        const nextIsVowel = next && isVowel(next);
        const prevIsG = (prev === 'g');
        if ((!isStressed && nextIsVowel) || (prevIsG && nextIsVowel)) {
          ipaParts.push(['w', false]);
        } else {
          ipaParts.push(['u', true]);
        }
        break;
      }
      case 'b': ipaParts.push(['b', false]); break;
      case 'c':
        if (next && 'eiy'.includes(next)) {
          ipaParts.push(['ts', false]);
        } else {
          ipaParts.push(['k', false]);
        }
        break;
      case 'd': ipaParts.push(['d', false]); break;
      case 'f': ipaParts.push(['f', false]); break;
      case 'g': ipaParts.push(['ɡ', false]); break;
      case 'h': ipaParts.push(['h', false]); break;
      case 'j': ipaParts.push(['ʒ', false]); break;
      case 'k': ipaParts.push(['k', false]); break;
      case 'l': ipaParts.push(['l', false]); break;
      case 'm': ipaParts.push(['m', false]); break;
      case 'n': ipaParts.push(['n', false]); break;
      case 'p': ipaParts.push(['p', false]); break;
      case 'r': ipaParts.push(['r', false]); break;
      case 's': {
        // IALA §4: s – como -s in anglese {stay}; le norma primordial es /s/ surde
        ipaParts.push(['s', false]);
        break;
      }
      case 't': {
        const nextIsI = (next === 'i');
        const afterNextIsVowel = afterNext && isVowel(afterNext);
        const nextIStressed = ((charIdx + 1) === stressedCharIdx);
        if (nextIsI && afterNextIsVowel && !nextIStressed && prev !== 's') {
          ipaParts.push(['ts', false]);
        } else {
          ipaParts.push(['t', false]);
        }
        break;
      }
      case 'v': ipaParts.push(['v', false]); break;
      case 'w': ipaParts.push(['w', false]); break;
      case 'x': ipaParts.push(['ks', false]); break;
      case 'z': ipaParts.push(['z', false]); break;
      default: break;
    }
    charIdx++;
  }

  const nucleiIndices: number[] = [];
  for (let idx = 0; idx < ipaParts.length; idx++) {
    if (ipaParts[idx]![1]) nucleiIndices.push(idx);
  }

  const numSyllables = nucleiIndices.length;
  let stressedNucleusIdx = nucleiIndices.findIndex(function(idx) { return idx === stressedIpaIndex; });

  if (stressedNucleusIdx === -1) {
    if (numSyllables === 0) {
      stressedNucleusIdx = 0;
    } else {
      const lastPhoneme = ipaParts[ipaParts.length - 1]![0];
      const endsInVowelPhonetic = 'aeiou'.includes(lastPhoneme[lastPhoneme.length - 1] ?? '');
      if (endsInVowelPhonetic) {
        stressedNucleusIdx = numSyllables >= 2 ? numSyllables - 2 : 0;
      } else {
        stressedNucleusIdx = numSyllables - 1;
      }
    }
  }

  let result = '';
  let lastNucleusEnd = 0;

  for (let i = 0; i < nucleiIndices.length; i++) {
    const nucleusIdx = nucleiIndices[i]!;
    const consonantsSlice = ipaParts.slice(lastNucleusEnd, nucleusIdx);

    let splitPoint = 0;
    if (i > 0) {
      if (consonantsSlice.length <= 1) {
        splitPoint = 0;
      } else {
        let effLen = consonantsSlice.length;
        const lastCharStr = consonantsSlice[effLen - 1]![0];
        if (lastCharStr === 'j' || lastCharStr === 'w') {
          effLen = Math.max(0, effLen - 1);
        }
        if (effLen <= 1) {
          splitPoint = 0;
        } else {
          const penultC = consonantsSlice[effLen - 2]![0];
          const lastC = consonantsSlice[effLen - 1]![0];
          const isStop = 'pbtdkɡfv'.includes(penultC);
          const isLiquid = 'lr'.includes(lastC);
          if (isStop && isLiquid) {
            splitPoint = effLen - 2;
          } else {
            splitPoint = effLen - 1;
          }
        }
      }
    }

    for (let k = 0; k < splitPoint; k++) {
      result += consonantsSlice[k]![0];
    }
    if (i > 0) {
      result += '.';
    }
    if (i === stressedNucleusIdx) {
      result += 'ˈ';
    }
    for (let k = splitPoint; k < consonantsSlice.length; k++) {
      result += consonantsSlice[k]![0];
    }
    result += ipaParts[nucleusIdx]![0];
    lastNucleusEnd = nucleusIdx + 1;
  }

  for (let k = lastNucleusEnd; k < ipaParts.length; k++) {
    result += ipaParts[k]![0];
  }

  return result;
};

const transcribeInterlinguaToSsml = function(text: string): string {
  const textExpanded = preprocessInterlinguaText(text);
  const delimiters = " ,.?!;:\u201C\u201D\u00AB\u00BB()'-";
  const parts: string[] = [];
  let last = 0;

  for (let i = 0; i < textExpanded.length; i++) {
    if (delimiters.includes(textExpanded[i]!)) {
      if (last < i) parts.push(textExpanded.slice(last, i));
      parts.push(textExpanded[i]!);
      last = i + 1;
    }
  }
  if (last < textExpanded.length) {
    parts.push(textExpanded.slice(last));
  }

  const processedParts = parts.map(function(part) {
    if (part === ',') return ',<break time="250ms"/>';
    if (!part.trim() || Array.from(part).every(function(c) { return delimiters.includes(c); })) {
      return part;
    }
    const wordToProcess = part.trim();
    const ipa = transcribeWordInterlingua(wordToProcess);
    if (!ipa) {
      return wordToProcess;
    } else {
      return '<phoneme alphabet="ipa" ph="' + ipa + '">' + wordToProcess + '</phoneme>';
    }
  });

  return '<speak>' + processedParts.join('') + '</speak>';
};

const getInterlinguaIpaString = function(text: string): string {
  const delimiters = " ,.?!;:\u201C\u201D\u00AB\u00BB()'-";
  const parts: string[] = [];
  let last = 0;

  for (let i = 0; i < text.length; i++) {
    if (delimiters.includes(text[i]!)) {
      if (last < i) parts.push(text.slice(last, i));
      parts.push(text[i]!);
      last = i + 1;
    }
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.map(function(part) {
    if (!part.trim() || Array.from(part).every(function(c) { return delimiters.includes(c); })) {
      return part;
    }
    const wordToProcess = part.trim();
    const ipa = transcribeWordInterlingua(wordToProcess);
    return ipa || wordToProcess;
  }).join('');
};

// API publica del modulo
export const InterlinguaTranscriber = {
  transcribeInterlinguaToSsml,
  getInterlinguaIpaString,
  transcribeWordInterlingua,
  iaLetterName,
  numAtomInterlingua,
  transcribeIntInterlingua,
  preprocessInterlinguaText
};

// Retrocompatibilitate con scripts global (script tags sin bundler)
if (typeof window !== 'undefined') {
  window.InterlinguaTranscriber = InterlinguaTranscriber;
}

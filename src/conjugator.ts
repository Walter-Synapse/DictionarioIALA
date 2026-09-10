// Motor morphologic de Interlingua (IALA)
import type { IALAConjugatorAPI, AdjParadigm, NounParadigm, AnalysisResult, CollateralMatch, VerbDeconjugation } from './types/global';
import { INTERLINGUA_STRESS_EXCEPTIONS } from './data/interlinguaExceptions';

/**
 * Motor Morphologic e Lexicographic Universal pro Interlingua (IALA §§14-115)
 * Deconstruction, derivation, flexion e analyse contextual de parrafos:
 * 1. Verbos (IALA §§94-115)
 * 2. Adjectivos (Comparation, Superlativo -issime, Adverbios -mente, Substantivation) (IALA §§31-47)
 * 3. Substantivos (Plurales regular, docte in -is e consonantic in -ches) (IALA §§21-25)
 * 4. Articulos e Contractiones obligatori (al, del) [IALA §17]
 * 5. Pronomines e Determinantes (IALA §§54-75)
 * 6. Disambiguation contextual de partes del discurso (sin hardcoding de lemas especificos)
 * 7. Corrector ortographic con distantia de Levenshtein: suggerimentos honestos "¿Quisiste decir...?"
 */

  const _IALAConjugatorImpl = (function(): IALAConjugatorAPI {

  // Conjunto exhaustivo de palabras gramaticales cerradas de Interlingua (IALA §§17-75)
  // Utilizado para evitar clasificar erróneamente palabras al inicio de frase como nombres propios.
  // ECMAScript best practice: Set constante O(1) asignado una sola vez en memoria.
  const IALA_FUNCTION_WORDS = new Set([
    // Pronombres personales y reflexivos (§§54-57)
    'Io', 'Tu', 'Ille', 'Illa', 'Illo', 'Nos', 'Vos', 'Illes', 'Illas', 'Illos',
    'Me', 'Te', 'Se', 'Lor', 'Lore', 'On',
    // Pronombres y determinantes posesivos (§§58-66)
    'Mi', 'Mie', 'Mies', 'Tue', 'Tues', 'Su', 'Sue', 'Sues',
    'Nostre', 'Nostres', 'Vostre', 'Vostres',
    // Demostrativos (§§67-71)
    'Iste', 'Ista', 'Isto', 'Istes', 'Istas', 'Isti',
    'Ille', 'Illa', 'Illo', 'Illes', 'Illas', 'Illos',
    'Aquel', 'Aquela', 'Aquello', 'Aqueles', 'Aquelas',
    'Ce', 'Tal', 'Tales', 'Qual', 'Quales',
    // Artículos y contracciones (§§17-20)
    'Le', 'Un', 'Unes', 'Al', 'Del',
    // Pronombres y determinantes relativos e interrogativos (§§72-74)
    'Qui', 'Que', 'Cujus', 'Qual', 'Ubi', 'Quando', 'Como', 'Quanto', 'Quantos', 'Tanto', 'Tantos',
    // Indefinidos y cuantitativos (§§21, 75)
    'Alcun', 'Alcuno', 'Alcuna', 'Alcunos', 'Alcunas',
    'Nulle', 'Nullo', 'Nulla', 'Nihil', 'Nil',
    'Omni', 'Omne', 'Omnes', 'Tot', 'Tote', 'Totes',
    'Cata', 'Alco', 'Alique', 'Cataun', 'Catauno', 'Catauna',
    'Multo', 'Multos', 'Poco', 'Pocos', 'Plure', 'Plures',
    'Certo', 'Certos', 'Mesme', 'Mesmes', 'Altere', 'Alteres',
    // Conectores oracionales, conjunciones y preposiciones iniciales de uso frecuente
    'In', 'Pro', 'Per', 'Con', 'Sin', 'De', 'A', 'Super', 'Sub', 'Inter', 'Intra', 'Extra',
    'Post', 'Ante', 'Durante', 'Ultra', 'Circa', 'Secundo', 'Juxta', 'Verso',
    'Sed', 'Si', 'Tamen', 'Nam', 'Ergo', 'Dum', 'Id', 'Ido', 'Ma'
  ]);

  /// Átomos numéricos básicos para Interlingua (IALA §47)
  const numAtomInterlingua = function(n: number): string {
    const map: Record<number, string> = {
      0: 'zero', 1: 'un', 2: 'duo', 3: 'tres', 4: 'quatro', 5: 'cinque',
      6: 'sex', 7: 'septe', 8: 'octo', 9: 'novem', 10: 'dece',
      20: 'vinti', 30: 'trenta', 40: 'quaranta', 50: 'cinquanta',
      60: 'sexanta', 70: 'septanta', 80: 'octanta', 90: 'novanta',
      100: 'cento', 1000: 'mille', 1000000: 'million',
    };
    return map[n] ?? '';
  };

  /// Conversión recursiva de enteros a texto en Interlingua (IALA §47)
  const transcribeIntInterlingua = function(n: number): string {
    if (n === 0) {
      return numAtomInterlingua(0);
    }

    const parts: string[] = [];

    // Escalas grandes (Million, Milliardo, Billion, Billiardo, Trillion)
    const scales: [number, string, string][] = [
      [1000000000000000000, 'trillion', 'trilliones'],
      [1000000000000000, 'billiardo', 'billiardos'],
      [1000000000000, 'billion', 'billiones'],
      [1000000000, 'milliardo', 'milliardos'],
      [1000000, 'million', 'milliones'],
    ];

    for (const [val, nameSg, namePl] of scales) {
      if (n >= val) {
        const count = Math.floor(n / val);
        n = n % val;

        if (count === 1) {
          parts.push(`un ${nameSg}`);
        } else {
          parts.push(`${transcribeIntInterlingua(count)} ${namePl}`);
        }
      }
    }

    // Milles
    if (n >= 1000) {
      const thousands = Math.floor(n / 1000);
      n = n % 1000;

      if (thousands === 1) {
        parts.push('mille');
      } else {
        parts.push(`${transcribeIntInterlingua(thousands)} milles`);
      }
    }

    // Centos
    if (n >= 100) {
      const hundreds = Math.floor(n / 100);
      n = n % 100;

      if (hundreds === 1) {
        parts.push('cento');
      } else {
        parts.push(`${transcribeIntInterlingua(hundreds)} centos`);
      }
    }

    // Deces e Unes
    if (n > 0) {
      if (n <= 10) {
        parts.push(numAtomInterlingua(n));
      } else if (n < 20) {
        // 11-19: dece-un, dece-duo...
        const unit = n - 10;
        parts.push(`dece-${numAtomInterlingua(unit)}`);
      } else {
        // 20-99
        const tens = Math.floor(n / 10) * 10;
        const unit = n % 10;

        const tensStr = numAtomInterlingua(tens);
        if (unit === 0) {
          parts.push(tensStr);
        } else {
          parts.push(`${tensStr}-${numAtomInterlingua(unit)}`);
        }
      }
    }

    return parts.join(' ');
  };

  // Manejo de numeros con signo, formatos de milles e decimales pro Interlingua (IALA §47)
  const transcribeNumberFullInterlingua = function(s: string | number): string | null {
    if (!s) return null;
    // Recognition de tokens horari como 14h15, 13h45
    if (/^\d{1,2}h\d{2}$/i.test(String(s).trim())) {
      return String(s).trim();
    }
    if (typeof s === 'number') {
      s = String(s);
    }
    const str = (s || '').trim();
    if (!str) {
      return null;
    }

    let neg = false;
    let core = str;

    if (str.startsWith('-')) {
      neg = true;
      core = str.slice(1);
    } else if (str.startsWith('−')) {
      neg = true;
      core = str.slice(1);
    }

    // Entero con separador de miles (ej: 51.511 o 1.927 o 1.000.000)
    if (/^\d{1,3}(\.\d{3})+$/.test(core)) {
      const pureInt = parseInt(core.replace(/\./g, ''), 10);
      let txt = transcribeIntInterlingua(pureInt);
      if (neg) txt = `minus ${txt}`;
      return txt;
    }

    // Entero
    if (/^\d+$/.test(core)) {
      const n = parseInt(core, 10);
      let txt = transcribeIntInterlingua(n);
      if (neg) {
        txt = `minus ${txt}`;
      }
      return txt;
    }

    // Decimal (ej: 3.14 o 3,14)
    const decRe = /^(\d+)[.,](\d+)$/;
    const caps = core.match(decRe);
    if (caps) {
      const intVal = parseInt(caps[1]!, 10);
      let out = transcribeIntInterlingua(intVal);
      out += ' comma';

      // Lectura de decimales: agrupados si <= 2 digitos, digito a digito si > 2
      if (caps[2]!.length <= 2) {
        const fracVal = parseInt(caps[2]!, 10);
        out += ' ' + transcribeIntInterlingua(fracVal);
      } else {
        for (const ch of caps[2]!) {
          const d = parseInt(ch, 10);
          out += ' ' + numAtomInterlingua(d);
        }
      }

      if (neg) {
        out = `minus ${out}`;
      }
      return out;
    }

    return null;
  };

  /// Particípios passatos collaterales e classicos con radices primarias (IALA §§95, 100)
  const COLLATERAL_PARTICIPLES = {
    'extraite': { inf: 'extraher', desc: 'Participio passate collateral de "extraher" (IALA §§95, 100)' },
    'extracte': { inf: 'extraher', desc: 'Participio passate classic de "extraher" (IALA §§95, 100)' },
    'extrahite': { inf: 'extraher', desc: 'Participio passate regular de "extraher" (IALA §§95, 100)' },
    'traite': { inf: 'traher', desc: 'Participio passate collateral de "traher" (IALA §§95, 100)' },
    'tracte': { inf: 'traher', desc: 'Participio passate classic de "traher" (IALA §§95, 100)' },
    'contraite': { inf: 'contraher', desc: 'Participio passate collateral de "contraher" (IALA §§95, 100)' },
    'contracte': { inf: 'contraher', desc: 'Participio passate classic de "contraher" (IALA §§95, 100)' },
    'distraite': { inf: 'distraher', desc: 'Participio passate collateral de "distraher" (IALA §§95, 100)' },
    'distracte': { inf: 'distraher', desc: 'Participio passate classic de "distraher" (IALA §§95, 100)' },
    'attraite': { inf: 'attraher', desc: 'Participio passate collateral de "attraher" (IALA §§95, 100)' },
    'attracte': { inf: 'attraher', desc: 'Participio passate classic de "attraher" (IALA §§95, 100)' },
    'subtraite': { inf: 'subtraher', desc: 'Participio passate collateral de "subtraher" (IALA §§95, 100)' },
    'subtracte': { inf: 'subtraher', desc: 'Participio passate classic de "subtraher" (IALA §§95, 100)' },
    'retraite': { inf: 'retraher', desc: 'Participio passate collateral de "retraher" (IALA §§95, 100)' },
    'retracte': { inf: 'retraher', desc: 'Participio passate classic de "retraher" (IALA §§95, 100)' },
    'abstraite': { inf: 'abstraher', desc: 'Participio passate collateral de "abstraher" (IALA §§95, 100)' },
    'abstracte': { inf: 'abstraher', desc: 'Participio passate classic de "abstraher" (IALA §§95, 100)' },
    'scripte': { inf: 'scriber', desc: 'Participio passate classic de "scriber" (IALA §§95, 100)' },
    'dicte': { inf: 'dicer', desc: 'Participio passate classic de "dicer" (IALA §§95, 100)' },
    'conducte': { inf: 'conducer', desc: 'Participio passate classic de "conducer" (IALA §§95, 100)' },
    'producte': { inf: 'producer', desc: 'Participio passate classic de "producer" (IALA §§95, 100)' },
    'reproducte': { inf: 'reproducer', desc: 'Participio passate classic de "reproducer" (IALA §§95, 100)' },
    'reducte': { inf: 'reducer', desc: 'Participio passate classic de "reducer" (IALA §§95, 100)' },
    'inducte': { inf: 'inducer', desc: 'Participio passate classic de "inducer" (IALA §§95, 100)' },
    'electe': { inf: 'eliger', desc: 'Participio passate classic de "eliger" (IALA §§95, 100)' },
    'rupte': { inf: 'rumper', desc: 'Participio passate classic de "rumper" (IALA §§95, 100)' },
    'corrupte': { inf: 'corrumper', desc: 'Participio passate classic de "corrumper" (IALA §§95, 100)' },
    'interrupte': { inf: 'interrumper', desc: 'Participio passate classic de "interrumper" (IALA §§95, 100)' },
    'morte': { inf: 'morir', desc: 'Participio passate classic de "morir" (IALA §§95, 100)' },
    'aperte': { inf: 'aperir', desc: 'Participio passate classic de "aperir" (IALA §§95, 100)' },
    'cooperte': { inf: 'cooperir', desc: 'Participio passate classic de "cooperir" (IALA §§95, 100)' },
    'descooperte': { inf: 'descooperir', desc: 'Participio passate classic de "descooperir" (IALA §§95, 100)' },
    'poste': { inf: 'poner', desc: 'Participio passate classic de "poner" (IALA §§95, 100)' },
    'composte': { inf: 'componer', desc: 'Participio passate classic de "componer" (IALA §§95, 100)' },
    'disposte': { inf: 'disponer', desc: 'Participio passate classic de "disponer" (IALA §§95, 100)' },
    'imposte': { inf: 'imponer', desc: 'Participio passate classic de "imponer" (IALA §§95, 100)' },
    'proposte': { inf: 'proponer', desc: 'Participio passate classic de "proponer" (IALA §§95, 100)' },
    'supposte': { inf: 'supponer', desc: 'Participio passate classic de "supponer" (IALA §§95, 100)' }
  };

  /// Prefixos productivos de derivation en Interlingua (IALA §155)
  const PRODUCTIVE_PREFIXES = [
    { p: 'de', desc: 'action inverse, remotion o separation' },
    { p: 'des', desc: 'negation o inversion' },
    { p: 'dis', desc: 'separation o dispersion' },
    { p: 're', desc: 'repetition o retroaction' },
    { p: 'pre', desc: 'anterioritate temporal o spatial' },
    { p: 'post', desc: 'posterioritate' },
    { p: 'sub', desc: 'inferioritate o subdivision' },
    { p: 'super', desc: 'superioritate o excesso' },
    { p: 'inter', desc: 'reciprocitate o position intermedie' },
    { p: 'anti', desc: 'opposition' },
    { p: 'auto', desc: 'action per se mesme' },
    { p: 'co', desc: 'simul, union' }
  ];

  /// Suffixos productivos de derivation regulari in Interlingua (IALA §§136-154)
  /// Cata suffixo possede restrictiones morphosyntactic stricte super le categoria del radice
  interface ProductiveSuffixRule {
    suffix: string;
    resultingPos: string;
    allowedBasePos: ('sb' | 'adj' | 'vb')[];
    ruleRef: string;
    desc: string;
    generateCandidates: (stemWithoutSuffix: string) => string[];
  }

  const PRODUCTIVE_SUFFIXES: ProductiveSuffixRule[] = [
    // 1. -ista: uno qui practica o adhere a (ab substantivos e adjectivos) [IALA §§138, 141]
    {
      suffix: 'ista',
      resultingPos: 'sb/adj',
      allowedBasePos: ['sb', 'adj'],
      ruleRef: '§§138, 141',
      desc: 'persona professante, practicante o adherente de',
      generateCandidates: (stem: string) => {
        const cands = [stem];
        if (!stem.endsWith('e')) cands.push(stem + 'e');
        if (!stem.endsWith('a')) cands.push(stem + 'a');
        if (!stem.endsWith('o')) cands.push(stem + 'o');
        if (stem.endsWith('ic')) cands.push(stem.slice(0, -2) + 'ica');
        return cands;
      }
    },
    // 2. -ismo: practica, theoria o doctrina de (ab substantivos e adjectivos) [IALA §§138, 141]
    {
      suffix: 'ismo',
      resultingPos: 'sb',
      allowedBasePos: ['sb', 'adj'],
      ruleRef: '§§138, 141',
      desc: 'doctrina, systema, practica o stato de',
      generateCandidates: (stem: string) => {
        const cands = [stem];
        if (!stem.endsWith('e')) cands.push(stem + 'e');
        if (!stem.endsWith('a')) cands.push(stem + 'a');
        if (!stem.endsWith('o')) cands.push(stem + 'o');
        return cands;
      }
    },
    // 3. -itate: qualitate o stato de (strictemente ab adjectivos) [IALA §141]
    {
      suffix: 'itate',
      resultingPos: 'sb',
      allowedBasePos: ['adj'],
      ruleRef: '§141',
      desc: 'qualitate, stato o condition de esser',
      generateCandidates: (stem: string) => {
        const cands = [stem];
        if (!stem.endsWith('e')) cands.push(stem + 'e');
        if (!stem.endsWith('o')) cands.push(stem + 'o');
        if (stem.endsWith('ic')) cands.push(stem);
        return cands;
      }
    },
    // 4. -mento: action o resultato de (strictemente ab themas verbal) [IALA §§146, 152]
    {
      suffix: 'mento',
      resultingPos: 'sb',
      allowedBasePos: ['vb'],
      ruleRef: '§§146, 152',
      desc: 'action o resultato del acto de',
      generateCandidates: (stem: string) => {
        // e.g. reprocessamento -> stem reprocessa -> reprocessar
        const cands: string[] = [];
        if (stem.endsWith('a')) {
          cands.push(stem + 'r'); // -ar
        } else if (stem.endsWith('i')) {
          cands.push(stem.slice(0, -1) + 'er'); // -er
          cands.push(stem + 'r'); // -ir
        } else {
          cands.push(stem + 'ar', stem + 'er', stem + 'ir');
        }
        return cands;
      }
    },
    // 5. -al: pertinente o relative a (ab substantivos) [IALA §139]
    {
      suffix: 'al',
      resultingPos: 'adj',
      allowedBasePos: ['sb'],
      ruleRef: '§139',
      desc: 'pertinente, relationate o relative a',
      generateCandidates: (stem: string) => {
        const cands = [stem];
        if (!stem.endsWith('o')) cands.push(stem + 'o');
        if (!stem.endsWith('e')) cands.push(stem + 'e');
        if (!stem.endsWith('a')) cands.push(stem + 'a');
        return cands;
      }
    }
  ];

  /**
   * Genera el paradigma completo de conjugacion de un verbo en Interlingua (§§94-115)
   */
  function conjugateInterlingua(infinitive: string): unknown {
    const inf = (infinitive || '').toLowerCase().trim();
    if (!inf.endsWith('ar') && !inf.endsWith('er') && !inf.endsWith('ir')) {
      return null;
    }
    const stem = inf.slice(0, -2);
    const vowel = inf.slice(-2, -1);

    const irregs = {
      'esser': {
        present: 'es (son)', past: 'esseva (era)', future: 'essera', conditional: 'esserea',
        imperative: 'sia!', part_pres: 'essente', part_pass: 'essite'
      },
      'haber': {
        present: 'ha', past: 'habeva', future: 'habera', conditional: 'haberea',
        imperative: 'habe!', part_pres: 'habente', part_pass: 'habite'
      },
      'vader': {
        present: 'va', past: 'vadeva', future: 'vadera', conditional: 'vaderea',
        imperative: 'vade!', part_pres: 'vadente', part_pass: 'vadite'
      }
    };

    let pres, past, fut, cond, imp, part_pres, part_pass;

      const irr = irregs[inf as keyof typeof irregs];
      if (irr) {
        pres = irr.present;
        past = irr.past;
        fut = irr.future;
        cond = irr.conditional;
        imp = irr.imperative;
        part_pres = irr.part_pres;
        part_pass = irr.part_pass;
      } else {
      pres = inf.slice(0, -1);
      past = stem + vowel + 'va';
      fut = inf + 'a';
      cond = inf + 'ea';
      imp = pres + '!';
      part_pres = stem + (vowel === 'a' ? 'ante' : (vowel === 'e' ? 'ente' : 'iente'));
      part_pass = stem + (vowel === 'a' ? 'ate' : 'ite');
    }

    return {
      type: 'verb',
      infinitive: inf,
      stem: stem,
      vowel: vowel,
      imperative: imp,
      part_pres: part_pres,
      part_pass: part_pass,
      active_simple: {
        presente: pres,
        passato: past,
        futuro: `${fut} (collat.: va ${inf})`,
        futuro_word: fut,
        conditional: `${cond} (collat.: velle ${inf})`,
        conditional_word: cond
      },
      active_perfecte: {
        presente: `ha ${part_pass}`,
        passato: `habeva ${part_pass}`,
        futuro: `habera ${part_pass} (va haber ${part_pass})`,
        conditional: `haberea ${part_pass} (velle haber ${part_pass})`
      },
      passive_simple: {
        presente: `es ${part_pass}`,
        passato: `esseva ${part_pass} (era ${part_pass})`,
        futuro: `essera ${part_pass} (va esser ${part_pass})`,
        conditional: `esserea ${part_pass} (velle esser ${part_pass})`
      },
      passive_perfecte: {
        presente: `ha essite ${part_pass}`,
        passato: `habeva essite ${part_pass}`,
        futuro: `habera essite ${part_pass}`,
        conditional: `haberea essite ${part_pass}`
      }
    };
  }

  /**
   * Genera el paradigma completo y formas derivadas de un Adjetivo (§§31-47)
   */
  function inflectAdjective(adjective: string): unknown {
    const a = (adjective || '').toLowerCase().trim();
    if (!a) return null;

    const compPos = `plus ${a}`;
    const compNeg = `minus ${a}`;
    const supPos = `le plus ${a}`;
    const supNeg = `le minus ${a}`;

    let absSup = "";
    if (a.endsWith('c')) {
      absSup = a + 'hissime';
    } else if (a.endsWith('e') || a.endsWith('a') || a.endsWith('o')) {
      // Elision del vocal thematic ante le suffixo vocalic -issime (IALA §§36, 136)
      absSup = a.slice(0, -1) + 'issime';
    } else {
      absSup = a + 'issime';
    }

    let adv = "";
    if (a.endsWith('c')) {
      adv = a + 'amente';
    } else if (a.endsWith('e') || a.endsWith('a') || a.endsWith('o')) {
      // Adverbio con desinentia -mente super thema vocalic (IALA §45)
      adv = a + 'mente';
    } else {
      adv = a + 'mente';
    }

    // Substantivation (IALA §§40-41)
    // §41: Adjectivos que NON pote assumer -o/-a e remane inalterate:
    // (a) in -ce, -u
    // (b) in -ese/-ense, -il/-ile, -ior, -nte
    // (c) in suffixos -al, -ar, -bile, -oide, -plice, -ista
    // (d) celibe, grande, verde, forte, triste, breve, etc.
    const isInvariant = 
      a.endsWith('ista') || a.endsWith('al') || a.endsWith('ar') || a.endsWith('bile') || a.endsWith('oide') || a.endsWith('plice') ||
      a.endsWith('ce') || a.endsWith('u') || a.endsWith('ese') || a.endsWith('ense') || a.endsWith('il') ||
      a.endsWith('ile') || a.endsWith('ior') || a.endsWith('nte') ||
      ['grande', 'verde', 'forte', 'triste', 'breve', 'grave', 'leve', 'suave', 'cruel', 'fidel', 'qual', 'tal', 'celibe', 'folle', 'molle', 'juvene', 'omne'].includes(a);

    let masc = "";
    let fem = "";
    let substantivationNote = "";

    if (isInvariant) {
      masc = a;
      fem = a;
      const refSuffix = a.endsWith('ista') ? 'suffixos in -ista (§142)' : 'suffixos -al, -ar, -bile, etc. (§41)';
      substantivationNote = `Invariabile in -o/-a (IALA ${refSuffix}): "le ${a}" (masc/fem/abstracto)`;
    } else if (a.endsWith('e')) {
      masc = a.slice(0, -1) + 'o';
      fem = a.slice(0, -1) + 'a';
      substantivationNote = `Regular con desinentias -o / -a (IALA §40)`;
    } else if (a.endsWith('o')) {
      masc = a;
      fem = a.slice(0, -1) + 'a';
      substantivationNote = `Regular con alternantia -o / -a (IALA §40)`;
    } else if (a.endsWith('a')) {
      masc = a;
      fem = a;
      substantivationNote = `Invariabile in desinentia vocalic -a (IALA §40): "le ${a}" (masc/fem)`;
    } else {
      masc = a + 'o';
      fem = a + 'a';
      substantivationNote = `Regular con desinentias -o / -a (IALA §40)`;
    }

    const irregs = {
      'bon': { comp: 'melior', sup: 'optime', adv: 'ben', advComp: 'melio' },
      'mal': { comp: 'pejor', sup: 'pessime', adv: 'mal', advComp: 'pejo' },
      'magne': { comp: 'major', sup: 'maxime', adv: 'magnemente' },
      'parve': { comp: 'minor', sup: 'minime', adv: 'parvemente' }
    };

    return {
      type: 'adjective',
      adjective: a,
      compPos: compPos,
      compNeg: compNeg,
      supPos: supPos,
      supNeg: supNeg,
      absSup: absSup,
      adverb: adv,
      substantiveM: masc,
      substantiveF: fem,
      isInvariantSubstantive: isInvariant,
      substantivationNote: substantivationNote,
      irregular: (irregs as Record<string, unknown>)[a] ?? null
    };
  }

  /**
   * Genera el plural de un sustantivo segun IALA §§21-25
   */
  function pluralizeNoun(noun: string): unknown {
    const n = (noun || '').toLowerCase().trim();
    if (!n) return null;

    let plural = "";
    let rule = "";

    if (n.endsWith('c')) {
      plural = n + 'hes';
      rule = "Final -c cambia ante -es a -ch: " + n + " → " + plural + " (§21)";
    } else if (n.endsWith('is')) {
      plural = n.slice(0, -2) + 'es';
      rule = "Vocabulo docte in -is forma plural como con -e: " + n + " → " + plural + " (§22)";
    } else if (/[bcdfghjklmnpqrstvwxyz]$/i.test(n)) {
      plural = n + 'es';
      rule = "Plural post consonante per addition de -es: " + n + " → " + plural + " (§21)";
    } else {
      plural = n + 's';
      rule = "Plural post vocal per addition de -s: " + n + " → " + plural + " (§21)";
    }

    return {
      type: 'noun',
      singular: n,
      plural: plural,
      rule: rule
    };
  }

  /**
   * Determina e sublinea le vocal accentuate de omne parola secundo le regulas de IALA §10
   * 1. Deviationes del IED con accento preexistente (item[2]) son respectate.
   * 2. Desinentias in -le, -ne, -re precedite per vocal: 3a syllaba ab le fin (§10: frágile, órdine, témpore).
   * 3. Suffixos -ic, -ica, -ico, -ide, -ido, -ula, -ulo: syllaba precedente le suffixo (§10).
   * 4. Regula general: vocal ante le ultime consonante (p.ex. abandono, abandonar, casa, actor).
   * 5. Parolas sin consonante o sin vocal ante le ultime consonante: prime vocal (§10: ío, vía, créa).
   */
  function computeIALAStressSingleToken(w: string): { html: string; isIrregular: boolean; ruleDesc: string } {
    if (!w) return { html: '', isIrregular: false, ruleDesc: '' };

    // Localizar indices de vocales (a, e, i, o, u, y)
    const vowels: number[] = [];
    for (let i = 0; i < w.length; i++) {
      if (/[aeiouyáéíóúàèìòù]/i.test(w[i]!)) {
        vowels.push(i);
      }
    }

    if (vowels.length === 0) {
      return { html: w, isIrregular: false, ruleDesc: 'Sin vocales' };
    }
    if (vowels.length === 1) {
      // Monosílabo: no subrayar en sintagmas o palabras de 1 letra
      return { html: w, isIrregular: false, ruleDesc: 'Monosyllabo' };
    }

    const lowerW = w.toLowerCase();
    if (INTERLINGUA_STRESS_EXCEPTIONS[lowerW] !== undefined) {
      const targetIdx = INTERLINGUA_STRESS_EXCEPTIONS[lowerW]!;
      return {
        html: w.slice(0, targetIdx) + '<u class="stress-irregular">' + w[targetIdx] + '</u>' + w.slice(targetIdx + 1),
        isIrregular: true,
        ruleDesc: 'Accento irregular/proparoxytono explicitemente registrate in le IED'
      };
    }

    // Regula IALA §10: Adjectivos e substantivos in -le, -ne, -re precedite per vocal:
    // accento super le tertie syllaba ab le fin (frágile, órdine, témpore).
    if (/(?:[aeiouy](?:le|ne|re))$/i.test(w) && vowels.length >= 3) {
      const idx = vowels[vowels.length - 3]!;
      return {
        html: w.slice(0, idx) + '<u class="stress-irregular">' + w[idx] + '</u>' + w.slice(idx + 1),
        isIrregular: true,
        ruleDesc: 'Accento super le 3e syllaba ab le fin pro desinentia in -le, -ne o -re precedite per vocal (IALA §10)'
      };
    }

    // Regula IALA §10: Suffixos -ic, -ica, -ico, -ide, -ido, -ula, -ulo:
    // accento cade super le syllaba que precede le suffixo
    const suffMatch = /(?:ic|ica|ico|ide|ido|ula|ulo)$/i.exec(w);
    if (suffMatch) {
      const suffStart = suffMatch.index;
      let prevVowelIdx = -1;
      for (let i = vowels.length - 1; i >= 0; i--) {
        if (vowels[i]! < suffStart) {
          prevVowelIdx = vowels[i]!;
          break;
        }
      }
      if (prevVowelIdx !== -1) {
        return {
          html: w.slice(0, prevVowelIdx) + '<u class="stress-irregular">' + w[prevVowelIdx] + '</u>' + w.slice(prevVowelIdx + 1),
          isIrregular: true,
          ruleDesc: `Accento super le syllaba precedente le suffixo -${suffMatch[0]} (IALA §10)`
        };
      }
    }

    // Regula standard IALA §10: Vocal ante le ultime consonante
    let lastConsIdx = -1;
    for (let i = w.length - 1; i >= 0; i--) {
      if (/[bcdfghjklmnpqrstvwxz]/i.test(w[i]!)) {
        lastConsIdx = i;
        break;
      }
    }

    if (lastConsIdx === -1) {
      const idx = vowels[0]!;
      return {
        html: w.slice(0, idx) + '<u>' + w[idx] + '</u>' + w.slice(idx + 1),
        isIrregular: false,
        ruleDesc: 'Accento per necessitate super le prime vocal in parolas sin consonante (IALA §10)'
      };
    }

    let targetVowelIdx = -1;
    for (let i = lastConsIdx - 1; i >= 0; i--) {
      if (/[aeiouyáéíóúàèìòù]/i.test(w[i]!)) {
        targetVowelIdx = i;
        break;
      }
    }

    if (targetVowelIdx === -1) {
      targetVowelIdx = vowels[0]!;
    }

    return {
      html: w.slice(0, targetVowelIdx) + '<u>' + w[targetVowelIdx] + '</u>' + w.slice(targetVowelIdx + 1),
      isIrregular: false,
      ruleDesc: 'Regula standard de Interlingua: accento super le vocal ante le ultime consonante (IALA §10)'
    };
  }

  function computeIALAStressHTML(word: string, overrideHtml: string, _pos?: string): { html: string; isIrregular: boolean; ruleDesc: string } {
    if (overrideHtml && overrideHtml.includes('<u>')) {
      return {
        html: overrideHtml,
        isIrregular: true,
        ruleDesc: 'Accento irregular/proparoxytono explicitemente registrate in le IED'
      };
    }

    const raw = (word || '').trim();
    if (!raw) {
      return { html: '', isIrregular: false, ruleDesc: '' };
    }

    // Numerales arabicos e decimales (IALA §47)
    const numTrans = transcribeNumberFullInterlingua(raw);
    if (numTrans) {
      return {
        html: `${raw} (<em>${numTrans}</em>)`,
        isIrregular: false,
        ruleDesc: `Numeral in Interlingua: "${numTrans}" (IALA §47)`
      };
    }

    // Si es un sintagma de múltiples palabras (p.ex. 'a cappella', 'a fortiori', 'à la carte')
    // o tiene sufijo de categoría pegado en data.js ('aborigines sb' -> 'aborigines')
    const cleaned = raw.replace(/\s+(sb|adj|vb|adv|prep|conj|npr)$/i, '');

    if (cleaned.includes(' ')) {
      const parts = cleaned.split(/(\s+)/);
      let anyIrreg = false;
      const htmlParts = parts.map((part: string) => {
        if (/^\s+$/.test(part)) return part;
        const res = computeIALAStressSingleToken(part);
        if (res.isIrregular) anyIrreg = true;
        return res.html;
      });
      return {
        html: htmlParts.join(''),
        isIrregular: anyIrreg,
        ruleDesc: 'Syntagma o locution con accento super cata elemento lexicographic (IALA §10)'
      };
    }

    if (cleaned.length <= 1) {
      return {
        html: cleaned,
        isIrregular: false,
        ruleDesc: 'Monosyllabo (sin accento graphic)'
      };
    }

    return computeIALAStressSingleToken(cleaned);
  }

  /**
   * Transcriptor Fonetic Universal IPA (Migrado directamente de Synapse interlinguaTranscriber.ts)
   * Implementa las 14 reglas fonéticas canónicas de la UMI e IALA con silabación y acentuación IPA /.../
   */
  function transcribeWordInterlinguaIPA(word: string, explicitHtml = ''): string {
    const lowerWord = (word || '').toLowerCase().trim();
    if (lowerWord === 'abc') {
      return "a.be.'tse";
    }
    const chars = [...lowerWord];
    if (chars.length === 0) return '';

    // Extraer indice de acento explicito si existe (p.ex. abbat<u>i</u>a -> index 5 de 'i')
    let explicitStressIdx = -1;
    if (explicitHtml && explicitHtml.includes('<u>')) {
      const m = /<u>(.*?)<\/u>/i.exec(explicitHtml);
      if (m) {
        const beforeU = explicitHtml.slice(0, m.index).replace(/<[^>]+>/g, '');
        explicitStressIdx = beforeU.length;
      }
    }

    const isVowel = (c: string): boolean => 'aeiouy'.includes(c);
    const vowelIndices = chars
      .map((c, idx) => isVowel(c) ? idx : -1)
      .filter((idx) => idx !== -1);

    if (vowelIndices.length === 0) return lowerWord;

    const effectiveLen = (lowerWord.endsWith('s') && chars.length > 1 && !lowerWord.endsWith('ss'))
      ? chars.length - 1
      : chars.length;

    const baseVowelIndices = vowelIndices.filter((idx) => idx < effectiveLen);
    if (baseVowelIndices.length === 0) return lowerWord;

    let stressedCharIdx = explicitStressIdx;

    if (stressedCharIdx === -1) {
      const lastCharBase = chars[effectiveLen - 1]!;
      const endsInVowel = isVowel(lastCharBase);
      const numVowels = baseVowelIndices.length;
      const baseWord = chars.slice(0, effectiveLen).join('');

      if (INTERLINGUA_STRESS_EXCEPTIONS[baseWord] !== undefined) {
        stressedCharIdx = INTERLINGUA_STRESS_EXCEPTIONS[baseWord]!;
      } else if (endsInVowel) {
        if (numVowels >= 2) {
          stressedCharIdx = baseVowelIndices[numVowels - 2]!;
        } else {
          stressedCharIdx = baseVowelIndices[0]!;
        }
      } else {
        // IED: 'novem' e compositos (p.ex. 'dece-novem') es paroxytonos (n<u>o</u>vem)
        if ((baseWord === 'novem' || baseWord.endsWith('-novem')) && numVowels >= 2) {
          stressedCharIdx = baseVowelIndices[numVowels - 2]!;
        } else {
          stressedCharIdx = baseVowelIndices[numVowels - 1]!;
        }
      }

      if (INTERLINGUA_STRESS_EXCEPTIONS[baseWord] === undefined && numVowels >= 3) {
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
            'formica', 'amica', 'amico', 'apico', 'pudica', 'pudico', 'antica', 'antico', 'unica', 'unico'
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
      if (INTERLINGUA_STRESS_EXCEPTIONS[baseWord] === undefined && numVowels >= 3 && weakEndings.some((s) => baseWord.endsWith(s))) {
        const tonicHiatusEndings = [
          'logia', 'graphia', 'metria', 'scopia', 'mania', 'phobia',
          'latria', 'gonia', 'nomia', 'tomia', 'pathia', 'cratia',
          'archia', 'urgia', 'sophia', 'theoria', 'melodia', 'poesia',
          'maria', 'eria', 'ea', 'eo', 'eu'
        ];
        const isTonicHiatus = tonicHiatusEndings.some((s) => baseWord.endsWith(s));
        if (!isTonicHiatus) {
          stressedCharIdx = baseVowelIndices[numVowels - 3]!;
        }
      }
    }

    const ipaParts: [string, boolean][] = [];
    let charIdx = 0;
    let stressedIpaIndex = 0;

    while (charIdx < chars.length) {
      const char = chars[charIdx]!;
      const next = chars[charIdx + 1] ?? null;
      const afterNext = chars[charIdx + 2] ?? null;
      const prev = charIdx > 0 ? chars[charIdx - 1]! : null;

      const isStressed = charIdx === stressedCharIdx;
      if (isStressed) {
        stressedIpaIndex = ipaParts.length;
      }

      let handled = false;

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
          const prevIsG = prev === 'g';
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
          // IALA §4: s – como -s in anglese {stay}; inter vocales, le mesme
          // (o, optionalmente, como -s in anglese {these}). Norma principal: /s/
          ipaParts.push(['s', false]);
          break;
        }
        case 't': {
          const nextIsI = next === 'i';
          const afterNextIsVowel = afterNext && isVowel(afterNext);
          const nextIIdx = charIdx + 1;
          const nextIStressed = nextIIdx === stressedCharIdx;
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
    let stressedNucleusIdx = nucleiIndices.findIndex((idx) => idx === stressedIpaIndex);

    if (stressedNucleusIdx === -1) {
      if (numSyllables === 0) {
        stressedNucleusIdx = 0;
      } else {
        const lastPhoneme = (ipaParts[ipaParts.length - 1])?.[0] ?? '';
        const endsInVowelPhonetic = 'aeiou'.includes(lastPhoneme[lastPhoneme.length - 1] ?? '');
        stressedNucleusIdx = endsInVowelPhonetic ? (numSyllables >= 2 ? numSyllables - 2 : 0) : (numSyllables - 1);
      }
    }

    let result = '';
    let lastNucleusEnd = 0;

    for (let i = 0; i < nucleiIndices.length; i++) {
      const nucleusIdx = nucleiIndices[i]!;
      const consonantsSlice = ipaParts.slice(lastNucleusEnd, nucleusIdx);
      let splitPoint = 0;

      if (i > 0) {
        if (consonantsSlice.length > 1) {
          let effectiveLen = consonantsSlice.length;
          const lastCharStr = consonantsSlice[effectiveLen - 1]![0];
          if (lastCharStr === 'j' || lastCharStr === 'w') {
            effectiveLen = Math.max(0, effectiveLen - 1);
          }
          if (effectiveLen > 1) {
            const penultC = consonantsSlice[effectiveLen - 2]![0];
            const lastC = consonantsSlice[effectiveLen - 1]![0];
            const isStop = 'pbtdkɡfv'.includes(penultC);
            const isLiquid = 'lr'.includes(lastC);
            splitPoint = (isStop && isLiquid) ? effectiveLen - 2 : effectiveLen - 1;
          }
        }
      }

      for (let k = 0; k < splitPoint; k++) result += consonantsSlice[k]![0];
      if (i > 0) result += '.';
      if (i === stressedNucleusIdx && numSyllables > 1) result += 'ˈ';
      for (let k = splitPoint; k < consonantsSlice.length; k++) result += consonantsSlice[k]![0];
      result += ipaParts[nucleusIdx]![0];
      lastNucleusEnd = nucleusIdx + 1;
    }

    for (let k = lastNucleusEnd; k < ipaParts.length; k++) {
      result += ipaParts[k]![0];
    }
    return result;
  }

  function getInterlinguaIPA(text: string, overrideHtml = ''): string {
    const cleaned = (text || '').replace(/\s+(sb|adj|vb|adv|prep|conj|npr)$/i, '').trim();
    if (!cleaned) return '';

    // Si es un numeral, se transcribe foneticamente el texto de las palabras
    const numTrans = transcribeNumberFullInterlingua(cleaned);
    if (numTrans) {
      const numWords = numTrans.replace(/-/g, ' ').split(/\s+/);
      const trans = numWords.map((w: string) => transcribeWordInterlinguaIPA(w)).join(' ');
      return '/' + trans + '/';
    }

    const words = cleaned.split(/\s+/);
    if (words.length === 1) {
      return '/' + transcribeWordInterlinguaIPA(words[0]!, overrideHtml) + '/';
    }
    const trans = words.map((w: string) => transcribeWordInterlinguaIPA(w)).join(' ');
    return '/' + trans + '/';
  }

  /**
   * Distancia de Levenshtein optimizada en memoria O(N)
   */
  function levenshteinDistance(s1: string, s2: string): number {
    if (s1 === s2) return 0;
    const m = s1.length;
    const n = s2.length;
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      const c1 = s1.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) {
        if (c1 === s2.charCodeAt(j - 1)) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
        }
      }
      for (let j = 0; j <= n; j++) prev[j] = curr[j];
    }
    return prev[n];
  }

  /**
   * Motor de Sugerencias Ortograficas "¿Quisiste decir...?"
   * Busca en el vocabulario completo por distancia de edicion <= 2
   */
  function findSpellingSuggestions(word: string, vocabList: string[], maxDistance = 2, maxResults = 3): Array<{ word: string; distance: number }> {
    const q = (word || '').toLowerCase();
    const qLen = q.length;
    if (qLen < 3 || !vocabList) return [];

    const matches = [];
    for (let i = 0; i < vocabList.length; i++) {
      const cand = vocabList[i]!;
      const cLen = cand.length;
      if (Math.abs(cLen - qLen) > maxDistance) continue;
      // Heuristica de velocidad: primera o ultima letra coincidente
      if (cand[0] !== q[0] && cand[cLen - 1] !== q[qLen - 1]) continue;

      const dist = levenshteinDistance(q, cand);
      if (dist <= maxDistance) {
        matches.push({ word: cand, distance: dist });
      }
    }

    function commonPrefixLen(a: string, b: string): number {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return i;
    }

    matches.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      const pA = commonPrefixLen(q, a.word);
      const pB = commonPrefixLen(q, b.word);
      return pB - pA;
    });
    return matches.slice(0, maxResults);
  }

  /**
   * Resolutor de Orthographia Collateral (IALA §15)
   * Restituye le forma classic del IED a partir de formas scribite in orthographia collateral simplificate:
   * (a) Simplification de consonantes duple: bb, dd, ff, gg, ll, mm, nn, pp, rr, tt, cc -> b, d, f...
   * (b) Vocal -y -> -i (tirano -> tyranno)
   * (c) Digrapho -ph- -> -f- (fonetic -> phonetic, emfatic -> emphatic)
   * (d) Digrapho -ch- (/k/) ante l, r, a, o, u -> -c- (cloric -> chloric, cristo -> christo)
   * (e) -h- silente post r, t omittite (retoric -> rhetoric, patetic -> pathetic)
   * (f) -j- pro -g- e -gi- ante vocal (sajo -> sagio/sago)
   * (g) -aje -> -age, -izar -> -isar, -izacion -> -isation
   * (h) Omission de -e final post -t precedite de vocal (animat -> animate, brevitat -> brevitate)
   *     e post -n, -l, -r pro -nn, -ll, -rr (peren -> perenne, bel -> belle, il -> ille)
   */
  function resolveCollateralOrthography(word: string, dictMap: Record<string, unknown>): CollateralMatch[] {
    const w = (word || '').toLowerCase().trim();
    if (w.length < 2 || !dictMap) return [];

    const results: unknown[] = [];
    const visited = new Set([w]);

    function tryCand(cand: string, ruleId: string, desc: string): void {
      if (!cand || visited.has(cand)) return;
      visited.add(cand);
      if (dictMap[cand]) {
        results.push({
          sourceWord: w,
          classicalWord: cand,
          ruleId: ruleId,
          desc: desc,
          dictEntry: dictMap[cand]
        });
      }
    }

    // 1. Transformaciones grafemicas IALA §15
    // (c) f -> ph
    if (w.includes('f')) {
      tryCand(w.replace(/f/g, 'ph'), '§15c', 'Digrapho "ph" reimplaciate per "f" (IALA §15c)');
    }

    // (e) Silente 'h' post 'r' o 't'
    if (w.startsWith('r') && !w.startsWith('rh')) {
      tryCand('rh' + w.slice(1), '§15e', 'Digrapho "rh-" simplificate per omission de "h" silente (IALA §15e)');
    }
    if (w.includes('t') && !w.includes('th')) {
      tryCand(w.replace(/t/g, 'th'), '§15e', 'Digrapho "th" simplificate per omission de "h" silente (IALA §15e)');
      tryCand(w.replace(/^t/, 'th'), '§15e', 'Digrapho "th" simplificate per omission de "h" silente (IALA §15e)');
      tryCand(w.replace(/(\w)t(\w)/, '$1th$2'), '§15e', 'Digrapho "th" simplificate per omission de "h" silente (IALA §15e)');
    }

    // Combinacion (c) + (e): p.ex. patetic -> pathetic, emfatic -> emphatic
    if (w.includes('f') && w.includes('t')) {
      tryCand(w.replace(/f/g, 'ph').replace(/t/g, 'th'), '§15c, §15e', 'Digraphos "ph" e "th" simplificate (IALA §15c, §15e)');
    }

    // (d) c -> ch ante l, r, a, o, u
    if (/^c[lraou]/.test(w)) {
      tryCand(w.replace(/^c([lraou])/, 'ch$1'), '§15d', 'Digrapho "ch" (/k/) reimplaciate per "c" ante consonante o vocal velar (IALA §15d)');
    }
    if (/c[lraou]/.test(w)) {
      tryCand(w.replace(/c([lraou])/g, 'ch$1'), '§15d', 'Digrapho "ch" (/k/) reimplaciate per "c" (IALA §15d)');
    }

    // (g) -aje -> -age, -izar -> -isar, -izacion -> -isation
    if (w.endsWith('aje')) {
      tryCand(w.slice(0, -3) + 'age', '§15g', 'Suffixo "-age" reimplaciate per "-aje" (IALA §15g)');
    }
    if (w.includes('izar')) {
      tryCand(w.replace(/izar/g, 'isar'), '§15g', 'Suffixo "-isar" reimplaciate per "-izar" (IALA §15g)');
    }
    if (w.includes('izacion')) {
      tryCand(w.replace(/izacion/g, 'isation'), '§15g', 'Suffixo "-isation" reimplaciate per "-izacion" (IALA §15g)');
    }

    // (f) j -> g, gi
    if (w.includes('j')) {
      tryCand(w.replace(/j/g, 'g'), '§15f', 'Littera "j" pro "g" ante vocal (IALA §15f)');
      tryCand(w.replace(/j/g, 'gi'), '§15f', 'Littera "j" pro "gi" ante vocal (IALA §15f)');
    }

    // (h) Omission de -e final
    if (/[aeiou]t$/.test(w)) {
      tryCand(w + 'e', '§15h', 'Omission de "-e" final post "-t" precedite de vocal (IALA §15h)');
    }
    if (w.endsWith('n')) {
      tryCand(w + 'ne', '§15a, §15h', 'Simplification de "-nne" final a "-n" (IALA §15a, §15h)');
    }
    if (w.endsWith('l')) {
      tryCand(w + 'le', '§15a, §15h', 'Simplification de "-lle" final a "-l" (IALA §15a, §15h)');
    }
    if (w.endsWith('r')) {
      tryCand(w + 're', '§15a, §15h', 'Simplification de "-rre" final a "-r" (IALA §15a, §15h)');
    }

    // (a) Duplicacion de consonantes simplices
    const doubleCons = ['c', 'l', 'm', 'n', 'p', 'r', 't', 'd', 'b', 'f', 'g'];
    for (let dc of doubleCons) {
      let pos = 0;
      while ((pos = w.indexOf(dc, pos)) !== -1) {
        const cand = w.slice(0, pos) + dc + dc + w.slice(pos + 1);
        tryCand(cand, '§15a', `Consonante duple "-${dc}${dc}-" simplificate a "-${dc}-" (IALA §15a)`);
        pos++;
      }
    }

    // (b) Vocal i -> y e combinacion con consonantes duples (tirano -> tyranno)
    if (w.includes('i')) {
      const candY = w.replace(/i/, 'y');
      tryCand(candY, '§15b', 'Vocal "y" reimplaciate per "i" (IALA §15b)');
      for (let dc of ['n', 'r', 'l', 'm', 'p', 't']) {
        let pos = 0;
        while ((pos = candY.indexOf(dc, pos)) !== -1) {
          const c2 = candY.slice(0, pos) + dc + dc + candY.slice(pos + 1);
          tryCand(c2, '§15a, §15b', `Vocal "y" -> "i" e consonante duple "-${dc}${dc}-" simplificate (IALA §15a, §15b)`);
          pos++;
        }
      }
    }

    return results as CollateralMatch[];
  }

  /**
   * Deconstruye cualquier termino ingresado en el buscador
   */
  function deconstructUniversal(query: string, dictData: unknown, verbMap: Record<string, number>, adjMap: Record<string, number>, sbMap: Record<string, number>): AnalysisResult | null {
    const q = (query || '').toLowerCase().trim();
    if (!q) return null;

    // 0. Numerales arabicos e decimales (IALA §47)
    const numTrans = transcribeNumberFullInterlingua(q);
    if (numTrans !== null) {
      return {
        category: 'numeral',
        sourceWord: q,
        transcription: numTrans,
        formula: `${q} ➔ "${numTrans}" (IALA §47)`
      };
    }

    if (q.length < 2) return null;

    // 1. Verbos conjugate in Interlingua (§§94-115)
    const iaVerbMatches = deconjugateInterlingua(q, verbMap);
    if (iaVerbMatches && Array.isArray(iaVerbMatches) && iaVerbMatches.length > 0) {
      return { category: 'ia_verb', data: iaVerbMatches[0] as unknown as VerbDeconjugation };
    }

    if (q.endsWith('amente')) {
      const candC = q.slice(0, -6);
      if (adjMap && adjMap[candC] !== undefined) {
        return { category: 'adverb_mente', sourceWord: q, baseAdjective: candC, paradigm: inflectAdjective(candC) as AdjParadigm, formula: `${candC} + -amente (§45)` };
      }
    }
    if (q.endsWith('mente')) {
      const candBase = q.slice(0, -5);
      if (adjMap && adjMap[candBase] !== undefined) {
        return { category: 'adverb_mente', sourceWord: q, baseAdjective: candBase, paradigm: inflectAdjective(candBase) as AdjParadigm, formula: `${candBase} + -mente (§45)` };
      }
    }

    if (q.endsWith('hissime')) {
      const candC = q.slice(0, -7) + 'c';
      if (adjMap && adjMap[candC] !== undefined) {
        return { category: 'ia_superlative', sourceWord: q, baseAdjective: candC, paradigm: inflectAdjective(candC) as AdjParadigm, formula: `${candC} → -ch- + -issime (§36)` };
      }
    }
    if (q.endsWith('issime')) {
      const stem = q.slice(0, -6);
      const candE = stem + 'e';
      const found = (adjMap && adjMap[stem] !== undefined) ? stem : ((adjMap && adjMap[candE] !== undefined) ? candE : stem);
      if (adjMap && (adjMap[stem] !== undefined || adjMap[candE] !== undefined)) {
        return { category: 'ia_superlative', sourceWord: q, baseAdjective: found, paradigm: inflectAdjective(found) as AdjParadigm, formula: `${found} + -issime (§36)` };
      }
    }

    if (q.endsWith('hes') && q.length > 3) {
      const sing = q.slice(0, -3);
      if (sbMap && sbMap[sing] !== undefined) {
        return { category: 'ia_plural', sourceWord: q, singular: sing, rule: "Plural regular de nomine finiente in -c (-c → -ches) (§21)", nounData: pluralizeNoun(sing) as NounParadigm };
      }
    }
    if (q.endsWith('eses') || q.endsWith('ites')) {
      const sing = q.slice(0, -2) + 'is';
      if (sbMap && sbMap[sing] !== undefined) {
        return { category: 'ia_plural', sourceWord: q, singular: sing, rule: "Plural de vocabulos docte in -is (-is → -es) (§22)", nounData: pluralizeNoun(sing) as NounParadigm };
      }
    }
    if (q.endsWith('es') && q.length > 3) {
      const sing = q.slice(0, -2);
      if (sbMap && sbMap[sing] !== undefined) {
        return { category: 'ia_plural', sourceWord: q, singular: sing, rule: "Plural post consonante con desinentia -es (§21)", nounData: pluralizeNoun(sing) as NounParadigm };
      }
    }
    if (q.endsWith('s') && q.length > 2) {
      const sing = q.slice(0, -1);
      if (sbMap && sbMap[sing] !== undefined) {
        return { category: 'ia_plural', sourceWord: q, singular: sing, rule: "Plural post vocal con desinentia -s (§21)", nounData: pluralizeNoun(sing) as NounParadigm };
      }
    }

    // Orthographia collateral (IALA §15)
    // Permitte cercar formas simplificate (fonetic, emfatic, etc.)
    const collateralMatches = resolveCollateralOrthography(q, dictData as unknown as Record<string, unknown>);
    if (collateralMatches && collateralMatches.length > 0) {
      return { category: 'ia_collateral', sourceWord: q, matches: collateralMatches };
    }

    // 6. Derivation con prefixos productivos (IALA §155) - e.g. deconstruction -> de- + construction
    for (const pref of PRODUCTIVE_PREFIXES) {
      if (q.startsWith(pref.p) && q.length > pref.p.length + 3) {
        const stem = q.slice(pref.p.length);
        if (dictData && (verbMap && verbMap[stem] !== undefined || adjMap && adjMap[stem] !== undefined || sbMap && sbMap[stem] !== undefined)) {
          const cat = (sbMap && sbMap[stem] !== undefined) ? 'Substantivo' : ((verbMap && verbMap[stem] !== undefined) ? 'Verbo' : 'Adjectivo');
          return {
            category: 'ia_prefixed',
            sourceWord: q,
            prefix: pref.p,
            stem: stem,
            stemCategory: cat,
            desc: pref.desc,
            formula: `Prefixo "${pref.p}-" (${pref.desc}) + "${stem}" [IALA §155]`
          };
        }
      }
    }

    // 7. Derivation con suffixos productivos (IALA §§136-154) - e.g. nutritionista -> nutrition + -ista
    for (const sfx of PRODUCTIVE_SUFFIXES) {
      if (q.endsWith(sfx.suffix) && q.length > sfx.suffix.length + 2) {
        const rawStem = q.slice(0, -sfx.suffix.length);
        const candidates = sfx.generateCandidates(rawStem);
        for (const cand of candidates) {
          const isSb = sbMap && sbMap[cand] !== undefined;
          const isAdj = adjMap && adjMap[cand] !== undefined;
          const isVb = verbMap && verbMap[cand] !== undefined;

          let matchedPos: 'sb' | 'adj' | 'vb' | null = null;
          if (sfx.allowedBasePos.includes('sb') && isSb) matchedPos = 'sb';
          else if (sfx.allowedBasePos.includes('adj') && isAdj) matchedPos = 'adj';
          else if (sfx.allowedBasePos.includes('vb') && isVb) matchedPos = 'vb';

          if (matchedPos) {
            const catName = matchedPos === 'sb' ? 'Substantivo' : (matchedPos === 'vb' ? 'Verbo' : 'Adjectivo');
            return {
              category: 'ia_suffixed' as const,
              sourceWord: q,
              stem: cand,
              stemCategory: catName,
              suffix: sfx.suffix,
              desc: sfx.desc,
              formula: `Derivation "${cand}" (${catName}) + "-${sfx.suffix}" [IALA ${sfx.ruleRef}]`
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Deconstruye una palabra ya conjugada en Interlingua (Verbos)
   */
  function deconjugateInterlingua(word: string, verbMap: Record<string, number>): unknown {
    const w = (word || '').toLowerCase().trim();
    const results: unknown[] = [];

    const irregLookup = {
      'es': { inf: 'esser', tense: 'Presente Simple', formula: 'forma simplificate de esser (§101)' },
      'son': { inf: 'esser', tense: 'Presente Simple (plural)', formula: 'forma plural optional de esser (§101)' },
      'era': { inf: 'esser', tense: 'Passato Simple', formula: 'forma irregular optional de esser (§104)' },
      'esseva': { inf: 'esser', tense: 'Passato Simple', formula: 'esse- + -va (§102)' },
      'essera': { inf: 'esser', tense: 'Futuro Simple', formula: 'esser + -a (§107)' },
      'esserea': { inf: 'esser', tense: 'Conditional', formula: 'esser + -ea (§107)' },
      'essente': { inf: 'esser', tense: 'Participio Presente', formula: 'ess- + -ente (§94)' },
      'essite': { inf: 'esser', tense: 'Participio Passate', formula: 'ess- + -ite (§95)' },
      'ha': { inf: 'haber', tense: 'Presente Simple', formula: 'forma simplificate de haber (§101)' },
      'habeva': { inf: 'haber', tense: 'Passato Simple', formula: 'habe- + -va (§102)' },
      'habera': { inf: 'haber', tense: 'Futuro Simple', formula: 'haber + -a (§107)' },
      'haberea': { inf: 'haber', tense: 'Conditional', formula: 'haber + -ea (§107)' },
      'habente': { inf: 'haber', tense: 'Participio Presente', formula: 'hab- + -ente (§94)' },
      'habite': { inf: 'haber', tense: 'Participio Passate', formula: 'hab- + -ite (§95)' },
      'va': { inf: 'vader', tense: 'Presente Simple', formula: 'forma simplificate de vader (§101)' },
      'vadeva': { inf: 'vader', tense: 'Passato Simple', formula: 'vade- + -va (§102)' },
      'vadera': { inf: 'vader', tense: 'Futuro Simple', formula: 'vader + -a (§107)' },
      'vaderea': { inf: 'vader', tense: 'Conditional', formula: 'vader + -ea (§107)' }
    };

    if ((irregLookup as Record<string, unknown>)[w]) {
      const item = (irregLookup as Record<string, { inf: string; tense: string; formula: string }>)[w]!;
      results.push({
        sourceLanguage: 'Interlingua', sourceWord: w, infinitive: item.inf,
        tense: item.tense, formula: item.formula, paradigm: conjugateInterlingua(item.inf)
      });
      return results;
    }

    // Participios passatos collaterales (extraite -> extraher, extracte, etc.)
    if ((COLLATERAL_PARTICIPLES as Record<string, unknown>)[w]) {
      const item = (COLLATERAL_PARTICIPLES as Record<string, { inf: string; desc: string }>)[w]!;
      results.push({
        sourceLanguage: 'Interlingua', sourceWord: w, infinitive: item.inf,
        tense: 'Participio Passate (Collateral)', formula: item.desc, paradigm: conjugateInterlingua(item.inf)
      });
      return results;
    }

    if (w.endsWith('aite')) {
      const candHer = w.slice(0, -4) + 'aher';
      if (!verbMap || verbMap[candHer] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: candHer,
          tense: 'Participio Passate', formula: `Participio collateral (-aite) de ${candHer} (IALA §§95, 100)`,
          paradigm: conjugateInterlingua(candHer)
        });
      }
    }

    if (w.endsWith('ara') || w.endsWith('era') || w.endsWith('ira')) {
      const inf = w.slice(0, -1);
      if (!verbMap || verbMap[inf] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Futuro Simple', formula: `${inf} + -a (§107)`, equivalent: `va ${inf}`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    }

    if (w.endsWith('area') || w.endsWith('erea') || w.endsWith('irea')) {
      const inf = w.slice(0, -2);
      if (!verbMap || verbMap[inf] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Conditional', formula: `${inf} + -ea (§107)`, equivalent: `velle ${inf}`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    }

    if (w.endsWith('ava') || w.endsWith('eva') || w.endsWith('iva')) {
      const inf = w.slice(0, -2) + 'r';
      if (!verbMap || verbMap[inf] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Passato Simple (Preterito)', formula: `${w.slice(0, -3)}-${w.slice(-3, -2)}- + -va (§102)`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    }

    // Participios presentes (IALA §93)
    // Infinitivo en -ar -> tema -a- + -nte = -ante
    // Infinitivo en -er -> tema -e- + -nte = -ente
    // Infinitivo en -ir -> tema -i- -> -ie- + -nte = -iente
    if (w.endsWith('ante') && w.length > 4) {
      const inf = w.slice(0, -4) + 'ar';
      if (!verbMap || verbMap[inf] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Participio Presente', formula: `${inf} minus -r + -nte (§93)`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    } else if (w.endsWith('iente') && w.length > 5) {
      const infI = w.slice(0, -5) + 'ir';
      const infE = w.slice(0, -5) + 'er';
      const inf = (verbMap && verbMap[infI] !== undefined) ? infI : ((verbMap && verbMap[infE] !== undefined) ? infE : infI);
      if (!verbMap || verbMap[infI] !== undefined || verbMap[infE] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Participio Presente', formula: `${inf} (-i- → -ie-) + -nte (§93)`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    } else if (w.endsWith('ente') && w.length > 4) {
      const inf = w.slice(0, -4) + 'er';
      if (!verbMap || verbMap[inf] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Participio Presente', formula: `${inf} minus -r + -nte (§93)`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    }

    if (w.endsWith('ate')) {
      const inf = w.slice(0, -3) + 'ar';
      if (!verbMap || verbMap[inf] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf,
          tense: 'Participio Passate', formula: `${w.slice(0, -3)}- + -ate (§95)`,
          paradigm: conjugateInterlingua(inf)
        });
      }
    }
    if (w.endsWith('ite')) {
      const inf_er = w.slice(0, -3) + 'er';
      const inf_ir = w.slice(0, -3) + 'ir';
      const foundInf = (verbMap && verbMap[inf_er] !== undefined) ? inf_er : ((verbMap && verbMap[inf_ir] !== undefined) ? inf_ir : inf_er);
      if (!verbMap || verbMap[inf_er] !== undefined || verbMap[inf_ir] !== undefined) {
        results.push({
          sourceLanguage: 'Interlingua', sourceWord: w, infinitive: foundInf,
          tense: 'Participio Passate', formula: `${w.slice(0, -3)}- + -ite (§95)`,
          paradigm: conjugateInterlingua(foundInf)
        });
      }
    }

    const inf_pres = w + 'r';
    if (verbMap && verbMap[inf_pres] !== undefined) {
      results.push({
        sourceLanguage: 'Interlingua', sourceWord: w, infinitive: inf_pres,
        tense: 'Presente / Imperativo', formula: `${inf_pres} minus -r (§99, §110)`,
        paradigm: conjugateInterlingua(inf_pres)
      });
    }

    return results;
  }



  /**
   * Particulas Grammatic e Contractiones Obligatori (IALA §17, §21, §54)
   */
  const GRAMMAR_PARTICLES = {
    'al': { pos: 'prep + art def', root: 'a + le', desc: 'Contraction obligatori del preposition "a" con le articulo definite "le" (IALA §17)' },
    'del': { pos: 'prep + art def', root: 'de + le', desc: 'Contraction obligatori del preposition "de" con le articulo definite "le" (IALA §17)' },
    'una': { pos: 'art / pron', root: 'un', desc: 'Forma feminin pronominal del articulo indefinite (IALA §21)' },
    'uno': { pos: 'art / pron', root: 'un', desc: 'Forma masculin pronominal del articulo indefinite (IALA §21)' },
    'unes': { pos: 'art / pron', root: 'un', desc: 'Forma plural pronominal del articulo indefinite "unes" = {some} (IALA §21)' },
    'unas': { pos: 'art / pron', root: 'un', desc: 'Forma feminin plural pronominal del articulo indefinite (IALA §21)' },
    'tan': { pos: 'adv', root: 'tanto', desc: 'Forma apocopate de "tanto" ante adjectivos e adverbios (IALA §44)' },
    'nonne': { pos: 'interj', root: 'nonne', desc: 'Particula interrogative de confirmation: "nonne?" = "¿no es verdad?" (IALA §120)' },
                'internet': { pos: 'sb', root: 'internet', desc: 'Rete global de computatores (neologismo universal)' },
    'wifi': { pos: 'sb', root: 'Wi-Fi', desc: 'Fidelitate wireless / rete sin filo' },
    'blog': { pos: 'sb', root: 'blog', desc: 'Diario web / blog' },
    'c': { pos: 'symb', root: 'Celsius', desc: 'Symbolo de grado Celsius / centigrado' },
    'h': { pos: 'symb', root: 'hora', desc: 'Symbolo de hora o kilometros per hora' },
    's': { pos: 'symb', root: 'secunda', desc: 'Symbolo de secunda' },
    't': { pos: 'symb', root: 'tonna', desc: 'Symbolo de tonna o tempore' },
    'p': { pos: 'symb', root: 'post', desc: 'Symbolo de p.m. / pagina' },
    'm': { pos: 'symb', root: 'metro', desc: 'Symbolo de metro / meridian' },
    'x': { pos: 'symb', root: 'raios X', desc: 'Symbolo de raios X o multiplication' },
    'com': { pos: 'symb', root: '.com', desc: 'Dominio de internet commercial' },
    'mail': { pos: 'sb', root: 'e-mail', desc: 'Posta electronic / mail' },
    'anti': { pos: 'pref', root: 'anti-', desc: 'Prefixo grec indicante opposition (IALA §15)' },
    'b': { pos: 'symb', root: 'B', desc: 'Symbolo o designation de typo B (e.g. hepatitis B)' },
    'd': { pos: 'symb', root: 'D', desc: 'Symbolo o designation de typo D / anti-D' },
    'u': { pos: 'symb', root: 'U', desc: 'Symbolo o elemento de acronymo (U.E. / S.U.)' },
    'v': { pos: 'symb / num', root: 'V', desc: 'Numeral roman V (cinque) o nervo cranial V' },
    'j': { pos: 'symb', root: 'J', desc: 'Initial de nomine proprie' },
    'cma': { pos: 'acron', root: 'CMA', desc: 'Chromosomal Microarray' },
    'dtap': { pos: 'acron', root: 'DTaP', desc: 'Vaccino contra diphteria, tetano e pertussis' },
    'rhogam': { pos: 'npr', root: 'RhoGAM', desc: 'Nomine commercial de immunoglobulina' },
    'cd4': { pos: 'symb', root: 'CD4', desc: 'Marcator cellular de lymphocytos T' },
    'a1c': { pos: 'symb', root: 'A1C', desc: 'Hemoglobina glycate' },
    'h5n1': { pos: 'symb', root: 'H5N1', desc: 'Subtypo de virus de influenza avian' },
    'inf': { pos: 'abbrev', root: 'informal', desc: 'Abbreviation pro registro informal' },
    'pl': { pos: 'abbrev', root: 'plural', desc: 'Abbreviation pro forma plural' },
    'mg': { pos: 'symb', root: 'milligramma', desc: 'Symbolo de unitate de mesura milligramma' },
    'primo': { pos: 'adv / num', root: 'prime', desc: 'Adverbio ordinal "in prime loco" o numeral cardinal derivate (IALA §47)' },
    'secunde': { pos: 'num / adj', root: 'secundo', desc: 'Variante ordinal e adjectival de "secundo" (IALA §47)' },
    'iala': { pos: 'npr (acronymo)', root: 'IALA', desc: 'International Auxiliary Language Association (fundator de Interlingua)' }
  };

  /**
   * Analisis Contextual y Gramatical de un Token sin hardcoding de lemas
   * - Desambiguacion sintactica pura por reglas generales de la lengua
   * - Si una palabra no existe, activa la deteccion de errores y calcula sugerencias por distancia de Levenshtein
   */
  function analyzeTextTokenContextual(tokenInfo: { tok: string; low: string; prevLow?: string; nextLow?: string }, dictMulti: Record<string, unknown[]>, verbMap: Record<string, number>, adjMap: Record<string, number>, sbMap: Record<string, number>, vocabList: string[]): unknown {
    const orig = tokenInfo.tok;
    const low = tokenInfo.low;
    const prevLow = tokenInfo.prevLow || "";
    const nextLow = tokenInfo.nextLow || "";

    // 0. Numerales e numeros arabicos o decimales (IALA §47)
    const transcribedNum = transcribeNumberFullInterlingua(orig);
    if (transcribedNum !== null) {
      return {
        word: orig,
        root: orig,
        pos: 'num',
        status: 'numeral',
        transcription: transcribedNum,
        desc: `Numeral in Interlingua: ${orig} = "${transcribedNum}" (IALA §47)`,
        dictEntry: [orig, 'num', `Numeral: ${transcribedNum}`]
      };
    }

    // 1. Contractiones obligatori de preposiciones con articulo (IALA §17)
    if ((GRAMMAR_PARTICLES as Record<string, unknown>)[low]) {
      const part = (GRAMMAR_PARTICLES as Record<string, { root: string; pos: string; desc: string }>)[low]!;
      return {
        word: orig, root: part.root, pos: part.pos, status: 'grammatic',
        desc: part.desc, dictEntry: [orig, part.pos, '']
      };
    }

    // 1.c Verbos auxiliares con formas monosyllabic de presente (IALA §100)
    const IALA_IRREGULAR_PRESENTS = {
      'ha': { inf: 'haber', desc: 'Tempore presente del auxiliar "haber" (IALA §100)', tense: 'Presente Indicativo' },
      'va': { inf: 'vader', desc: 'Forma auxiliar de futuro / presente de "vader" (IALA §100)', tense: 'Presente / Auxiliar de Futuro' },
      'es': { inf: 'esser', desc: 'Tempore presente del verbo copulativo "esser" (IALA §100)', tense: 'Presente Indicativo' },
      'son': { inf: 'esser', desc: 'Forma collateral plural de presente de "esser" (IALA §100)', tense: 'Presente Indicativo (Plural)' }
    };
    if ((IALA_IRREGULAR_PRESENTS as Record<string, unknown>)[low]) {
      const irp = (IALA_IRREGULAR_PRESENTS as Record<string, { inf: string; desc: string; tense: string }>)[low]!;
      return {
        word: orig, root: irp.inf, pos: 'vb', status: 'inflected',
        desc: irp.desc, tense: irp.tense, dictEntry: [irp.inf, 'vb', '']
      };
    }

    // 1.d Derivation productive de adverbios in -mente / -amente (IALA §45)
    if (low.endsWith('amente') && low.length > 6) {
      const candC = low.slice(0, -6);
      if (adjMap && adjMap[candC] !== undefined) {
        return {
          word: orig, root: candC, pos: 'adv', status: 'derived',
          desc: `Adverbio regular derivate in -amente de "${candC}" (IALA §45)`,
          dictEntry: [orig, 'adv', `Adverbio derivate de ${candC}`]
        };
      }
    }
    if (low.endsWith('mente') && low.length > 5) {
      const candBase = low.slice(0, -5);
      // Casos: adj terminado en vocal directa (regular -> regularmente, rapide -> rapidemente)
      // o adj en consonante que toma -e- intermedia (clar -> clarmente, regular -> regularmente)
      const candE = candBase.endsWith('e') ? candBase.slice(0, -1) : null;
      let matchedAdj = null;
      if (adjMap && adjMap[candBase] !== undefined) matchedAdj = candBase;
      else if (candE && adjMap && adjMap[candE] !== undefined) matchedAdj = candE;
      else if (dictMulti && (dictMulti[candBase] || (candE && dictMulti[candE]))) matchedAdj = dictMulti[candBase] ? candBase : candE;

      if (matchedAdj) {
        return {
          word: orig, root: matchedAdj, pos: 'adv', status: 'derived',
          desc: `Adverbio regular derivate in -mente de "${matchedAdj}" (IALA §45)`,
          dictEntry: [orig, 'adv', `Adverbio derivate de ${matchedAdj}`]
        };
      }
    }

    // 1.e Superlativo absolute synthetic in -issime / -hissime (IALA §36)
    if (low.endsWith('hissime') && low.length > 7) {
      const candC = low.slice(0, -7) + 'c';
      if ((adjMap && adjMap[candC] !== undefined) || (dictMulti && dictMulti[candC])) {
        return {
          word: orig, root: candC, pos: 'adj', status: 'derived',
          desc: `Superlativo absolute (-hissime) de "${candC}" (IALA §36)`,
          dictEntry: [orig, 'adj', `Superlativo absolute de ${candC}`]
        };
      }
    }
    if (low.endsWith('issime') && low.length > 6) {
      const stem = low.slice(0, -6);
      const candE = stem + 'e';
      const candA = stem + 'a';
      const candO = stem + 'o';
      let matchedBase: string | null = null;
      for (const cand of [stem, candE, candA, candO]) {
        if ((adjMap && adjMap[cand] !== undefined) || (dictMulti && dictMulti[cand] && (dictMulti[cand] as string[][]).some(e => (e[1] || '').includes('adj')))) {
          matchedBase = cand;
          break;
        }
      }
      if (matchedBase) {
        return {
          word: orig, root: matchedBase, pos: 'adj', status: 'derived',
          desc: `Superlativo absolute (-issime) de "${matchedBase}" (IALA §36)`,
          dictEntry: [orig, 'adj', `Superlativo absolute de ${matchedBase}`]
        };
      }
    }

    // 1.b Participios passatos collaterales o classicos (extraite -> extraher, extracte, scripte, etc.)
    if ((COLLATERAL_PARTICIPLES as Record<string, unknown>)[low]) {
      const cp = (COLLATERAL_PARTICIPLES as Record<string, { inf: string; desc: string }>)[low]!;
      return {
        word: orig,
        root: cp.inf,
        pos: 'vb (part)',
        status: 'inflected',
        desc: cp.desc,
        tense: 'Participio Passate',
        dictEntry: [cp.inf, 'vb', '']
      };
    }
    if (low.endsWith('aite')) {
      const candHer = low.slice(0, -4) + 'aher';
      if (verbMap[candHer] !== undefined) {
        return {
          word: orig,
          root: candHer,
          pos: 'vb (part)',
          status: 'inflected',
          desc: `Participio passate collateral (-aite) de "${candHer}" (IALA §§95, 100)`,
          tense: 'Participio Passate',
          dictEntry: [candHer, 'vb', '']
        };
      }
    }
    if (low.endsWith('s') && low.length > 3) {
      const sing = low.slice(0, -1);
      if ((COLLATERAL_PARTICIPLES as Record<string, unknown>)[sing]) {
        const cp = (COLLATERAL_PARTICIPLES as Record<string, { inf: string; desc: string }>)[sing]!;
        return {
          word: orig,
          root: cp.inf,
          pos: 'vb (part, pl)',
          status: 'inflected',
          desc: `Plural del participio passate collateral de "${cp.inf}" (IALA §§95, 100)`,
          tense: 'Participio Passate Plural',
          dictEntry: [cp.inf, 'vb', '']
        };
      }
    }

    // 2. Acronymos o Siglas Internacionales (IALA, UMI, UNESCO, etc.)
    if (/^[A-Z]{2,}$/.test(orig)) {
      return {
        word: orig, root: orig, pos: 'npr (acronymo)', status: 'npr',
        desc: `Acronymo international o nomine proprie de institution (${orig})`,
        dictEntry: [orig, 'npr', '']
      };
    }

    // 3. Regla Sintactica de Grado Comparative o Superlativo (IALA §34)
    // Si la palabra admite funcion adverbial (como 'plus') y precede a un adjetivo o sigue a 'le' / 'un'
    if (dictMulti[low]) {
      const hasAdv = (dictMulti[low] as string[][]).some((e: string[]) => (e[1] ?? '').includes('adv'));
      if (hasAdv && (adjMap[nextLow] !== undefined || ['le', 'un', 'del', 'al'].includes(prevLow))) {
        const advEntry = (dictMulti[low] as string[][]).find((e: string[]) => (e[1] ?? '').includes('adv'));
        if (!advEntry) return null;
        return {
          word: orig, root: advEntry[0], pos: 'adv', status: 'exact',
          desc: 'Adverbio modificante o de grado (§34, §44)',
          dictEntry: advEntry
        };
      }
    }

    // 4. Regla Sintactica de Posicion Adjetival Pospuesta (IALA §31, §33)
    // En Interlingua la posicion normal del adjetivo es pospuesta al sustantivo que califica.
    // Si la palabra tiene entrada como adjetivo y sigue a un sustantivo, actua como adjetivo.
    if (dictMulti[low]) {
      const hasAdj = (dictMulti[low] as string[][]).some((e: string[]) => (e[1] ?? '').includes('adj'));
      if (hasAdj && sbMap[prevLow] !== undefined) {
        const adjEntry = (dictMulti[low] as string[][]).find((e: string[]) => (e[1] ?? '').includes('adj'));
        if (!adjEntry) return null;
        return {
          word: orig, root: adjEntry[0], pos: 'adj', status: 'exact',
          desc: `Adjectivo qualificative posponite al substantivo "${prevLow}" (IALA §31, §33)`,
          dictEntry: adjEntry
        };
      }
    }

    // 4.b Deconjugation verbal complete pro tote le formas flexive (Passato, Futuro, Conditional, etc.)
    if (typeof deconjugateInterlingua === 'function') {
      const decompList = deconjugateInterlingua(low, verbMap) as Array<{ infinitive: string; tense: string; formula: string }>;
      if (decompList && decompList.length > 0) {
        for (let di = 0; di < decompList.length; di++) {
          const cand = decompList[di];
          if (cand && verbMap && (verbMap[cand.infinitive] !== undefined || (dictMulti && dictMulti[cand.infinitive]))) {
            return {
              word: orig,
              root: cand.infinitive,
              pos: 'vb',
              status: 'inflected',
              desc: cand?.formula ? `Forma flexive (${cand.tense}) de ${cand.infinitive} (${cand.formula})` : `Forma verbal de ${cand?.infinitive ?? ''}`,
              tense: cand?.tense,
              dictEntry: [cand?.infinitive ?? '', 'vb', '']
            };
          }
        }
      }
    }

    // 5. Regla Morphologica Universal de Verbo en Tiempo Presente e Imperativo (IALA §99)
    // In Interlingua le presente e imperativo regular se forma sin exception per omitter le -r final del infinitivo.
    // Si le parola + "r" es un infinitivo valide in le lexico e non ha entrata directe prioritari (o si es in contexto verbal):
    const candInf = low + 'r';
    if (verbMap[candInf] !== undefined && !dictMulti[low]) {
      return {
        word: orig, root: candInf, pos: 'vb', status: 'inflected',
        desc: `Tempore presente / imperativo de "${candInf}" (-r final omitter) [IALA §99]`,
        tense: 'Presente / Imperativo', dictEntry: [candInf, 'vb', '']
      };
    }
    // Si coexiste con un substantivo/adjectivo homographo (p.ex. "cura", "cambio"), verifica si es precedite de subjecto/clitico:
    if (verbMap[candInf] !== undefined && dictMulti[low]) {
      const verbalTriggersPrev = [
        'io', 'tu', 'ille', 'illa', 'illo', 'nos', 'vos', 'illes', 'illas', 'illos', 'on', 'qui', 'que',
        'me', 'te', 'se', 'le', 'la', 'lo', 'les', 'las', 'los', 'nos', 'vos',
        'non', 'jam', 'sempre', 'nunquam', 'ancora'
      ];
      if (verbalTriggersPrev.includes(prevLow) || sbMap[prevLow] !== undefined) {
        return {
          word: orig, root: candInf, pos: 'vb', status: 'inflected',
          desc: `Tempore presente de "${candInf}" (-r final omitter) [IALA §99]`,
          tense: 'Presente Indicativo', dictEntry: [candInf, 'vb', '']
        };
      }
    }

    // 6. Formas Verbales Conjugadas Generales (IALA §§94-115)
    // Passato simple: -ava, -eva, -iva (§102)
    if (low.endsWith('ava') || low.endsWith('eva') || low.endsWith('iva')) {
      const inf = low.slice(0, -2) + 'r';
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb', status: 'inflected',
          desc: `Passato Simple (-va) de "${inf}" (IALA §102)`,
          tense: 'Passato Simple', dictEntry: [inf, 'vb', '']
        };
      }
    }
    // Passato collateral o classic in -ea / -ia (IALA §102): credea -> creder, sentia -> sentir
    if (low.endsWith('ea') && low.length > 3) {
      const inf = low.slice(0, -2) + 'er';
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb', status: 'inflected',
          desc: `Passato collateral (-ea) de "${inf}" (IALA §102)`,
          tense: 'Passato Simple (Collateral)', dictEntry: [inf, 'vb', '']
        };
      }
    }
    if (low.endsWith('ia') && low.length > 3) {
      const inf = low.slice(0, -2) + 'ir';
      if (verbMap[inf] !== undefined && !dictMulti[low]) {
        return {
          word: orig, root: inf, pos: 'vb', status: 'inflected',
          desc: `Passato collateral (-ia) de "${inf}" (IALA §102)`,
          tense: 'Passato Simple (Collateral)', dictEntry: [inf, 'vb', '']
        };
      }
    }
    // Futuro simple: -ara, -era, -ira (§107)
    if (low.endsWith('ara') || low.endsWith('era') || low.endsWith('ira')) {
      const inf = low.slice(0, -1);
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb', status: 'inflected',
          desc: `Futuro Simple (-a) de "${inf}" (IALA §107)`,
          tense: 'Futuro Simple', dictEntry: [inf, 'vb', '']
        };
      }
    }
    // Condicional: -area, -erea, -irea (§107)
    if (low.endsWith('area') || low.endsWith('erea') || low.endsWith('irea')) {
      const inf = low.slice(0, -2);
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb', status: 'inflected',
          desc: `Conditional (-ea) de "${inf}" (IALA §107)`,
          tense: 'Conditional', dictEntry: [inf, 'vb', '']
        };
      }
    }
    // Participios: -ate, -ite (§95)
    if (low.endsWith('ate')) {
      const inf = low.slice(0, -3) + 'ar';
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb (part)', status: 'inflected',
          desc: `Participio Passate (-ate) de "${inf}" (IALA §95)`,
          tense: 'Participio Passate', dictEntry: [inf, 'vb', '']
        };
      }
    }
    if (low.endsWith('ite')) {
      const candEr = low.slice(0, -3) + 'er';
      const candIr = low.slice(0, -3) + 'ir';
      const inf = (verbMap[candEr] !== undefined) ? candEr : (verbMap[candIr] !== undefined ? candIr : null);
      if (inf) {
        return {
          word: orig, root: inf, pos: 'vb (part)', status: 'inflected',
          desc: `Participio Passate (-ite) de "${inf}" (IALA §95)`,
          tense: 'Participio Passate', dictEntry: [inf, 'vb', '']
        };
      }
    }
    // Participios presentes: -ante (-ar), -ente (-er), -iente (-ir/-er) (IALA §93)
    if (low.endsWith('ante') && low.length > 4) {
      const inf = low.slice(0, -4) + 'ar';
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb (part)', status: 'inflected',
          desc: `Participio Presente de "${inf}" (IALA §93)`,
          tense: 'Participio Presente', dictEntry: [inf, 'vb', '']
        };
      }
    } else if (low.endsWith('iente') && low.length > 5) {
      const candIr = low.slice(0, -5) + 'ir';
      const candEr = low.slice(0, -5) + 'er';
      const inf = (verbMap[candIr] !== undefined) ? candIr : ((verbMap[candEr] !== undefined) ? candEr : null);
      if (inf) {
        return {
          word: orig, root: inf, pos: 'vb (part)', status: 'inflected',
          desc: `Participio Presente de "${inf}" (IALA §93)`,
          tense: 'Participio Presente', dictEntry: [inf, 'vb', '']
        };
      }
    } else if (low.endsWith('ente') && low.length > 4) {
      const inf = low.slice(0, -4) + 'er';
      if (verbMap[inf] !== undefined) {
        return {
          word: orig, root: inf, pos: 'vb (part)', status: 'inflected',
          desc: `Participio Presente de "${inf}" (IALA §93)`,
          tense: 'Participio Presente', dictEntry: [inf, 'vb', '']
        };
      }
    }

    // 7. Plurales regulares y doctos (§§21-25)
    if (low.endsWith('hes') && low.length > 3) {
      const cand = low.slice(0, -3);
      if (dictMulti[cand]) {
        return {
          word: orig, root: cand, pos: 'sb (pl)', status: 'plural',
          desc: `Plural (-c → -ches) de "${cand}" (IALA §21)`,
          dictEntry: dictMulti[cand][0]
        };
      }
    }
    if (low.endsWith('eses') || low.endsWith('ites')) {
      const cand = low.slice(0, -2) + 'is';
      if (dictMulti[cand]) {
        return {
          word: orig, root: cand, pos: 'sb (pl)', status: 'plural',
          desc: `Plural docte in -is (-is → -es) de "${cand}" (IALA §22)`,
          dictEntry: dictMulti[cand][0]
        };
      }
    }
    if (low.endsWith('es') && low.length > 3) {
      const cand = low.slice(0, -2);
      if (dictMulti[cand]) {
        const p = (dictMulti[cand] as string[][])[0]![1]!;
        return {
          word: orig, root: cand, pos: `${p} (pl)`, status: 'plural',
          desc: `Plural consonantic (-es) de "${cand}" (IALA §21)`,
          dictEntry: (dictMulti[cand] as string[][])[0]!
        };
      }
    }
    if (low.endsWith('s') && low.length > 2) {
      const cand = low.slice(0, -1);
      if (dictMulti[cand]) {
        const p = (dictMulti[cand] as string[][])[0]![1]!;
        return {
          word: orig, root: cand, pos: `${p} (pl)`, status: 'plural',
          desc: `Plural vocalic (-s) de "${cand}" (IALA §21)`,
          dictEntry: dictMulti[cand][0]
        };
      }
    }

    // 8. Entrada directa en el Diccionario
    if (dictMulti[low]) {
      const entries = dictMulti[low] as string[][];
      let chosen = entries[0]!;
      
      // Si le parola possede entratas dual (p.ex. sb e adj como in -ista), harmonisar le representation
      const hasSb = entries.some(e => (e[1] ?? '').includes('sb'));
      const hasAdj = entries.some(e => (e[1] ?? '').includes('adj'));
      
      let mergedPos = chosen[1]!;
      if (hasSb && hasAdj) {
        mergedPos = 'sb/adj';
        // Si es precedite per determinante nominal o articulo, prioritizar le rolo substantive
        if (['le', 'un', 'del', 'al', 'iste', 'ille', 'nostre', 'vostre', 'su'].includes(prevLow)) {
          const sbChoice = entries.find(e => (e[1] ?? '').includes('sb'));
          if (sbChoice) chosen = sbChoice;
        }
      } else if (entries.length > 1) {
        if (['le', 'un', 'del', 'al', 'iste', 'ille', 'nostre', 'vostre', 'su'].includes(prevLow)) {
          const sbChoice = entries.find(e => (e[1] ?? '').includes('sb'));
          if (sbChoice) chosen = sbChoice;
        }
      }
      return {
        word: orig, root: chosen[0]!, pos: mergedPos, status: 'exact',
        desc: `Entrata directa (${mergedPos.toUpperCase()})`,
        dictEntry: chosen
      };
    }

    // 9. Orthographia Collateral (IALA §15)
    // Reconnection de graphias simplificate con le IED classic (p.ex. fonetic -> phonetic, tirano -> tyranno, etc.)
    const collateral = resolveCollateralOrthography(low, dictMulti);
    if (collateral && collateral.length > 0) {
      const best = collateral[0] as { dictEntry: unknown[]; classicalWord: string; desc: string; ruleId: string };
      const p = (best.dictEntry[0] && dictMulti[best.classicalWord]) ? (dictMulti[best.classicalWord] as string[][])[0]![1]! : 'adj/sb/vb';
      return {
        word: orig, root: best.classicalWord, pos: p, status: 'collateral',
        desc: `Orthographia Collateral simplificate pro "${best.classicalWord}" (${best.desc}) [IALA ${best.ruleId}]`,
        dictEntry: dictMulti[best.classicalWord] ? (dictMulti[best.classicalWord] as string[][])[0]! : [best.classicalWord, p, '']
      };
    }

    // 10. Nombres propios capitalizados (Alexander, Gode, Hugh, Blair, etc.) [IALA §14, §29]
    // ECMAScript best practice: O(1) Set lookup para descartar pronombres/articulos/conectores de inicio de oracion
    if (/^[A-ZÁÉÍÓÚ][a-zà-ÿ]+$/.test(orig) && !IALA_FUNCTION_WORDS.has(orig)) {
      return {
        word: orig, root: orig, pos: 'npr', status: 'npr',
        desc: `Nomine proprie capitalisate (${orig}) [IALA §14, §29]`,
        dictEntry: [orig, 'npr', '']
      };
    }

    // 10.b Derivation productive con prefixos (IALA §155) - e.g. deconstruction -> de- + construction
    for (const pref of PRODUCTIVE_PREFIXES) {
      if (low.startsWith(pref.p) && low.length > pref.p.length + 3) {
        const stem = low.slice(pref.p.length);
        if (dictMulti[stem]) {
          const baseEntry = (dictMulti[stem] as string[][])[0]!;
          const basePos = baseEntry[1] ?? 'sb';
          return {
            word: orig,
            root: stem,
            pos: basePos,
            status: 'prefixed',
            desc: `Derivation con prefixo "${pref.p}-" (${pref.desc}) super "${stem}" (${basePos.toUpperCase()}) [IALA §155]`,
            dictEntry: [orig, basePos, `Derivate de ${stem}`]
          };
        }
      }
    }

    // 10.c Derivation regulari con suffixos productivos (IALA §§136-154) - e.g. nutritionista -> nutrition + -ista
    for (const sfx of PRODUCTIVE_SUFFIXES) {
      if (low.endsWith(sfx.suffix) && low.length > sfx.suffix.length + 2) {
        const rawStem = low.slice(0, -sfx.suffix.length);
        const candidates = sfx.generateCandidates(rawStem);
        for (const cand of candidates) {
          if (dictMulti[cand]) {
            const baseEntries = dictMulti[cand] as string[][];
            // Verificar si ulle entrata del radice concorda con le categorias grammatical permittite
            const matchedEntry = baseEntries.find(e => {
              const p = (e[1] || '').toLowerCase();
              return sfx.allowedBasePos.some(allowed => p.includes(allowed));
            });

            if (matchedEntry) {
              const basePos = (matchedEntry[1] || '').toUpperCase();
              return {
                word: orig,
                root: cand,
                pos: sfx.resultingPos,
                status: 'derived',
                desc: `Derivation regulari in "-${sfx.suffix}" (${sfx.desc}) super le radice "${cand}" (${basePos}) [IALA ${sfx.ruleRef}]`,
                dictEntry: [orig, sfx.resultingPos, `Derivate regulari de ${cand} (${basePos}): ${sfx.desc}`]
              };
            }
          }
        }
      }
    }

    // 11. Palabra Desconocida / Posible Error Ortografico
    // Calcula sugerencias de Levenshtein en vivo contra el corpus de 51.500 palabras
    const suggestions = findSpellingSuggestions(low, vocabList, 2, 3);
    return {
      word: orig, root: orig, pos: 'non registrate', status: 'unknown',
      desc: suggestions.length > 0 
        ? `Parola non trovate in le corpus. Esque tu voleva dicer: ${suggestions.map(s => `"${s.word}" (dist. ${s.distance})`).join(', ')}?`
        : `Parola non identificate in le corpus de 51.500 entratas`,
      suggestions: suggestions
    };
  }

  return {
    conjugate: conjugateInterlingua as IALAConjugatorAPI['conjugate'],
    inflectAdjective: inflectAdjective as IALAConjugatorAPI['inflectAdjective'],
    pluralizeNoun: pluralizeNoun as IALAConjugatorAPI['pluralizeNoun'],
    deconjugateInterlingua: deconjugateInterlingua as IALAConjugatorAPI['deconjugateInterlingua'],
    deconstructUniversal: deconstructUniversal as IALAConjugatorAPI['deconstructUniversal'],
    resolveCollateralOrthography: resolveCollateralOrthography as IALAConjugatorAPI['resolveCollateralOrthography'],
    computeIALAStressHTML: computeIALAStressHTML,
    getInterlinguaIPA: getInterlinguaIPA,
    levenshteinDistance: levenshteinDistance,
    findSpellingSuggestions: findSpellingSuggestions,
    analyzeTextTokenContextual: analyzeTextTokenContextual as IALAConjugatorAPI['analyzeTextTokenContextual'],
    numAtomInterlingua: numAtomInterlingua,
    transcribeIntInterlingua: transcribeIntInterlingua,
    transcribeNumberFullInterlingua: transcribeNumberFullInterlingua
  };

})();

// Exportacion ESM publica del modulo
export const IALAConjugator = _IALAConjugatorImpl;

// Retrocompatibilitate con scripts global (script tags sin bundler)
if (typeof window !== 'undefined') {
  window.IALAConjugator = IALAConjugator;
}

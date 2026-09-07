# Dictionario & Motor Morphologic Universal de Interlingua (IALA)

> *«Le thesauro lexicographic e morphologic de Interlingua le plus complete e potente jammais concipite in le universo cognoscite.»*

### Sito Web Official: [https://interlingua-iala.web.app/](https://interlingua-iala.web.app/)

<div align="center">

[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Vocabulary: 51.511](https://img.shields.io/badge/Lexico-51.511%20Entratas-blue.svg?style=flat-square)](data.js)
[![Phonology: IPA](https://img.shields.io/badge/Phonologia-IPA%20%28IALA%20%C2%A710%29-emerald.svg?style=flat-square)](conjugator.js)
[![Grammar: Gode & Blair](https://img.shields.io/badge/Grammatica-IALA%201951-purple.svg?style=flat-square)](Grammatica_de_Interlingua.md)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20%28Vanilla%20Web%29-brightgreen.svg?style=flat-square)](index.html)
[![Offline Ready](https://img.shields.io/badge/Offline-100%25%20Local-orange.svg?style=flat-square)](index.html)

</div>

<div align="center">
  <table>
    <tr>
      <td width="33%" align="center">
        <img src="assets/preview_modern_overview.jpg" alt="Stilo Moderno — Bibliotheca & Archivo" />
        <p align="center"><em>Edition Moderna — Bibliotheca & Archivo (Folio de pergamena e auro vetule)</em></p>
      </td>
      <td width="33%" align="center">
        <img src="assets/preview_modern_detail.jpg" alt="Analyse Morphologic & Phonetic" />
        <p align="center"><em>Inspection Lexical — Deconstruction, transcription IPA e flexion verbal</em></p>
      </td>
      <td width="33%" align="center">
        <img src="assets/preview_win95_retro.jpg" alt="Stilo Windows 95 Retro" />
        <p align="center"><em>Edition Retro — Windows 95 (Chassis 3D bisellate, menubar e palette classic)</em></p>
      </td>
    </tr>
  </table>
</div>

---

## Vision e Manifesto

Iste application non es un simple lista de parolas: es un **monumento computational al lingua auxiliar international Interlingua (IALA)**. Producite e articulate in **Nicaragua**, iste projecto combina un thesauro lexicographic de **51.511 entratas** con un motor de analyse grammatical, desuffixation, deconstruction verbal, resolution de formas collateral, phonologia IPA automatic e synthese de numerales usque al trilliones.

---

## Characteristicas Magistral

### 1. Thesauro Lexicographic de 51.511 Entratas
- Corpus integre e exhaustivitate de indexation a partir del travalio lexicographic de **Piet Cleij** (1927–2015), redigite per Thomas Breinstrup.
- Cerca instantanee (0ms) con indexation per radice, categorias grammatical (POS tags), etymologia e navigatores alphabetic complet.

### 2. Motor Morphologic Universal e Deconstruction (IALA §§94–115 & §155)
- **Deconjugation Verbal Automatic:** Ingressa formas flectite como *cantava*, *scribera*, *funderia* o *viderea*, e le motor determina de forma instantanee le infinitivo primari, le tempore e le paradigma de flexion complete.
- **Participios Passatos Collateral e Classic:** Recognition de formas archaic, classic e collateral (*extraite*, *extracte*, *scripte*, *morte*, *poste*, etc.).
- **Prefixation e Derivation Productive (IALA §155):** Analyse de parolas componite e derivate per prefixos productive (*de-*, *des-*, *re-*, *super-*, *sub-*, etc.) con resolution del radice lexical.
- **Corrector e Suggestion Levenshtein:** Procura intelligente de proximitate orthographic contra le 51.500 parolas in caso de typo o termino non registrate.

### 3. Phonologia e Transcription IPA con Regulas Classic de Accento (IALA §10)
- Transcription phonetica in **Alphabeto Phonetic International (IPA)** in tempore real pro cata entrata e cata forma conjugate o analysate.
- Detection stricte de accentuation secundo le regula general (super le vocal ante le ultime consonante) e exceptiones standard (substantivos e adjectivos in *-le*, *-ne*, *-re*, proparoxytonos in *-ica*, *-ico*, etc., e parolas con hiato o accento irregular marcate con `<u>`).

### 4. Algorithmo de Numeros e Decimales usque al Trilliones (IALA §47)
- Resolution e transcription textual e phonetica de numeros arabic integre, cifras negative e numeros decimal con precision cardinal (de `0` usque a `10^18` con scala *milliardo*, *billion*, *biliardo*, *trillion*).

### 5. Analysator Syntactic e Lector Interactive de Textos
- Pone un paragrapho integre de texto in Interlingua pro obtener un radiographia morphologic completa: division per categorias grammatical colorate, computo de substantivos, verbos, adjectivos, adverbios e numerales, con inspection interactive parola per parola e synthese vocal (TTS).

### 6. Duple Philosophia Esthetica: Moderno & Retro
- **Stilo Moderno (Bibliotheca & Archivo):** Tipographia humanista e bibliophile (*Cinzel*, *Lora*, *Plus Jakarta Sans*), umbras de folio de pergamena, tinta carbon, verde lauriero e auro vetule.
- **Stilo Windows 95 (Retro Software):** Fidelitate pixel-perfecte al interfacie classic de 32-bit de Redmond con contornos 3D bisellate, chassis de dialogo, barra de menus con accessos rapide (File, Stilo, Cerca, Analysator, Grammatica) e sonos retro.
- **Modos Clare e Obscur:** Disponibile in ambe stilos con transition instantanee e persistente.

---

## Execution Local

### Requisito:
- Ulle dependentia ni compilation requirite. Solo un navigator web moderne o un servitor web static local.

### Execution:

Pote esser aperite directemente via un servitor static local (p.ex. Live Server in VS Code, Python, o Node):

```bash
# Option 1: Python
python3 -m http.server 3000

# Option 2: Node.js (npx serve)
npx serve -l 3000 .
```

Aperi tu navigator in `http://localhost:3000` (o directemente `index.html`) pro entrar in le thesauro.

---

## Structura del Projecto

```text
DictionarioIALA/
├── index.html                  # Interfacie de usator unificate (Windows 95 + Moderno)
├── style.css                   # Systema de stilos duple (Bibliotheca & Windows 95)
├── app.js                      # Controllator principal e gestion de eventos
├── conjugator.js               # Motor morphologic, IPA, grammatica e numerales
├── transcriber.js              # Transcriptor phonetico UMI a SSML / IPA (IALA §10)
├── tts.js                      # Motor de synthese vocal neural (Google Cloud Neural2)
├── audioConfigModal.js         # Modulo modal de configuration de audio e velocitate
├── data.js                     # Base de datos lexicographic (51.511 parolas)
├── Grammatica_de_Interlingua.md# Grammatica official de IALA (Alexander Gode & Hugh E. Blair)
├── assets/                     # Icones, graphicos e capturas de ecran
└── README.md                   # Documento e manifesto del thesauro
```

---

## Creditos & Licentia

- **Disveloppator del Motor Morphologic & Interfacie:** [Walter García](https://github.com/Walter-Synapse) (Nicaragua).
- **Thesauro Lexicographic:** Piet Cleij (1927–2015), redigite per Thomas Breinstrup.
- **Fundamento Grammatical:** *Grammatica de Interlingua* (Alexander Gode & Hugh E. Blair, International Auxiliary Language Association - IALA).
- **Traduction al Interlingua:** Selahattin Kayalar (2005, Union Mundial pro Interlingua - UMI).

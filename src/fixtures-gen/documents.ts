// Synthetic "Casa Protetta" general conditions, editions 2024 and 2025. Pure text builders.
// Positions that the workshop relies on are asserted by test/fixtures-generated.test.ts.

export interface Edition {
  year: '2024' | '2025';
  text: string;
  nodes: { path: string; type: 'article' | 'index' | 'note'; title: string; start: number; end: number }[];
  art12Base: number;
  /** Clauses as [subjectKey, clause text, local start]. */
  art12: Art12Layout;
}
export interface Art12Layout {
  clauses: { key: string; text: string; start: number; end: number }[];
  closing: { text: string; start: number; end: number };
}

const TITLES = [
  'Oggetto dell\'assicurazione', 'Persone assicurate', 'Dichiarazioni del contraente', 'Decorrenza e durata',
  'Pagamento del premio', 'Variazioni del rischio', 'Beni assicurati', 'Rischi esclusi', 'Denuncia del sinistro',
  'Valutazione del danno', 'Pagamento dell\'indennizzo', 'Franchigie e scoperti',
];

const WORDS = ('il contraente deve comunicare per iscritto alla società ogni variazione rilevante entro i termini previsti '
  + 'dalla polizza e secondo le modalità indicate nelle condizioni generali di assicurazione senza che ciò comporti '
  + 'alcun obbligo ulteriore per le parti salvo quanto diversamente stabilito dal presente contratto').split(' ');

/** Exactly n characters of neutral filler prose, ending with a newline. */
export function filler(n: number, seed: number): string {
  if (n <= 0) return '';
  let out = '';
  let i = seed;
  while (out.length + 12 < n - 1) {
    const w = WORDS[i % WORDS.length]!;
    if (out.length + w.length + 2 > n - 1) break;
    out += (out ? ' ' : '') + w;
    i++;
  }
  out += '.';
  return out.padEnd(n - 1, ' ') + '\n';
}

/** Local layout of Art. 12; every position is asserted (the workshop spans depend on them). */
export function art12(year: '2024' | '2025'): { text: string; layout: Art12Layout } {
  const header = 'Art. 12 - Franchigie e scoperti\n';
  const intro = 'Le franchigie e gli scoperti si applicano per ogni sinistro e per anno assicurativo.';
  let t = (header + intro).padEnd(119, ' ') + '\n'; // local [0,120)
  const clauses: Art12Layout['clauses'] = [];
  const add = (key: string, text: string, start: number, len: number) => {
    if (text.length !== len) throw new Error(`clause ${key} has length ${text.length}, expected ${len}: "${text}"`);
    if (t.length !== start) throw new Error(`clause ${key} would start at ${t.length}, expected ${start}`);
    clauses.push({ key, text, start, end: start + len });
    t += text + '\n';
  };
  const fireAmount = year === '2024' ? '500' : '750';
  add('fire.deductible', `Incendio: franchigia di ${fireAmount} EUR a evento`, 120, 40);
  add('theft.deductible', 'Furto: franchigia di 250 EUR a sinistro', 161, 39);
  add('theft.coinsurance', 'Furto: scoperto del 10 % su ogni danno.', 201, 39);
  add('liability.limit', 'Responsabilità civile: massimale di 1.000.000 EUR a evento.', 241, 59);
  const closingText = 'Altri eventi: vedi condizioni.'; // 30 chars
  let closingStart: number;
  if (year === '2024') {
    t += '--------\n'; // local [301,310)
    closingStart = 310;
  } else {
    add('hail.deductible', 'Grandine: franchigia di 300 EUR a evento', 301, 40);
    add('weather.coinsurance', 'Eventi atmosferici: scoperto del 5 % sul sinistro', 342, 49);
    closingStart = 392;
  }
  if (t.length !== closingStart) throw new Error(`closing sentence would start at ${t.length}, expected ${closingStart}`);
  t += closingText + '\n';
  return { text: t, layout: { clauses, closing: { text: closingText, start: closingStart, end: closingStart + closingText.length } } };
}

export function buildEdition(year: '2024' | '2025'): Edition {
  const target12 = year === '2024' ? 4120 : 4180;
  const header = `CASA PROTETTA - Condizioni generali di assicurazione - Edizione ${year}\n`;
  const index = header + 'INDICE\n' + TITLES.map((t, i) => `Art. ${i + 1} - ${t}\n`).join('');
  let text = index;
  const nodes: Edition['nodes'] = [{ path: 'index', type: 'index', title: 'Indice', start: 0, end: index.length }];
  // Articles 1..11 share the space between the index and Art. 12.
  const space = target12 - index.length;
  const per = Math.floor(space / 11);
  for (let i = 1; i <= 11; i++) {
    const len = i === 11 ? space - per * 10 : per;
    const head = `Art. ${i} - ${TITLES[i - 1]}\n`;
    const body = filler(len - head.length, i * 7 + (year === '2025' ? 3 : 0));
    const sec = head + body;
    nodes.push({ path: `art${i}`, type: 'article', title: TITLES[i - 1]!, start: text.length, end: text.length + sec.length });
    text += sec;
  }
  if (text.length !== target12) throw new Error(`Art. 12 base ${text.length}, expected ${target12}`);
  const a12 = art12(year);
  nodes.push({ path: 'art12', type: 'article', title: TITLES[11]!, start: text.length, end: text.length + a12.text.length });
  text += a12.text;
  const noteBody = `Nota informativa - Edizione ${year}\nIl presente testo è un documento sintetico redatto per esercitazione. Non costituisce un contratto.\n`;
  nodes.push({ path: 'note', type: 'note', title: 'Nota informativa', start: text.length, end: text.length + noteBody.length });
  text += noteBody;
  return { year, text, nodes, art12Base: target12, art12: a12.layout };
}

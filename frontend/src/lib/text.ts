const SPEAKERS: Record<string, string> = {
  USER: 'You',
  ASSISTANT: 'ChatGPT',
  CLAUDE: 'Claude',
  TOOL: 'Tool',
};

export function splitSpeaker(excerpt: string): { speaker: string | null; text: string } {
  const m = /^\[(USER|ASSISTANT|CLAUDE|TOOL)\]\r?\n/.exec(excerpt);
  if (!m) return { speaker: null, text: excerpt };
  return { speaker: SPEAKERS[m[1]], text: excerpt.slice(m[0].length) };
}

/** Removes markdown escape backslashes (`My pick\:` → `My pick:`) and extra blank lines. */
export function cleanText(s: string): string {
  return s
    .replace(/\\([\\`*_{}[\]()#+\-.!:>~|])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const STOP = new Set(
  'about after again also been before being between both could does doing down each find from have here into just like made make mentioned more most much need notes only other over said same should some such than that their them then there these they this those through under very want were what when where which while will with would wrote write your'.split(
    ' ',
  ),
);

export function queryTerms(question: string): string[] {
  const words = question.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 4 || STOP.has(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length === 8) break;
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface Segment {
  text: string;
  hit: boolean;
}

export function highlight(text: string, terms: string[]): Segment[] {
  if (terms.length === 0 || !text) return [{ text, hit: false }];
  const re = new RegExp('\\b(' + terms.map(escapeRegExp).join('|') + ')\\w*', 'gi');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

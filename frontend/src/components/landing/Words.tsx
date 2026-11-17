/** Splits text into word spans so the WebGL print can paint each word where the browser laid it out. */
export function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((w, i) => (/\s/.test(w) ? w : w ? <span key={i} className="w">{w}</span> : null))}
    </>
  );
}

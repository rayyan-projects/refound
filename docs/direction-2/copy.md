# ReFound v2 copy deck (every string, where it lives, its job)

Rules applied: plain "is/are"; no "not X but Y"; no stacked triads; no em dashes; no hype words;
no metaphors about memory; sentence case; short strings end without a period; facts only from
EXPLAINER.md / KEY_INFO.md (Gemini sees the top passages, everything else is local).

## Review bar: prototype only, do not ship
- "Direction 2 · landing page and the Ask drawer · prototype for review"   job: tell the reader what this page is

## Nav
- Wordmark "ReFound"
- Links: "How it works" · "Your data"
- Button: "Open ReFound"   job: the one action

## Hero (landing, Latent Image canvas; real DOM h1 behind it)
- H1: "You already figured this out"   job: name the situation the visitor has lived
- Sub: "It's in a ChatGPT chat from March, or a PDF, or a note you forgot you wrote. ReFound searches all of it and answers from what you found back then."
- Primary: "Open ReFound"   Secondary: "See it answer"
- In-canvas example (develops):
  - Q: "Why did the nightly backup keep timing out?"
  - A: "The backup started at 02:00, the same minute as log rotation, and both jobs fought over the disk. You moved it to 03:30 in March and it stopped failing."
  - Source line: "From GPT-0029 and ops-notes.md"
- Hint (bottom of hero): "Move the pointer through the tray"

## Section: the drawer (Ask prototype)
- H2: "Everything you import becomes index cards"
- Body: "ReFound cuts your chats and documents into passages of about 500 characters and files them like cards in a drawer. A question pulls the 20 closest. A second model rereads those and keeps the best 5, and the answer is written from them."
- Input default: "postgres deadlock on upserts"   Button: "Ask"
- Answer (develops; [n] marks are citations):
  "You fixed it by having every worker take its row locks in the same order [1]. Each batch is sorted by primary key before `INSERT … ON CONFLICT`, and SQLSTATE `40P01` is retried with jitter, three attempts at most [2]. The book chapter explains why the retry stays: Postgres breaks a lock cycle by aborting one of the transactions [3]."
- Answer meta: "5 passages · 2.4 s"
- Caption under stage: "Library uses the same drawer, split by divider cards for chats, notes, PDFs and images"
- Hint: "Move along the drawer to leaf through it · click a card to pull it"

## Section: how it works (real sequence, so numbers are information)
1. "Bring what you have" — "ChatGPT share links and exports, Claude exports, Markdown, text files, PDFs and images"
2. "Ask the way you'd ask a colleague" — "“That bug with the database lock” finds the chat even if you never typed “deadlock”"
3. "Check the source" — "Each answer lists the passages it used. Open one to read it in the original chat or file"

## Section: your data (id="data")
- H2: "Where your data goes"
- Body: "Your imports, the search index and your question history stay on your computer, in a SQLite file and a FAISS index. To write an answer, ReFound sends your question and the 5 best passages to Google Gemini. Leave the Gemini key empty and you still get the passages, without the written answer."

## Footer
- "ReFound runs on your own machine"
- Small: "Type: Syne and Familjen Grotesk. 3D: Three.js r170"

/** Every landing string, verbatim from docs/direction-2/copy.md. */
export const COPY = {
  navHow: 'How it works',
  navData: 'Your data',
  open: 'Open ReFound',
  h1: 'You already figured this out',
  sub: "It's in a ChatGPT chat from March, or a PDF, or a note you forgot you wrote. ReFound searches all of it and answers from what you found back then.",
  seeIt: 'See it answer',
  exampleLabel: 'Example',
  exampleQ: 'Why did the nightly backup keep timing out?',
  exampleA:
    'The backup started at 02:00, the same minute as log rotation, and both jobs fought over the disk. You moved it to 03:30 in March and it stopped failing.',
  exampleSrc: 'From GPT-0029 and ops-notes.md',
  hint: 'Move the pointer through the tray',
  drawerH: 'Everything you import becomes index cards',
  drawerBody:
    'ReFound cuts your chats and documents into passages of about 500 characters and files them like cards in a drawer. A question pulls the 20 closest. A second model rereads those and keeps the best 5, and the answer is written from them.',
  askDefault: 'postgres deadlock on upserts',
  askButton: 'Ask',
  answerMeta: '5 passages · 2.4 s',
  drawerCaption: 'Library uses the same drawer, split by divider cards for chats, notes, PDFs and images',
  drawerHint: 'Move along the drawer to leaf through it · click a card to pull it',
  howH: 'How it works',
  steps: [
    { title: 'Bring what you have', text: 'ChatGPT share links and exports, Claude exports, Markdown, text files, PDFs and images' },
    { title: "Ask the way you'd ask a colleague", text: '“That bug with the database lock” finds the chat even if you never typed “deadlock”' },
    { title: 'Check the source', text: 'Each answer lists the passages it used. Open one to read it in the original chat or file' },
  ],
  dataH: 'Where your data goes',
  dataLead: 'Your imports, the search index and your question history stay on your computer',
  dataRest:
    ', in a SQLite file and a FAISS index. To write an answer, ReFound sends your question and the 5 best passages to Google Gemini. Leave the Gemini key empty and you still get the passages, without the written answer.',
  footer: 'ReFound runs on your own machine',
  footerSmall: 'Type: Syne and Familjen Grotesk. 3D: Three.js r170',
};

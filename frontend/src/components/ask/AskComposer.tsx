import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Square } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../hooks/useStore';
import { ask, askStore, isAsking, stopAsking } from '../../state/ask';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';

const MAX_LINES = 4;

export function AskComposer({
  size,
  disabled = false,
  placeholder = 'Ask a question',
  initialValue = '',
}: {
  size: 'lg' | 'md';
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}) {
  const navigate = useNavigate();
  const status = useStore(askStore, (s) => s.status);
  const question = useStore(askStore, (s) => s.question);
  const [value, setValue] = useState(question || initialValue);
  const [seenQuestion, setSeenQuestion] = useState(question);
  const ref = useRef<HTMLTextAreaElement>(null);
  const asking = isAsking(status);

  // A question started elsewhere (recent questions, the palette, history) shows up in the box.
  if (question !== seenQuestion) {
    setSeenQuestion(question);
    if (question) setValue(question);
  }

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES + 1)}px`;
  }

  useLayoutEffect(resize, [value, size]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    void ask(text);
    navigate(`/ask?q=${encodeURIComponent(text)}`, { replace: true });
    requestAnimationFrame(() => ref.current?.select());
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const lg = size === 'lg';
  return (
    <form
      role="search"
      onSubmit={submit}
      className={clsx(
        'flex flex-col rounded-lg border border-control bg-surface p-2 transition-colors duration-fast ease-out focus-within:outline focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-focus',
        disabled ? 'cursor-not-allowed bg-sunken opacity-50' : 'hover:border-ink-3',
      )}
    >
      <div className={clsx('flex items-end gap-2', lg ? 'min-h-10' : 'min-h-7')}>
        <textarea
          ref={ref}
          id="ask-composer"
          rows={1}
          aria-label="Question"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className={clsx(
            'block min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-ink placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed',
            lg ? 'text-md md:text-lg' : 'text-md',
          )}
        />
        {asking ? (
          <Button variant="secondary" icon={Square} onClick={stopAsking}>
            Stop
          </Button>
        ) : (
          <IconButton icon={ArrowUp} label="Ask" variant="primary" type="submit" disabled={disabled || !value.trim()} />
        )}
      </div>
      {lg && (
        <p className="hidden items-center gap-1.5 px-2 pb-1 pt-1 text-xs text-ink-3 md:flex">
          <Kbd>↵</Kbd> to ask
          <span aria-hidden="true" className="px-1">
            ·
          </span>
          <Kbd>Shift</Kbd>
          <Kbd>↵</Kbd> for a new line
        </p>
      )}
    </form>
  );
}

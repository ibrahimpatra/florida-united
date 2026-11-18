'use client';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

/**
 * Drop-in replacement for <input type="number">. It keeps what the person is TYPING ("0.", "1.50", "")
 * separately from the number the parent stores, so typing a decimal or clearing the box never rewrites
 * the field under the cursor (which made inputs jump and lose focus). Parents keep using
 * onChange={e => set(Number(e.target.value))} exactly as before.
 */
export function NumberInput({ value, onChange, onBlur, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [text, setText] = useState<string>(value === undefined || value === null ? '' : String(value));
  const typing = useRef(false);

  useEffect(() => {
    // Follow outside changes (loading data, "reset") but never fight the user while they type.
    const incoming = value === undefined || value === null ? '' : String(value);
    if (!typing.current && incoming !== text && !(text !== '' && Number(text) === Number(incoming))) setText(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input {...rest} type="number" inputMode="decimal" value={text}
      onChange={e => { typing.current = true; setText(e.target.value); onChange?.(e); }}
      onBlur={e => { typing.current = false; const n = value === undefined || value === null ? '' : String(value); if (Number(text) !== Number(n) || text === '') setText(n); onBlur?.(e); }} />
  );
}

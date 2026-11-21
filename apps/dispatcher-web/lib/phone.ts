// US phone numbers only: 10 digits, shown as (415) 555-0100.
// Shared by the driver form (format while typing) and the drivers API (validation).

/** Digits only, with a leading US country code 1 dropped and capped at 10. */
export function phoneDigits(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * Formats as the user types: "(415", "(415) 555", "(415) 555-0100".
 * No trailing ")" or "-" on partial input, so backspace never gets stuck on one.
 */
export function formatPhoneInput(raw: string) {
  const d = phoneDigits(raw);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Reformats after an edit and works out where the cursor belongs, so editing in
 * the middle of a number doesn't throw the cursor to the end.
 *  - prev: the field's value before the edit
 *  - raw / caret: the browser's new value and cursor position
 * The cursor stays after the same number of digits it was after. Backspacing
 * over a ")", " " or "-" deletes the digit before it instead of doing nothing
 * (or the digit after it, for the Delete key: pass forwardDelete).
 */
export function phoneEdit(prev: string, raw: string, caret: number, forwardDelete = false) {
  let digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;

  // Backspace/Delete removed only a separator: remove the neighbouring digit instead.
  const removedOnlySeparator =
    raw.length === prev.length - 1 &&
    raw.replace(/\D/g, "") === prev.replace(/\D/g, "") &&
    /\D/.test(prev[caret] ?? "");
  if (removedOnlySeparator) {
    const all = raw.replace(/\D/g, "");
    if (forwardDelete) {
      raw = all.slice(0, digitsBefore) + all.slice(digitsBefore + 1);
    } else if (digitsBefore > 0) {
      raw = all.slice(0, digitsBefore - 1) + all.slice(digitsBefore);
      digitsBefore -= 1;
    }
  }

  // A leading US "1" gets dropped by formatting, so it no longer counts.
  const all = raw.replace(/\D/g, "");

  // Already 10 digits: ignore an extra typed digit rather than pushing one off the end.
  const isUsPrefix = all.length === 11 && all.startsWith("1");
  if (phoneDigits(prev).length === 10 && all.length > 10 && !isUsPrefix) {
    return { value: prev, caret: Math.max(0, caret - (all.length - 10)) };
  }

  if (all.length === 11 && all.startsWith("1")) digitsBefore = Math.max(0, digitsBefore - 1);

  const value = formatPhoneInput(raw);
  digitsBefore = Math.min(digitsBefore, phoneDigits(raw).length);

  // Place the cursor right after the nth digit of the formatted value.
  let pos = 0;
  if (digitsBefore > 0) {
    let seen = 0;
    for (let i = 0; i < value.length; i++) {
      if (/\d/.test(value[i]) && ++seen === digitsBefore) { pos = i + 1; break; }
    }
  } else if (value.startsWith("(")) {
    pos = 1;
  }
  return { value, caret: pos };
}

/** Error message for a phone field, or null when it's a valid 10-digit number. */
export function phoneError(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length === 0) return "Phone number is required.";
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length > 10) return "That's too many digits. Enter a 10-digit US phone number.";
  if (d.length < 10) return `Enter a 10-digit phone number (${d.length} of 10 so far).`;
  return null;
}

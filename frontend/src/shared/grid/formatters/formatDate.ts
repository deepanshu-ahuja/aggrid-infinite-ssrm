const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
});

/**
 * Formatting is presentation and must never crash the grid while validation intentionally keeps an
 * invalid LOCAL draft visible. Return the raw draft when it is not a parseable date; field validation
 * remains responsible for explaining/blocking the invalid edit.
 */
export function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

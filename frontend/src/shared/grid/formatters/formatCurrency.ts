/**
 * Format an amount using its row currency without allowing a deliberately invalid LOCAL currency draft
 * to crash AG Grid rendering. Validation owns whether the currency is acceptable; presentation must be
 * total/safe for every transient draft value so the user can still see and correct that invalid draft.
 */
export function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;

    // A blank/malformed currency is expected to be possible while LOCAL validation is failing. Fall back
    // to a plain localized number until the user corrects/discards the currency instead of throwing from
    // a valueFormatter and breaking AG Grid row rendering.
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
    }).format(value);
  }
}

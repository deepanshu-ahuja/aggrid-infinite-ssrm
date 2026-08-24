const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
});

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

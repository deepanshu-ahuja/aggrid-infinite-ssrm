/** Trigger a browser download for file bytes already returned by an API. */
export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = objectUrl;
    link.download = filename;
    // The element does not need to stay mounted, but appending it makes click/download behavior more
    // consistent across browsers than dispatching a click on a completely detached anchor.
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Object URLs retain the Blob until revoked. Always release it even if a browser blocks the click.
    URL.revokeObjectURL(objectUrl);
  }
}

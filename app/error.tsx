'use client';
export default function Error({ error }: { error: Error }) {
  return (
    <html><body>
      <h1>App Error</h1>
      <pre>{error.message}</pre>
    </body></html>
  );
}

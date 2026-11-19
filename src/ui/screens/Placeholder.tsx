export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <p class="muted">{note}</p>
    </section>
  );
}

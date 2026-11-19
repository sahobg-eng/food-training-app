export function ScreenHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header class="screen-header">
      {back && (
        <a class="back" href={'#' + back} aria-label="Back">
          ‹
        </a>
      )}
      <h1>{title}</h1>
    </header>
  );
}

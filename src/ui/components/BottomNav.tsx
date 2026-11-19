export interface Tab {
  path: string;
  label: string;
}

export function BottomNav({ tabs, active }: { tabs: Tab[]; active: string }) {
  return (
    <nav class="bottom-nav">
      {tabs.map((t) => (
        <a
          key={t.path}
          href={'#' + t.path}
          class={t.path === active ? 'nav-item active' : 'nav-item'}
          aria-current={t.path === active ? 'page' : undefined}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

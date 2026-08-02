import './ViewToggle.css';

/**
 * Floating view-toggle button — switches between the broadsheet view (default)
 * and the classic dashboard view (?view=dashboard).
 *
 * The toggle manipulates `?view=` in the URL and forces a full reload so the
 * App's top-level routing picks it up cleanly. This avoids having to lift the
 * view-mode into a context/store; a reload also resets any stale Plotly or
 * IntersectionObserver state from the other view.
 */
export interface ViewToggleProps {
  current: 'broadsheet' | 'dashboard';
}

export function ViewToggle({ current }: ViewToggleProps) {
  const target = current === 'broadsheet' ? 'dashboard' : 'broadsheet';
  const label = current === 'broadsheet' ? 'Classic Dashboard' : 'Broadsheet View';

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (target === 'broadsheet') {
      url.searchParams.delete('view'); // broadsheet is the default
    } else {
      url.searchParams.set('view', 'dashboard');
    }
    window.location.href = url.toString();
  };

  const href =
    target === 'broadsheet' ? '?' : '?view=dashboard';

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`view-toggle ${current === 'dashboard' ? 'view-toggle-dashboard' : ''}`}
      aria-label={`Switch to ${label}`}
      title={`Switch to ${label}`}
    >
      <span className="view-toggle-dot" aria-hidden />
      {label}
    </a>
  );
}

export default ViewToggle;

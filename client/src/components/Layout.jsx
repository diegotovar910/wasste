import { NavLink, Outlet } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { api } from '../services/api.js';
import { ThemeToggle } from './ThemeToggle.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'City overview', end: true },
  { to: '/scan', label: 'Waste scanner' },
  { to: '/analytics', label: 'Analytics' },
];

function SystemStatus() {
  const { data, error } = useApi((signal) => api.health(signal), []);

  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <span aria-hidden="true" style={{ color: 'var(--status-critical)' }}>
          ●
        </span>
        API offline
      </span>
    );
  }

  if (!data) return null;

  const items = [
    { label: 'Database', ok: data.database === 'connected', okText: 'connected', badText: 'unavailable' },
    { label: 'Gemini', ok: data.gemini === 'configured', okText: 'live', badText: 'demo mode' },
  ];

  return (
    <div className="flex items-center gap-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span
            aria-hidden="true"
            style={{ color: item.ok ? 'var(--status-good)' : 'var(--status-warning)' }}
          >
            ●
          </span>
          {item.label}: {item.ok ? item.okText : item.badText}
        </span>
      ))}
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-full flex-col bg-plane">
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <img src="/wasste-mark.svg" alt="" width="28" height="28" className="rounded-lg" />
            <span className="text-base font-semibold tracking-tight text-ink">Wasste</span>
            <span className="hidden text-[11px] text-ink-muted sm:inline">Smart Waste Sorting System</span>
          </NavLink>

          <nav className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive ? 'bg-inset text-ink' : 'text-ink-secondary hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:block">
              <SystemStatus />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-hairline px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
          <p>
            Wasste prototype - sensor readings are simulated and impact figures are modelled
            estimates.
          </p>
          <div className="md:hidden">
            <SystemStatus />
          </div>
        </div>
      </footer>
    </div>
  );
}

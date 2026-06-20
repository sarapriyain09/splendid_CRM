'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const PLATFORM_APPS = [
  { key: 'crm', label: 'CRM', href: '/dashboard' },
  {
    key: 'sales',
    label: 'Sales',
    href: 'https://sales.velynxia.com/',
    external: true,
  },
  {
    key: 'callcrm',
    label: 'CallCRM',
    href: 'https://callcrm.velynxia.com/',
    external: true,
  },
  {
    key: 'marketing',
    label: 'Marketing',
    href: 'https://marketing.velynxia.com/',
    external: true,
  },
  { key: 'automation', label: 'Automation', href: '/automation' },
  { key: 'analytics', label: 'Analytics', href: '/analytics' },
] as const;

const NAV = [
  { href: '/dashboard',  icon: '⊞', label: 'Dashboard'  },
  { href: '/companies',  icon: '◍', label: 'Accounts'   },
  { href: '/contacts',   icon: '☏', label: 'Contacts'   },
  { href: '/activities', icon: '◷', label: 'Activities' },
  { href: '/tasks',      icon: '✓', label: 'Tasks'      },
  { href: '/notes',      icon: '✎', label: 'Notes'      },
  { href: '/documents',  icon: '▤', label: 'Documents'  },
];

export default function Sidebar() {
  const path = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin';
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === '1' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const navItems = isDemoMode || !isAdmin
    ? NAV
    : [...NAV, { href: '/settings', icon: '⚙', label: 'Settings' }];

  const activePlatformKey = (() => {
    if (path.startsWith('/sales')) return 'sales';
    if (path.startsWith('/callcrm')) return 'callcrm';
    if (path.startsWith('/marketing')) return 'marketing';
    if (path.startsWith('/automation')) return 'automation';
    if (path.startsWith('/analytics')) return 'analytics';
    return 'crm';
  })();

  return (
    <aside className="sidebar-scroll w-60 flex-shrink-0 bg-[#0f1d33] border-r border-[#1d2f4f] flex flex-col h-screen sticky top-0 overflow-y-scroll">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1d2f4f]">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#8ea6cf] mb-2">Velynxia Growth Platform</div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2f65c8] shadow-sm flex items-center justify-center text-white font-bold text-sm">ST</div>
          <div>
            <div className="text-sm font-bold text-[#edf3ff] leading-tight">CRM</div>
            <div className="text-xs text-[#b8c8e6]">Velynxia</div>
          </div>
        </div>
      </div>

      {/* App switcher */}
      <div className="px-3 py-3 border-b border-[#1d2f4f]">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[#8ea6cf] mb-2">Apps</div>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_APPS.map((app) => (
            <Link
              key={app.key}
              href={app.href}
              target={'external' in app && app.external ? '_blank' : undefined}
              rel={'external' in app && app.external ? 'noopener noreferrer' : undefined}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                activePlatformKey === app.key
                  ? 'bg-white text-[#10213d]'
                  : 'bg-[#132845] text-[#9eb3d9] hover:bg-[#1a3154] hover:text-[#dce9ff]'
              }`}
            >
              {app.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 space-y-1 border-b border-[#1d2f4f]">
        {navItems.map(({ href, icon, label }) => {
          const active = href === '/dashboard' ? path === '/dashboard' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-[#10213d] shadow-sm'
                  : 'text-[#dbe7ff] hover:text-white hover:bg-[#173156]'
              }`}
            >
              <span className="text-base w-5 text-center opacity-90">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#1d2f4f]">
        <div className="px-3 py-2 rounded-md bg-[#132845] border border-[#2a4369]">
          <div className="text-xs text-[#edf3ff] font-medium truncate">{session?.user?.name ?? 'User'}</div>
          <div className="text-xs text-[#b8c8e6] truncate">{session?.user?.email}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-2 w-full text-xs text-[#c7d6f2] hover:text-white py-1 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

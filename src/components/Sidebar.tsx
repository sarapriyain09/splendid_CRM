'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV = [
  { href: '/dashboard',       icon: '⊞', label: 'Dashboard'           },
  { href: '/generate',        icon: '⚡', label: 'Prospect Generator'  },
  { href: '/prospect-finder', icon: '⊙', label: 'Prospect Finder'     },
  { href: '/prospects',       icon: '◈', label: 'Prospects'            },
  { href: '/leads',           icon: '◎', label: 'Leads'                },
  { href: '/pipeline',        icon: '⊟', label: 'Pipeline'             },
  { href: '/quotes',          icon: '◻', label: 'Quotes'               },
  { href: '/tasks',           icon: '✓', label: 'Tasks'                },
  { href: '/settings',        icon: '⚙', label: 'Settings'             },
];

export default function Sidebar() {
  const path = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">ST</div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-tight">Splendid CRM</div>
            <div className="text-xs text-slate-500">Splendid Technology</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon, label }) => {
          const active = href === '/dashboard' ? path === '/dashboard' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 rounded-lg bg-slate-800">
          <div className="text-xs text-slate-300 font-medium truncate">{session?.user?.name ?? 'User'}</div>
          <div className="text-xs text-slate-500 truncate">{session?.user?.email}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-2 w-full text-xs text-slate-500 hover:text-slate-300 py-1 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

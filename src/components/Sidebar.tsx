'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV = [
  { href: '/dashboard',       icon: '⊞', label: 'Dashboard'           },
  { href: '/ai-assistant',    icon: 'AI', label: 'AI Assistant'       },
  { href: '/generate',        icon: '⚡', label: 'Prospect Generator'  },
  { href: '/prospect-finder', icon: '⊙', label: 'Prospect Finder'     },
  { href: '/prospects',       icon: '◈', label: 'Prospects'            },
  { href: '/leads',           icon: '◎', label: 'Leads'                },
  { href: '/pipeline',        icon: '⊟', label: 'Pipeline'             },
  { href: '/quotes',          icon: '◻', label: 'Quotes'               },
  { href: '/tasks',           icon: '✓', label: 'Tasks'                },
  { href: '/upwork',          icon: 'UW', label: 'Upwork Leads'         },
  { href: '/linkedin',        icon: 'in', label: 'LinkedIn Leads'      },
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

  return (
    <aside className="sidebar-scroll w-60 flex-shrink-0 bg-[#0f1d33] border-r border-[#1d2f4f] flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1d2f4f]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2f65c8] shadow-sm flex items-center justify-center text-white font-bold text-sm">ST</div>
          <div>
            <div className="text-sm font-bold text-[#edf3ff] leading-tight">Splendid CRM</div>
            <div className="text-xs text-[#b8c8e6]">Splendid Technology</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
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

import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Users, FileText, Settings, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';

const links = [
  { to: '/',         label: 'Home',     icon: Home },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/groups',   label: 'Groups',   icon: Users },
  { to: '/posts',    label: 'Posts',    icon: FileText },
  { to: '/wellness', label: 'Wellness', icon: Heart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav className={cn(
      'sticky top-0 z-40',
      // Glass surface
      'bg-white/60 dark:bg-[#0d0d0f]/70',
      // Frosted blur
      'backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl',
      // Hairline bottom border — matches card borders
      'border-b border-black/[0.06] dark:border-white/[0.06]',
      // Subtle shadow to lift it off the page
      'shadow-[0_1px_0_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.03)]',
    )}>
      <div className="max-w-5xl mx-auto flex items-center gap-1 px-4 h-12">

        {/* Nav links */}
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {links.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <RouterNavLink
                key={to}
                to={to}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap select-none',
                  active
                    ? [
                        // Active pill — glass white in dark, white card in light
                        'bg-white dark:bg-white/[0.09]',
                        'text-foreground',
                        // Subtle ring instead of harsh border
                        'shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10)]',
                        'shadow-sm',
                      ]
                    : [
                        'text-muted-foreground',
                        'hover:text-foreground',
                        'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
                      ],
                )}
              >
                <Icon
                  style={{ width: 15, height: 15 }}
                  className={active ? 'text-primary' : 'text-muted-foreground'}
                />
                <span className="hidden sm:inline">{label}</span>
              </RouterNavLink>
            );
          })}
        </div>

        {/* Notification bell */}
        <div className="shrink-0 ml-1">
          <NotificationBell />
        </div>
      </div>
    </nav>
  );
}
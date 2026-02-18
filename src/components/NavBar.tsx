import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Users, FileText, Settings, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/posts', label: 'Posts', icon: FileText },
  { to: '/wellness', label: 'Wellness', icon: Heart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="max-w-5xl mx-auto flex items-center gap-1 px-4 h-12">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <RouterNavLink
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </RouterNavLink>
            );
          })}
        </div>
        <NotificationBell />
      </div>
    </nav>
  );
}
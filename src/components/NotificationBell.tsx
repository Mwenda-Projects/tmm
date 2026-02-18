import { Bell, MessageSquare, Users, Phone, FileText, Info, CheckCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const typeIcons: Record<string, typeof Bell> = {
  message: MessageSquare,
  group_message: Users,
  call: Phone,
  post: FileText,
  system: Info,
};

function NotificationItem({ n, onRead }: { n: Notification; onRead: () => void }) {
  const Icon = typeIcons[n.type] || Bell;

  return (
    <button
      onClick={onRead}
      className={cn(
        'w-full text-left px-3 py-2.5 flex gap-2.5 transition-colors border-b border-border',
        n.is_read ? 'opacity-60' : 'bg-accent/40 hover:bg-accent/60',
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
        {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} n={n} onRead={() => !n.is_read && markAsRead(n.id)} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

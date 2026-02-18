import { useGuestStatus } from '@/contexts/GuestContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function GuestBanner() {
  const { isGuest, expiresAt } = useGuestStatus();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('expired');
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeft(`${hours}h ${mins}m`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!isGuest) return null;

  return (
    <div className="sticky top-12 z-30 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Guest access expires in <strong>{timeLeft}</strong>. Verify your university email to continue.
          </span>
        </div>
        <button
          onClick={() => navigate('/auth')}
          className="text-xs font-medium text-destructive underline underline-offset-2 hover:text-destructive/80 whitespace-nowrap"
        >
          Register now
        </button>
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';

interface IncomingCallModalProps {
  callerName: string;
  callerInstitution?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ callerName, callerInstitution, onAccept, onDecline }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-lg text-center max-w-sm w-full mx-4">
        <div className="mb-2">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Phone className="h-7 w-7 text-primary animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Incoming Call</h3>
          <p className="text-foreground font-medium mt-1">{callerName}</p>
          {callerInstitution && (
            <p className="text-sm text-muted-foreground">{callerInstitution}</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mt-6">
          <Button
            variant="destructive"
            size="icon"
            className="rounded-full h-14 w-14"
            onClick={onDecline}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            className="rounded-full h-14 w-14 bg-green-600 hover:bg-green-700 text-white"
            onClick={onAccept}
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}

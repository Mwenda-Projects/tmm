import { Card, CardContent } from '@/components/ui/card';

interface LoadingSkeletonProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Skeleton layout variant */
  variant?: 'card' | 'list' | 'chat';
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />;
}

function CardSkeleton() {
  return (
    <Card className="border-border">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-3">
          <SkeletonPulse className="h-9 w-9 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1">
            <SkeletonPulse className="h-4 w-48 max-w-full" />
            <SkeletonPulse className="h-3 w-32 max-w-[80%]" />
          </div>
        </div>
        <SkeletonPulse className="h-3 w-full" />
        <SkeletonPulse className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      <SkeletonPulse className="h-9 w-9 rounded-full shrink-0" />
      <div className="space-y-1.5 flex-1">
        <SkeletonPulse className="h-4 w-40 max-w-full" />
        <SkeletonPulse className="h-3 w-24 max-w-[60%]" />
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Incoming message */}
      <div className="flex gap-2">
        <SkeletonPulse className="h-7 w-7 rounded-full shrink-0" />
        <div className="space-y-1.5">
          <SkeletonPulse className="h-10 w-52 rounded-xl" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
      </div>
      {/* Outgoing message */}
      <div className="flex justify-end">
        <SkeletonPulse className="h-10 w-44 rounded-xl" />
      </div>
      {/* Incoming message */}
      <div className="flex gap-2">
        <SkeletonPulse className="h-7 w-7 rounded-full shrink-0" />
        <div className="space-y-1.5">
          <SkeletonPulse className="h-16 w-60 rounded-xl" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ count = 3, variant = 'card' }: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'chat') {
    return <ChatSkeleton />;
  }

  return (
    <div className={variant === 'list' ? '' : 'space-y-4'}>
      {items.map((i) =>
        variant === 'list' ? <ListSkeleton key={i} /> : <CardSkeleton key={i} />
      )}
    </div>
  );
}

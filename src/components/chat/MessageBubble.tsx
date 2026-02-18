import { format } from 'date-fns';

interface MessageBubbleProps {
  content: string;
  createdAt: string;
  isOwn: boolean;
  senderName?: string;
}

export function MessageBubble({ content, createdAt, isOwn, senderName }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-secondary text-secondary-foreground rounded-bl-sm'
        }`}
      >
        {!isOwn && senderName && (
          <p className="text-xs font-semibold mb-0.5 opacity-70">{senderName}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
          {format(new Date(createdAt), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}

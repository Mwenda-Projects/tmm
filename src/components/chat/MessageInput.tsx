import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<{ error: any }>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const { error } = await onSend(trimmed);
    if (!error) setText('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border bg-card">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        disabled={disabled || sending}
        className="min-h-[40px] max-h-[120px] resize-none bg-muted/50"
        rows={1}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!text.trim() || sending || disabled}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

import { toast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import React from 'react';

type NotifyVariant = 'success' | 'error' | 'warning' | 'info';

interface NotifyOptions {
  title: string;
  description?: string;
  variant?: NotifyVariant;
}

/**
 * Unified notification helper that wraps the shadcn toast system
 * with consistent styling for success, error, warning, and info messages.
 *
 * Usage:
 *   notify({ title: 'Message sent!', variant: 'success' });
 *   notify({ title: 'Failed to load', description: 'Please try again.', variant: 'error' });
 */
export function notify({ title, description, variant = 'info' }: NotifyOptions) {
  const toastVariant = variant === 'error' ? 'destructive' as const : 'default' as const;

  toast({
    title,
    description,
    variant: toastVariant,
  });
}

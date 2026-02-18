
-- Drop the overly permissive insert policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- No user-facing INSERT policy needed since all inserts happen via SECURITY DEFINER triggers
-- which bypass RLS entirely. This is the correct pattern.

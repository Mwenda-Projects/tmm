-- Fix: The INSERT policy on messages is RESTRICTIVE with no PERMISSIVE INSERT policy,
-- meaning nobody can insert. Change it to PERMISSIVE.

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND NOT is_active_guest(auth.uid())
  AND (
    receiver_id IS NOT NULL
    OR (group_id IS NOT NULL AND is_group_member(auth.uid(), group_id))
  )
);
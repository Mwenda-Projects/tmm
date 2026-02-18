-- Queue for users seeking random video matches
CREATE TABLE public.random_match_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.random_match_queue ENABLE ROW LEVEL SECURITY;

-- Users can insert themselves
CREATE POLICY "Users can join queue"
  ON public.random_match_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT is_active_guest(auth.uid()));

-- Users can see queue to find a match
CREATE POLICY "Users can view queue"
  ON public.random_match_queue FOR SELECT
  USING (true);

-- Users can remove themselves from queue
CREATE POLICY "Users can leave queue"
  ON public.random_match_queue FOR DELETE
  USING (auth.uid() = user_id);

-- Function to atomically find and remove a match
CREATE OR REPLACE FUNCTION public.find_random_match(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_user_id uuid;
BEGIN
  -- Find oldest waiting user that isn't the caller
  SELECT user_id INTO matched_user_id
  FROM public.random_match_queue
  WHERE user_id != _user_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF matched_user_id IS NOT NULL THEN
    -- Remove both users from queue
    DELETE FROM public.random_match_queue WHERE user_id IN (_user_id, matched_user_id);
  END IF;

  RETURN matched_user_id;
END;
$$;
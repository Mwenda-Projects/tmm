
-- Guest sessions table
CREATE TABLE public.guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests can view own session"
  ON public.guest_sessions
  AS RESTRICTIVE
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Guests can create own session"
  ON public.guest_sessions
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to check active guest
CREATE OR REPLACE FUNCTION public.is_active_guest(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guest_sessions
    WHERE user_id = _user_id AND expires_at > now()
  );
$$;

-- Update handle_new_user to skip anonymous users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.is_anonymous = true THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Block guests from sending messages
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT is_active_guest(auth.uid())
    AND ((receiver_id IS NOT NULL) OR (group_id IS NOT NULL AND is_group_member(auth.uid(), group_id)))
  );

-- Block guests from creating posts
DROP POLICY IF EXISTS "Users can create own posts" ON public.thought_posts;
CREATE POLICY "Users can create own posts"
  ON public.thought_posts
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND NOT is_active_guest(auth.uid()));

-- Block guests from starting calls
DROP POLICY IF EXISTS "Users can create call sessions" ON public.call_sessions;
CREATE POLICY "Users can create call sessions"
  ON public.call_sessions
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (auth.uid() = caller_id AND NOT is_active_guest(auth.uid()));

-- Cleanup function for expired guests
CREATE OR REPLACE FUNCTION public.cleanup_expired_guests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.group_members
  WHERE user_id IN (SELECT user_id FROM public.guest_sessions WHERE expires_at <= now());
  DELETE FROM public.guest_sessions WHERE expires_at <= now();
END;
$$;


-- Create notification type enum
CREATE TYPE public.notification_type AS ENUM ('message', 'group_message', 'call', 'post', 'system');

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify on direct message
CREATE OR REPLACE FUNCTION public.notify_on_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  IF NEW.receiver_id IS NOT NULL AND NEW.group_id IS NULL THEN
    SELECT COALESCE(full_name, email) INTO sender_name
    FROM public.profiles WHERE user_id = NEW.sender_id;

    INSERT INTO public.notifications (user_id, type, title, body, reference_id)
    VALUES (
      NEW.receiver_id,
      'message',
      'New message from ' || COALESCE(sender_name, 'Someone'),
      LEFT(NEW.content, 100),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_dm
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_dm();

-- Trigger: notify on group message
CREATE OR REPLACE FUNCTION public.notify_on_group_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  group_name text;
  member record;
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO sender_name
    FROM public.profiles WHERE user_id = NEW.sender_id;

    SELECT name INTO group_name
    FROM public.groups WHERE id = NEW.group_id;

    FOR member IN
      SELECT user_id FROM public.group_members
      WHERE group_id = NEW.group_id AND user_id != NEW.sender_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, reference_id)
      VALUES (
        member.user_id,
        'group_message',
        COALESCE(sender_name, 'Someone') || ' in ' || COALESCE(group_name, 'a group'),
        LEFT(NEW.content, 100),
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_group_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_group_message();

-- Trigger: notify on incoming call
CREATE OR REPLACE FUNCTION public.notify_on_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_name text;
BEGIN
  IF NEW.status = 'ringing' THEN
    SELECT COALESCE(full_name, email) INTO caller_name
    FROM public.profiles WHERE user_id = NEW.caller_id;

    INSERT INTO public.notifications (user_id, type, title, body, reference_id)
    VALUES (
      NEW.receiver_id,
      'call',
      'Incoming call from ' || COALESCE(caller_name, 'Someone'),
      NULL,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_call
  AFTER INSERT ON public.call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_call();

-- Trigger: notify on new post (notify users who share the poster's majors)
CREATE OR REPLACE FUNCTION public.notify_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poster_name text;
  recipient record;
BEGIN
  SELECT COALESCE(full_name, email) INTO poster_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  FOR recipient IN
    SELECT DISTINCT umm.user_id
    FROM public.user_major_map umm
    WHERE umm.major_id IN (SELECT major_id FROM public.user_major_map WHERE user_id = NEW.user_id)
      AND umm.user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, reference_id)
    VALUES (
      recipient.user_id,
      'post',
      'New post by ' || COALESCE(poster_name, 'Someone') || ': ' || LEFT(NEW.title, 50),
      LEFT(NEW.body, 100),
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_post
  AFTER INSERT ON public.thought_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_post();

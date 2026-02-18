
-- Add missing columns to existing profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS institution_name text,
ADD COLUMN IF NOT EXISTS institution_logo_url text;

-- Create majors table
CREATE TABLE public.majors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view majors" ON public.majors FOR SELECT TO authenticated USING (true);

-- Create user_major_map table
CREATE TABLE public.user_major_map (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  major_id uuid NOT NULL REFERENCES public.majors(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, major_id)
);
ALTER TABLE public.user_major_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all major mappings" ON public.user_major_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own major" ON public.user_major_map FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own major" ON public.user_major_map FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create groups table
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  major_id uuid REFERENCES public.majors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups" ON public.groups FOR SELECT TO authenticated USING (true);

-- Create group_members table
CREATE TABLE public.group_members (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check group membership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_target CHECK (receiver_id IS NOT NULL OR group_id IS NOT NULL)
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view DMs they sent or received" ON public.messages FOR SELECT TO authenticated
  USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
    OR
    (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id))
  );
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      receiver_id IS NOT NULL
      OR (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id))
    )
  );

-- Create category enum for thought_posts
CREATE TYPE public.post_category AS ENUM ('scholarship', 'internship', 'event', 'general');

-- Create thought_posts table
CREATE TABLE public.thought_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.post_category NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.thought_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view posts" ON public.thought_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own posts" ON public.thought_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.thought_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.thought_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

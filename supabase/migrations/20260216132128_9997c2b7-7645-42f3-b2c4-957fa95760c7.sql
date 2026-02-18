
-- Add last_activity column to groups
ALTER TABLE public.groups ADD COLUMN last_activity timestamp with time zone DEFAULT now();

-- Update existing groups with their latest message timestamp
UPDATE public.groups g
SET last_activity = COALESCE(
  (SELECT MAX(created_at) FROM public.messages m WHERE m.group_id = g.id),
  g.created_at
);

-- Create trigger function to update last_activity on new group message
CREATE OR REPLACE FUNCTION public.update_group_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    UPDATE public.groups SET last_activity = NEW.created_at WHERE id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_update_group_last_activity
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_group_last_activity();

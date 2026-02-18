
-- Create call_sessions table
CREATE TABLE public.call_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'ended')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Caller or receiver can view their own call sessions
CREATE POLICY "Users can view own call sessions"
  ON public.call_sessions FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Only caller can initiate a call
CREATE POLICY "Users can create call sessions"
  ON public.call_sessions FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

-- Either party can update status (accept/end)
CREATE POLICY "Participants can update call status"
  ON public.call_sessions FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Either party can delete
CREATE POLICY "Participants can delete call sessions"
  ON public.call_sessions FOR DELETE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;


-- Allow all authenticated users to view any profile (needed for member lists, video calls, messaging)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (true);

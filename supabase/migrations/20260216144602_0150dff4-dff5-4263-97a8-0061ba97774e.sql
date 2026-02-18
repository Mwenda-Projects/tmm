
-- Seed academic majors
INSERT INTO public.majors (name) VALUES
  ('Engineering'),
  ('Mathematics'),
  ('Finance'),
  ('Computing / IT'),
  ('Sciences');

-- Create a default discussion group for each major
INSERT INTO public.groups (name, major_id)
SELECT m.name || ' Discussion', m.id
FROM public.majors m;

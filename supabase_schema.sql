-- 1. Alter public.profiles table
-- Drop existing check constraint and add updated one
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'client'::text, 'developer'::text]));

-- Add full_name, email, and hourly_rate columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0;

-- 2. Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending_estimation' CHECK (status = ANY (ARRAY['pending_estimation', 'estimated', 'active', 'completed'])),
  estimated_hours numeric DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo' CHECK (status = ANY (ARRAY['todo', 'in_progress', 'completed'])),
  assigned_developer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  logged_hours numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create time_logs table
CREATE TABLE IF NOT EXISTS public.time_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  developer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  hours numeric NOT NULL CHECK (hours > 0),
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create token_logs table
CREATE TABLE IF NOT EXISTS public.token_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  prompt_tokens integer NOT NULL,
  completion_tokens integer NOT NULL,
  cost_inr numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  stripe_session_id text,
  status text DEFAULT 'unpaid' CHECK (status = ANY (ARRAY['unpaid', 'paid'])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 8. Define RLS Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profiles" ON public.profiles;
CREATE POLICY "Allow users to update their own profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Projects Policies
DROP POLICY IF EXISTS "Clients can see their own projects" ON public.projects;
CREATE POLICY "Clients can see their own projects" ON public.projects
  FOR SELECT TO authenticated USING (
    client_id = auth.uid() OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer' OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Clients can insert projects" ON public.projects;
CREATE POLICY "Clients can insert projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Authorized users can update projects" ON public.projects;
CREATE POLICY "Authorized users can update projects" ON public.projects
  FOR UPDATE TO authenticated USING (
    client_id = auth.uid() OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer' OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Tasks Policies
DROP POLICY IF EXISTS "Access to tasks" ON public.tasks;
CREATE POLICY "Access to tasks" ON public.tasks
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND (
        client_id = auth.uid() OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer' OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      )
    )
  );

-- Time Logs Policies
DROP POLICY IF EXISTS "Access to time logs" ON public.time_logs;
CREATE POLICY "Access to time logs" ON public.time_logs
  FOR ALL TO authenticated USING (
    developer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_id AND p.client_id = auth.uid()
    ) OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Token Logs Policies
DROP POLICY IF EXISTS "Access to token logs" ON public.token_logs;
CREATE POLICY "Access to token logs" ON public.token_logs
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND (client_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer')
    ) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Invoices Policies
DROP POLICY IF EXISTS "Access to invoices" ON public.invoices;
CREATE POLICY "Access to invoices" ON public.invoices
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND client_id = auth.uid()
    ) OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer' OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 9. Trigger for Automatically Creating Profile on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, hourly_rate)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Client User'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    CASE WHEN COALESCE(new.raw_user_meta_data->>'role', 'client') = 'developer' THEN 500 ELSE 0 END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

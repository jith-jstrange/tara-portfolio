-- Strange Labs Database Seed Script

-- 1. Ensure Developer Jithin is set up correctly in public.profiles
INSERT INTO public.profiles (id, email, role, full_name, hourly_rate)
VALUES (
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  'jithinuthram@gmail.com',
  'developer',
  'Jithin J Strange',
  1200
)
ON CONFLICT (id) DO UPDATE
SET 
  email = 'jithinuthram@gmail.com',
  role = 'developer',
  full_name = 'Jithin J Strange',
  hourly_rate = 1200;

-- 2. Ensure Client Suresh is set up correctly in public.profiles
INSERT INTO public.profiles (id, email, role, full_name, hourly_rate)
VALUES (
  '39065414-7daf-4905-b69a-dd65a9642255',
  'suresh@gmail.com',
  'client',
  'Suresh Kumar',
  0
)
ON CONFLICT (id) DO UPDATE
SET 
  email = 'suresh@gmail.com',
  role = 'client',
  full_name = 'Suresh Kumar';

-- Clean existing data for clean seed (Cascade deletes will clean tasks/time_logs/invoices)
DELETE FROM public.projects WHERE client_id = '39065414-7daf-4905-b69a-dd65a9642255';

-- 3. Create Project #1: Strange Labs SaaS Platform (Active Project)
INSERT INTO public.projects (id, title, description, client_id, status, estimated_hours_min, estimated_hours_max, estimated_cost_min, estimated_cost_max, client_budget, budget_outlook, created_at)
VALUES (
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  'Strange Labs SaaS Platform',
  'Build a complete freelance marketplace called Strange Labs where clients submit project descriptions, get AI estimates, pay invoices with Stripe, and developers claim tasks and log hours.\n\n=== AI Project Scope ===\nThis is a complete full-stack Next.js project with Supabase Auth, PostgreSQL tables, Stripe API integration, and Gemini AI. Requires high-fidelity glassmorphic UX.',
  '39065414-7daf-4905-b69a-dd65a9642255',
  'active',
  30,
  50,
  25000,
  45000,
  35000,
  'Your budget of ₹35,000 is sufficient for our senior developer group to build the complete SaaS website interface, database tables, and the timer stopwatch widgets. This includes testing and basic styling.',
  NOW() - INTERVAL '7 days'
);

-- 4. Create Project #2: E-Commerce Brochure Website (Estimated Project)
INSERT INTO public.projects (id, title, description, client_id, status, estimated_hours_min, estimated_hours_max, estimated_cost_min, estimated_cost_max, client_budget, budget_outlook, created_at)
VALUES (
  'cf8f10a8-b631-4a4c-8ea4-68f498c48a73',
  'E-Commerce Pottery App',
  'Need a beautiful online storefront to list our handmade clay pottery products. Must be mobile responsive and have a clean design.\n\n=== AI Project Scope ===\nResponsive catalogs, categories filter, search widgets, shopping carts, and contact inquiries systems.',
  '39065414-7daf-4905-b69a-dd65a9642255',
  'estimated',
  15,
  25,
  12000,
  20000,
  15000,
  'With your budget of ₹15,000, we can fully build the landing page, products catalog, and the checkout system. We recommend starting with a simple catalog first.',
  NOW() - INTERVAL '2 days'
);

-- 5. Tasks for Project #1 (Strange Labs SaaS Platform)
-- Task 1: Completed
INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  'Design Glassmorphic UI/UX Components',
  'Set up the base layout, globals CSS variables, sidebar navigation, and glassmorphic card overlays.',
  'completed',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  12,
  NOW() - INTERVAL '6 days'
);

-- Task 2: Completed
INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  'Configure Supabase Relational Database Schemas',
  'Write migration SQL files, enable Row Level Security, write trigger routines, and set access control policies.',
  'completed',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  8,
  NOW() - INTERVAL '4 days'
);

-- Task 3: In Progress
INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  'Implement Secure Stripe Payment Checkout API',
  'Write back-end server checkout handlers, Stripe webhooks event listeners, and client pay redirects.',
  'in_progress',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  4,
  NOW() - INTERVAL '2 days'
);

-- Task 4: To Do
INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  'Build Observability Token Observability Board',
  'Aggregate prompt logs, completion sizes, and platform markups into an interactive charts view.',
  'todo',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  0,
  NOW() - INTERVAL '1 day'
);

-- Task 5: To Do & UNASSIGNED (Ready to claim!)
INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  'Set up Real-time SMS/Email Notifications',
  'Configure Resend API endpoints to dispatch client alerts when invoices are created or paid.',
  'todo',
  null,
  0,
  NOW() - INTERVAL '1 day'
);


-- 6. Tasks for Project #2 (E-Commerce Pottery App - Unassigned Tasks)
INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  'cf8f10a8-b631-4a4c-8ea4-68f498c48a73',
  'Design clay pottery product catalog page',
  'Build pottery listing grid, grid animations, details overlays, and category filters.',
  'todo',
  null,
  0,
  NOW() - INTERVAL '1 day'
);

INSERT INTO public.tasks (id, project_id, title, description, status, assigned_developer_id, logged_hours, created_at)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  'cf8f10a8-b631-4a4c-8ea4-68f498c48a73',
  'Configure products database tables',
  'Create products schema in Supabase with product name, price, description, and pottery image URL columns.',
  'todo',
  null,
  0,
  NOW() - INTERVAL '1 day'
);


-- 7. Time Logs for Developer Jithin
-- Log 1: UI components
INSERT INTO public.time_logs (id, task_id, developer_id, hours, description, created_at)
VALUES (
  'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
  '11111111-1111-1111-1111-111111111111',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  8,
  'Timer session: Design system master configuration and globals CSS variables setup.',
  NOW() - INTERVAL '5 days'
);

-- Log 2: UI components
INSERT INTO public.time_logs (id, task_id, developer_id, hours, description, created_at)
VALUES (
  'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
  '11111111-1111-1111-1111-111111111111',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  4,
  'Timer session: Responsive sidebar layouts and glassmorphic dashboards.',
  NOW() - INTERVAL '4 days'
);

-- Log 3: Database config
INSERT INTO public.time_logs (id, task_id, developer_id, hours, description, created_at)
VALUES (
  'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
  '22222222-2222-2222-2222-222222222222',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  8,
  'Timer session: Writing schema migrations and setting up Row Level Security policies.',
  NOW() - INTERVAL '3 days'
);

-- Log 4: Stripe checkout
INSERT INTO public.time_logs (id, task_id, developer_id, hours, description, created_at)
VALUES (
  'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4',
  '33333333-3333-3333-3333-333333333333',
  '79e415be-3f7a-4cd3-b0b5-85fffcf8c9ea',
  4,
  'Timer session: Wiring Stripe webhook checkout routers.',
  NOW() - INTERVAL '2 days'
);


-- 8. Invoices for Project #1 (SaaS Platform)
-- Paid Deposit Invoice
INSERT INTO public.invoices (id, project_id, amount, stripe_session_id, status, created_at)
VALUES (
  'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  25000,
  'cs_test_paid_deposit_12345',
  'paid',
  NOW() - INTERVAL '6 days'
);

-- Unpaid Milestone Invoice (Ready for testing Stripe payment!)
INSERT INTO public.invoices (id, project_id, amount, stripe_session_id, status, created_at)
VALUES (
  'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
  'a2b1b590-7d72-4d2c-8067-9359e13d98c4',
  12000,
  null,
  'unpaid',
  NOW() - INTERVAL '1 day'
);

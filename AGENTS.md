# Zam Lodge Manager

Multi-tenant SaaS lodge management system for Zambian lodges, guest houses, and small hotels.

## Tech Stack

- Frontend: React 19, TanStack Router, Vite, Tailwind CSS 4
- Backend: Supabase (Auth, Database, Edge Functions, Storage)
- UI: shadcn/ui components

## Development

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run typecheck` - Type checking

## Environment Variables

Required in `.env`:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_PLATFORM_ADMIN_EMAIL` - Platform admin email

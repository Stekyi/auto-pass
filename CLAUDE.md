@AGENTS.md

# AutoPass

Vehicle service history & mechanic management SaaS for Ghana.

## Stack
- Next.js 16 (App Router) on Vercel
- Neon PostgreSQL + Drizzle ORM
- Cloudflare R2 for photo/audio storage
- NextAuth v5 for staff login
- Tailwind CSS

## Key conventions
- Multi-tenant: every table scoped by `mechanicId` (tenant)
- Mechanics must be active + debt-free to log repairs
- Annual subscription (100 GHC/year)
- Mobile-first UI — large touch targets
- Voice notes stored as audio files in R2, not transcribed
- Read node_modules/next/dist/docs/ before writing Next.js code

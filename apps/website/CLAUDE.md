# Payproof Website

> Landing page and whitepaper for payproof.so

## What This Is

Static marketing website for Payproof - the atomic data-for-payment protocol for AI agent commerce. Built with Next.js 16, Tailwind CSS v4, Framer Motion. Deploys to Hostinger via GitHub Actions FTP.

## Commands

```bash
pnpm dev          # Dev server on localhost:3001
pnpm build        # Static export to out/
pnpm lint         # ESLint
```

## Architecture

- **Static export** (`output: 'export'`) - no API routes, no server logic
- **Two routes**: `/` (landing page), `/whitepaper` (technical spec)
- **Notify form**: Supabase insert (browser-side, needs env vars)

## Design System

- **Fonts**: Instrument Serif (headings), DM Sans (body), Geist Mono (code/ASCII)
- **Palette**: Cream background (#FAF8F5), protocol colors - agent (indigo), merchant (orange), chain (sky), payment (emerald), crypto (violet), problem (red)
- **Animations**: Framer Motion, floating gradient orbs, scroll-triggered reveals, ASCII character reveals

## Key Patterns

- `SectionWrapper` - wraps every section with scroll-triggered fade-in
- `GradientOrbs` - floating colored background orbs per section
- `CodeBlock` - dark-themed code display with syntax highlighting
- `Badge` - status badges (Live, Coming Soon, etc.)
- All section components are client components (`"use client"`)
- Footer is a server component

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...        # For notify form
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # For notify form
```

## Deployment

Static files deployed to Hostinger (payproof.so) via GitHub Actions FTP.
See `.github/workflows/deploy-website.yml`.

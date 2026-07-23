# Changelog

Running log of bugs encountered during development and how they were fixed.
Append-only, terse, dated. Architecture/product decisions live in
`info/DECISIONS.md` instead — this file is debugging history only.

## 2026-07-09

- **`npx ts-node supabase/seed.ts` failed with an ESM/CommonJS detection error.** → Root tsconfig targets `esnext` for Next.js, which made `ts-node` misdetect the seed script as an ES module when run directly. → Added `supabase/tsconfig.seed.json` forcing `commonjs`, run via `npm run seed` with `--project`.
- **Seed script env vars weren't loading (`Missing NEXT_PUBLIC_SUPABASE_URL`).** → `dotenv/config` only auto-loads `.env`, not `.env.local`. → Switched to `config({ path: '.env.local' })` explicitly in `supabase/seed.ts`.
- **Seed script crashed with `__dirname is not defined in ES module scope`.** → Same ESM detection issue reaching the file-path resolution code. → Replaced `__dirname` with `process.cwd()`-relative paths.
- **`npm run seed` failed with a JSON parse error from ts-node's arg parser.** → npm strips/mangles quotes when passing inline `--compiler-options '{"module":"commonjs"}'` through a package.json script. → Moved the override into `supabase/tsconfig.seed.json` and referenced it via `--project` instead of inline JSON.
- **`npm run build` failed with `Missing API key. Pass it to the constructor new Resend("re_123")`.** → `lib/resend.ts` instantiated `new Resend(...)` at module load time, which throws during build/prerender if `RESEND_API_KEY` isn't set yet (it wasn't, at that point). → Moved the `Resend` instantiation inside `sendWaitlistConfirmation()` so it's only constructed at request time.
- **Waitlist confirmation emails not sending (403 from Resend).** → `lib/resend.ts`'s `from` address (`hello@zunio.app`) is not a verified sending domain in Resend yet. → Not yet fixed — real domain still needs to be purchased and verified at resend.com/domains before launch (tracked as BUILDORDER item 0.9b/0.10 blocker). Confirmed the send pipeline itself works correctly via Resend's sandbox sender (`onboarding@resend.dev`).
- **Selecting a school in the combobox fired a wasted extra Supabase search.** → `components/ui/SchoolCombobox.tsx`'s debounce `useEffect` re-ran whenever `query` changed, including the change triggered by `selectSchool()` setting `query` to the formatted label — searching for a full "School Name — City, State" string that never matches anything. → Added a `skipNextSearch` ref that `selectSchool()` sets before updating `query`, so the effect skips that one re-run.

export const siteConfig = {
  name: 'Zunio',
  description:
    'Buy and sell with verified students at your school. Campus pickup, no strangers, no scams.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  // Where "Report this listing" goes. Moderation is manual at MVP (CLAUDE.md):
  // a report email, then an admin flips listings.status/users.is_suspended in
  // the Supabase dashboard. Must be a real, monitored inbox before launch.
  moderationEmail: 'moderation@zunio.org',
} as const

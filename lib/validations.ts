import { z } from 'zod'

export const waitlistSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    school_id: z.string().uuid().nullable().optional(),
    school_name_raw: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .refine((data) => Boolean(data.school_id) || Boolean(data.school_name_raw), {
    message: 'Either school_id or school_name_raw is required',
    path: ['school_id'],
  })

export type WaitlistInput = z.infer<typeof waitlistSchema>

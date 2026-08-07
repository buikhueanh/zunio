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

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  display_name: z.string().trim().min(2).max(40),
  // References schools_directory, not schools — any school can sign up,
  // not just launched ones. See DECISIONS.md.
  school_directory_id: z.string().uuid(),
})

export type SignUpInput = z.infer<typeof signUpSchema>

export const addSchoolEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export type AddSchoolEmailInput = z.infer<typeof addSchoolEmailSchema>

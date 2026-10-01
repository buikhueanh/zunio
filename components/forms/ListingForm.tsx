'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getActiveSchools, type SchoolDirectoryResult } from '@/lib/schools'
import { uploadListingImage, listingImageUrl } from '@/lib/images'
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  MAX_LISTING_IMAGES,
  FREE_CATEGORY,
} from '@/lib/validations'

const CATEGORY_LABELS: Record<string, string> = {
  electronics: 'Electronics',
  furniture: 'Furniture',
  clothing: 'Clothing',
  textbooks: 'Textbooks',
  appliances: 'Appliances',
  bikes: 'Bikes',
  free: 'Free',
  other: 'Other',
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  used: 'Used',
  for_parts: 'For Parts',
}

type SubmitState = 'idle' | 'submitting' | 'error'

export default function ListingForm({ defaultSchoolId }: { defaultSchoolId: string | null }) {
  const router = useRouter()
  const [schools, setSchools] = useState<SchoolDirectoryResult[]>([])
  const [schoolId, setSchoolId] = useState(defaultSchoolId ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [pickupHint, setPickupHint] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [aupAccepted, setAupAccepted] = useState(false)
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Only launched schools can receive listings — posting into an unlaunched
  // campus would put the item in a feed nobody browses.
  useEffect(() => {
    getActiveSchools().then((active) => {
      setSchools(active)
      // If the seller's own school hasn't launched, fall back to the first
      // active one rather than leaving an unusable empty selection.
      setSchoolId((current) =>
        active.some((s) => s.id === current) ? current : active[0]?.id ?? ''
      )
    })
  }, [])

  // Picking the "Free" category IS a giveaway claim, so it forces the free
  // state rather than allowing a price alongside it. The API applies the same
  // rule (listingSchema's transform); this just makes it visible instead of
  // silently discarding a price the seller typed.
  const isFreeCategory = category === FREE_CATEGORY
  const givingAway = isFree || isFreeCategory

  const parsedPrice = Number(price)
  const priceValid =
    givingAway || (price.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice > 0)

  const canSubmit =
    title.trim().length >= 3 &&
    description.trim().length >= 1 &&
    category !== '' &&
    schoolId !== '' &&
    priceValid &&
    aupAccepted &&
    !uploading &&
    state !== 'submitting'

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const remaining = MAX_LISTING_IMAGES - images.length
    if (remaining <= 0) return

    setUploading(true)
    setUploadError('')
    try {
      const uploaded: string[] = []
      for (const file of files.slice(0, remaining)) {
        uploaded.push(await uploadListingImage(file))
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload photo')
    } finally {
      setUploading(false)
    }
  }

  function removeImage(path: string) {
    setImages((prev) => prev.filter((p) => p !== path))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setState('submitting')
    setErrorMessage('')

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_id: schoolId,
        title: title.trim(),
        description: description.trim(),
        price: givingAway ? null : Number(price),
        category,
        condition: condition || null,
        pickup_hint: pickupHint.trim() || null,
        images,
        aup_accepted: aupAccepted,
      }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setErrorMessage(payload.error ?? 'Could not create listing')
      setState('error')
      return
    }

    const { id } = await res.json()
    router.push(`/listings/${id}`)
    router.refresh()
  }

  const fieldClass =
    'w-full rounded-md border border-brand-gray-200 bg-brand-white px-4 py-3 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light'
  const labelClass = 'text-sm font-semibold text-brand-dark-brown'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="school" className={labelClass}>
          Sell at
        </label>
        <select
          id="school"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className={fieldClass}
        >
          {schools.length === 0 && <option value="">Loading campuses...</option>}
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {[s.name, s.campus, s.city].filter(Boolean).join(' — ')}
            </option>
          ))}
        </select>
        <p className="text-xs text-brand-gray-400">
          Which campus sees this listing. Pick where you can actually meet up to hand the
          item over — it doesn&apos;t have to be your own school.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. IKEA desk lamp"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Condition, why you're selling, anything a buyer should know."
          className={fieldClass}
        />
        <p className="text-xs text-brand-gray-400">{description.length}/2000</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Price</span>
        <label className="flex items-center gap-2 text-sm text-brand-gray-600">
          <input
            type="checkbox"
            checked={givingAway}
            disabled={isFreeCategory}
            onChange={(e) => setIsFree(e.target.checked)}
            className="h-4 w-4 accent-brand-emerald disabled:opacity-60"
          />
          Give it away for free
        </label>
        {isFreeCategory && (
          <p className="text-xs text-brand-gray-400">
            The Free category is always a giveaway, so this listing has no price.
            Pick a different category if you want to charge for it.
          </p>
        )}
        {!givingAway && (
          <>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className={fieldClass}
            />
            {/* Nudges sellers to the checkbox before they type 0 and hit the
                "Use free instead of a price of 0" rejection. The schema stores
                free as NULL price and forbids 0 outright, so this is the only
                way to list a giveaway. */}
            <p className="text-xs text-brand-gray-400">
              Giving it away? Tick &ldquo;Give it away for free&rdquo; above rather than
              entering 0 — free items show as &ldquo;Free&rdquo; and appear in the free
              filter.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="category" className={labelClass}>
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={fieldClass}
        >
          <option value="">Choose a category</option>
          {LISTING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="condition" className={labelClass}>
          Condition <span className="font-normal text-brand-gray-400">(optional)</span>
        </label>
        <select
          id="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className={fieldClass}
        >
          <option value="">Not specified</option>
          {LISTING_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>
          Photos <span className="font-normal text-brand-gray-400">(up to {MAX_LISTING_IMAGES})</span>
        </label>
        <p className="text-xs text-brand-gray-400">
          First photo will be your cover image. Location data is removed automatically.
        </p>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((path, index) => (
              <div key={path} className="relative h-24 w-24 overflow-hidden rounded-md border border-brand-gray-200">
                <Image src={listingImageUrl(path)} alt="" fill className="object-cover" />
                {index === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-brand-emerald/90 py-0.5 text-center text-[10px] font-semibold text-brand-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(path)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-dark-brown/80 text-xs text-brand-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {images.length < MAX_LISTING_IMAGES && (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFiles}
            disabled={uploading}
            className="text-sm text-brand-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-emerald-light file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-emerald"
          />
        )}
        {uploading && <p className="text-xs text-brand-gray-500">Uploading photo...</p>}
        {uploadError && <p className="text-xs font-medium text-red-600">{uploadError}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pickup" className={labelClass}>
          Pickup hint <span className="font-normal text-brand-gray-400">(optional)</span>
        </label>
        <input
          id="pickup"
          type="text"
          value={pickupHint}
          onChange={(e) => setPickupHint(e.target.value)}
          maxLength={100}
          placeholder="e.g. Near the Snell library entrance"
          className={fieldClass}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-brand-gray-600">
        <input
          type="checkbox"
          checked={aupAccepted}
          onChange={(e) => setAupAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-emerald"
        />
        <span>
          I confirm this listing follows the{' '}
          <a href="/aup" target="_blank" className="font-medium text-brand-blue hover:underline">
            Acceptable Use Policy
          </a>{' '}
          — no weapons, drugs, alcohol, counterfeit goods, or adult content.
        </span>
      </label>

      {errorMessage && <p className="text-sm font-medium text-red-600">{errorMessage}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-md bg-brand-emerald px-6 py-4 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'submitting' ? 'Posting...' : 'Post listing'}
      </button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { listingImageUrl } from '@/lib/images'

export default function ListingGallery({
  images,
  title,
}: {
  images: string[]
  title: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-brand-gray-100 text-sm text-brand-gray-400">
        No photo
      </div>
    )
  }

  const active = images[Math.min(activeIndex, images.length - 1)]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-gray-100">
        <Image
          src={listingImageUrl(active)}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((path, index) => (
            <button
              key={path}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View photo ${index + 1} of ${images.length}`}
              aria-current={index === activeIndex}
              className={`relative h-16 w-16 overflow-hidden rounded-md border-2 transition ${
                index === activeIndex ? 'border-brand-emerald' : 'border-transparent'
              }`}
            >
              <Image
                src={listingImageUrl(path)}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

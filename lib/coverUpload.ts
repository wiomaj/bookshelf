/**
 * Utilities for uploading user-captured cover photos to Supabase Storage.
 *
 * Requires a public "covers" bucket in your Supabase project:
 *   Dashboard → Storage → New bucket → Name: "covers" → Public: yes
 */

import { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'covers'
const MAX_PX = 900          // max width or height after compression
const QUALITY = 0.88        // JPEG quality
const MAX_INPUT_BYTES = 15 * 1024 * 1024  // 15 MB pre-compression limit
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/**
 * Compress an image File to a JPEG Blob at MAX_PX × MAX_PX max resolution.
 * Runs entirely in the browser using an offscreen Canvas.
 */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width > MAX_PX || height > MAX_PX) {
        if (width >= height) {
          height = Math.round((height * MAX_PX) / width)
          width = MAX_PX
        } else {
          width = Math.round((width * MAX_PX) / height)
          height = MAX_PX
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image failed to load'))
    }

    img.src = objectUrl
  })
}

/**
 * Compress and upload a cover photo to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadCoverPhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, or GIF images are supported.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image must be smaller than 15 MB.')
  }

  const compressed = await compressImage(file)
  const path = `${userId}/${Date.now()}.jpg`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

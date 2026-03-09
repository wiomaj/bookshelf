'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WishlistAddPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/add?tab=wishlist') }, [router])
  return null
}

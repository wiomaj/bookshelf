'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ToReadAddPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/add?tab=to_read') }, [router])
  return null
}

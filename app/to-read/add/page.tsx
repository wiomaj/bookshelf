'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import ToReadForm, { type ToReadFormData } from '@/components/ToReadForm'
import { addBook, updateBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import { fetchCoverByTitleAuthor } from '@/lib/bookMetadata'

export default function ToReadAddPage() {
  const router = useRouter()
  const { user } = useApp()
  const t = useT()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(data: ToReadFormData) {
    if (!user) return
    setLoading(true)
    try {
      const saved = await addBook(supabase, user.id, {
        title: data.title,
        author: data.author,
        cover_url: data.cover_url,
        status: 'to_read',
        year: data.year,
        month: data.month,
        rating: 0,
      })

      // If the book was saved without a cover, search for one automatically
      if (!data.cover_url && data.title) {
        try {
          const cover = await fetchCoverByTitleAuthor(data.title, data.author ?? '')
          if (cover) await updateBook(supabase, saved.id, { cover_url: cover })
        } catch {
          // Cover search failed — proceed without cover
        }
      }

      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between h-[60px] px-4">
        <div /> {/* spacer */}
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center"
          style={{ color: 'var(--label)' }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Page title */}
      <div className="px-4 pb-5">
        <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: 'var(--label)' }}>
          {t.addToReadingList}
        </h1>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <ToReadForm
          onSubmit={handleSubmit}
          loading={loading}
          submitLabel={t.addToReadingList}
        />
      </motion.div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { addBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import BookForm from '@/components/BookForm'
import { useApp, useT } from '@/contexts/AppContext'
import type { Book } from '@/types/book'

export default function AddBookPage() {
  const router = useRouter()
  const { user } = useApp()
  const t = useT()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(data: Omit<Book, 'id' | 'user_id' | 'created_at'>) {
    if (!user) return
    setLoading(true)
    try {
      await addBook(supabase, user.id, data)
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
          {t.addABook}
        </h1>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <BookForm
          onSubmit={handleSubmit}
          submitLabel={t.addBook}
          loading={loading}
        />
      </motion.div>
    </div>
  )
}

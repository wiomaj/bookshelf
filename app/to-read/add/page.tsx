'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import ToReadForm, { type ToReadFormData } from '@/components/ToReadForm'
import { addBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'

export default function ToReadAddPage() {
  const router = useRouter()
  const { user } = useApp()
  const t = useT()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(data: ToReadFormData) {
    if (!user) return
    setLoading(true)
    try {
      await addBook(supabase, user.id, {
        title: data.title,
        author: data.author,
        cover_url: data.cover_url,
        status: 'to_read',
        year: data.year,
        month: data.month,
        rating: 0,
      })
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">

      {/* Header — X close button on the right */}
      <div className="flex items-center justify-end h-[60px] px-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center text-[#171717]"
        >
          <X size={24} />
        </button>
      </div>

      {/* Page title */}
      <div className="px-4 pb-6">
        <h1 className="text-[#171717] text-[32px] font-black leading-8">
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

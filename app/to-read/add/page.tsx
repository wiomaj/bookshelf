'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import ToReadForm, { type ToReadFormData } from '@/components/ToReadForm'
import { addBook } from '@/lib/bookApi'
import { supabase } from '@/lib/supabase'
import { useApp, useT } from '@/contexts/AppContext'
import { useState } from 'react'

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
        notes: data.notes,
        cover_url: data.cover_url,
        status: 'to_read',
        year: 0,
        month: null,
        rating: 0,
      })
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(23,23,23,0.06)]"
        >
          <ArrowLeft size={20} className="text-[#171717]" />
        </motion.button>
        <h1 className="text-[#171717] text-[20px] font-black leading-6">
          {t.addToReadingList}
        </h1>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <ToReadForm
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel={t.addToReadingList}
      />
    </div>
  )
}

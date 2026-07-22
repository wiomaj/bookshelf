/**
 * app/api/friends/add/route.ts
 *
 * POST /api/friends/add  { email }
 *
 * Adding a friend by email needs a privileged lookup (the client can't query
 * other users' profiles until a friendship already exists), so this route
 * runs server-side with the service-role key: verify the caller's session,
 * resolve the target profile by email, create the one-directional friendship,
 * and drop a one-time "X added you" notification for the target.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const admin = adminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server is not configured for this action.' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  const me = userData.user

  const body = await req.json().catch(() => null)
  const email = (body?.email ?? '').toString().trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  if (email === (me.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'You cannot add yourself.' }, { status: 400 })
  }

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, email, display_name')
    .ilike('email', email)
    .maybeSingle()

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ error: 'No user found with that email.' }, { status: 404 })
  }

  const { data: existing } = await admin
    .from('friendships')
    .select('id')
    .eq('owner_id', me.id)
    .eq('friend_id', target.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already added this friend.' }, { status: 409 })
  }

  const { error: insertError } = await admin
    .from('friendships')
    .insert({ owner_id: me.id, friend_id: target.id })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const myName = me.user_metadata?.display_name || me.email
  await admin.from('notifications').insert({
    user_id: target.id,
    type: 'friend_added',
    payload: { addedByName: myName, addedById: me.id },
  })

  return NextResponse.json({ friend: target })
}

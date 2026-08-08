import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      const redirectTo = request.nextUrl.clone()
      redirectTo.pathname = type === 'recovery' ? '/auth/reset-password' : '/dashboard'
      redirectTo.search = ''
      return NextResponse.redirect(redirectTo)
    }
  }

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = '/'
  redirectTo.search = ''
  return NextResponse.redirect(redirectTo)
}

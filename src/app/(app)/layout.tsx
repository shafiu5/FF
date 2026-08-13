import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import Logo from '@/components/Logo'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return (
    <div className="min-h-screen flex flex-col">
      <Logo />
      <div className="flex-1 pb-16">{children}</div>
      <Nav />
    </div>
  )
}

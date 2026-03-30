'use server'

import { createClient } from '@/lib/supabase/server'

export async function markWorkflowGuideSeen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({ workflow_guide_seen: true })
    .eq('id', user.id)
}

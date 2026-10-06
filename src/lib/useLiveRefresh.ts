'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearChannelState, setChannelState } from '@/lib/liveStatus'

let channelCounter = 0

// Calls `onChange` (debounced) whenever any of the given tables changes in
// the database — from this device or any other — so open pages stay current
// without a manual refresh. Also fires when the tab returns to the
// foreground or the connection is re-established, since phones suspend
// websockets while the screen is off and would otherwise miss events.
export function useLiveRefresh(tables: string[], onChange: () => void, delayMs = 800) {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const tablesKey = tables.join(',')

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const trigger = () => {
      clearTimeout(timer)
      timer = setTimeout(() => onChangeRef.current(), delayMs)
    }

    // Unique name per subscription so a remount never collides with a
    // channel that's still tearing down.
    const channelId = ++channelCounter
    let channel = supabase.channel(`live-refresh-${channelId}`)
    for (const table of tablesKey.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, trigger)
    }
    setChannelState(channelId, 'connecting')
    let subscribedBefore = false
    let disposed = false
    channel.subscribe((status) => {
      // removeChannel() below reports CLOSED; don't let that resurrect the
      // entry we just cleared.
      if (disposed) return
      if (status === 'SUBSCRIBED') {
        setChannelState(channelId, 'live')
        if (subscribedBefore) trigger()
        subscribedBefore = true
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setChannelState(channelId, 'offline')
      }
    })

    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      disposed = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      clearChannelState(channelId)
      supabase.removeChannel(channel)
    }
  }, [tablesKey, delayMs])
}

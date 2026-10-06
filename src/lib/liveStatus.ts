'use client'

import { useSyncExternalStore } from 'react'

// 'none' = no page on screen is watching for live changes, so there's
// nothing to report.
export type LiveState = 'none' | 'connecting' | 'live' | 'offline'

const channelStates = new Map<number, Exclude<LiveState, 'none'>>()
const listeners = new Set<() => void>()
let current: LiveState = 'none'

function recompute() {
  const values = [...channelStates.values()]
  const next: LiveState =
    values.length === 0
      ? 'none'
      : values.includes('live')
        ? 'live'
        : values.includes('connecting')
          ? 'connecting'
          : 'offline'
  if (next === current) return
  current = next
  listeners.forEach((l) => l())
}

export function setChannelState(id: number, state: Exclude<LiveState, 'none'>) {
  channelStates.set(id, state)
  recompute()
}

export function clearChannelState(id: number) {
  channelStates.delete(id)
  recompute()
}

export function useLiveState(): LiveState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => current,
    () => 'none'
  )
}

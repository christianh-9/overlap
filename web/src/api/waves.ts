import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Profile = components['schemas']['ProfileOut']
export type Connection = components['schemas']['ConnectionOut']

// The tab bar reads this too, for its count, so it can be switched off when
// the tabs aren't showing.
export function useReceivedWaves({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['waves', 'received'],
    queryFn: async () => unwrap(await api.GET('/waves/received')),
    enabled,
  })
}

export function useConnections() {
  return useQuery({
    queryKey: ['waves', 'connections'],
    queryFn: async () => unwrap(await api.GET('/waves/connections')),
  })
}

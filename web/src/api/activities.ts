import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Activity = components['schemas']['ActivityOut']

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => unwrap(await api.GET('/activities')),
  })
}

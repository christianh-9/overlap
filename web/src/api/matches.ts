import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Match = components['schemas']['MatchOut']

export function useMatches(weekday: number) {
  return useQuery({
    queryKey: ['matches', weekday],
    queryFn: async () => unwrap(await api.GET('/matches', { params: { query: { weekday } } })),
  })
}

import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'

// The term changes a few times a year, so there's no need to ask often.
export function useTerm() {
  return useQuery({
    queryKey: ['term'],
    queryFn: async () => unwrap(await api.GET('/term')),
    staleTime: 60 * 60 * 1000,
  })
}

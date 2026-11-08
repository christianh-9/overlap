import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => unwrap(await api.GET('/me')),
  })
}

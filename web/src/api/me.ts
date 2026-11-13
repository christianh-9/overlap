import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, clearToken } from './client'
import { unwrap } from './errors'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => unwrap(await api.GET('/me')),
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return (notice?: string) => {
    clearToken()
    queryClient.clear()
    navigate('/sign-in', { replace: true, state: notice ? { notice } : undefined })
  }
}

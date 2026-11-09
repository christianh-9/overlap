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

// Clears every cached query too, so nothing from this account shows if someone
// else signs in on the same device.
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // A notice, like "Your account was deleted.", rides along in router state for
  // sign-in to show once.
  return (notice?: string) => {
    clearToken()
    queryClient.clear()
    navigate('/sign-in', { replace: true, state: notice ? { notice } : undefined })
  }
}

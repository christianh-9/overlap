import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Course = components['schemas']['CourseOut']

export function useSchedule() {
  return useQuery({
    queryKey: ['schedule'],
    queryFn: async () => unwrap(await api.GET('/schedule')),
  })
}

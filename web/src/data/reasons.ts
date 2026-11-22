import type { components } from '../api/schema'

export type Reason = components['schemas']['ReportIn']['reason']

export const REASONS: [Reason, string][] = [
  ['harassment', 'Harassment'],
  ['spam', 'Spam'],
  ['fake_profile', 'Fake profile'],
  ['inappropriate', 'Inappropriate content'],
  ['other', 'Something else'],
]

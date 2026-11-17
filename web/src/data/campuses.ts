import type { components } from '../api/schema'
import { UCI_MAJORS, UCR_MAJORS } from './majors'

const CAMPUSES = {
  uci: {
    short: 'UCI',
    code: 'section code',
    codes: 'Section codes',
    scheduleUrl: 'https://www.reg.uci.edu/perl/WebSoc',
    majors: UCI_MAJORS,
  },
  ucr: {
    short: 'UCR',
    code: 'CRN',
    codes: 'CRNs',
    scheduleUrl:
      'https://registrationssb.ucr.edu/StudentRegistrationSsb/ssb/term/termSelection?mode=search',
    majors: UCR_MAJORS,
  },
}

export function campusInfo(campus: components['schemas']['CampusOut']) {
  return CAMPUSES[campus.slug as keyof typeof CAMPUSES]
}

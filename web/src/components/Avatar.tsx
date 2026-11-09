import { initials } from '../lib/initials'

// Four hues checked so every pair stays distinct for full color vision, each
// dark enough to keep the initials at 4.5:1 or better. None is yellow, which
// stays reserved for shared time. Color only adds variety: the initials and
// the name beside the circle identify the person.
const COLORS = ['#2F6DB5', '#B4532A', '#1B7A4F', '#8E3F7C']

const SIZES = {
  sm: 'size-6 text-[10px]',
  md: 'size-10 text-sm',
}

export default function Avatar({
  id,
  name,
  size = 'md',
}: {
  id: number
  name: string
  size?: keyof typeof SIZES
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-bold text-chalk ${SIZES[size]}`}
      // Picked from the user id, so the same person gets the same color everywhere.
      style={{ backgroundColor: COLORS[id % COLORS.length] }}
    >
      {initials(name)}
    </span>
  )
}

import { initials } from '../lib/initials'

// no yellow, that's for shared time
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
      style={{ backgroundColor: COLORS[id % COLORS.length] }}
    >
      {initials(name)}
    </span>
  )
}

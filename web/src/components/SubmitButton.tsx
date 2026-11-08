export default function SubmitButton({
  pending,
  children,
  className = 'mt-2',
}: {
  pending: boolean
  children: string
  className?: string
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-12 rounded-card bg-ink px-6 font-bold text-chalk transition-opacity disabled:opacity-60 ${className}`}
    >
      {pending ? 'One moment...' : children}
    </button>
  )
}

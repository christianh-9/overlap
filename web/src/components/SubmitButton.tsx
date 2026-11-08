export default function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-12 rounded-card bg-ink px-6 font-bold text-chalk transition-opacity disabled:opacity-60"
    >
      {pending ? 'One moment...' : children}
    </button>
  )
}

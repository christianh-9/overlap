const FALLBACK: Record<number, string> = {
  400: "That didn't work. Check what you entered and try again.",
  403: "You don't have access to this.",
  404: "We couldn't find that. It may have been removed.",
  409: 'That was just taken by someone else.',
  422: 'Check what you entered and try again.',
  429: 'Too many tries. Wait a few minutes and try again.',
  502: "A service we rely on didn't respond. Try again shortly.",
}

export class ApiError extends Error {
  status: number
  field?: string

  constructor(status: number, body: unknown) {
    const detail = (body as { detail?: unknown } | undefined)?.detail
    let message = FALLBACK[status] ?? 'Something went wrong on our end. Try again.'
    let field: string | undefined

    // The backend writes its own error text for people to read, so prefer it.
    // Validation errors are the exception: Pydantic's wording is technical,
    // so name the field instead.
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail) && detail.length > 0) {
      const loc: unknown[] = detail[0].loc ?? []
      field = String(loc[loc.length - 1])
      message = `Check the ${field.replaceAll('_', ' ')} and try again.`
    }

    super(message)
    this.status = status
    this.field = field
  }
}

export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) throw new ApiError(result.response.status, result.error)
  return result.data as T
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return "Can't reach Overlap. Check your connection and try again."
}

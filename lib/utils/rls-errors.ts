/**
 * Utility to convert PostgreSQL RLS policy violations into user-friendly error messages
 */
export function handleRLSError(error: any): string {
  if (!error) return 'An unexpected error occurred'

  const errorMessage = error.message || ''
  const errorCode = error.code || ''

  // RLS policy violation
  if (errorCode === '42501' || errorMessage.includes('policy')) {
    return 'You do not have permission to perform this action'
  }

  // Foreign key violation
  if (errorCode === '23503') {
    return 'This operation would violate data relationships'
  }

  // Unique constraint violation
  if (errorCode === '23505') {
    return 'This record already exists'
  }

  // Not null violation
  if (errorCode === '23502') {
    return 'Required field is missing'
  }

  // Check constraint violation
  if (errorCode === '23514') {
    return 'Data validation failed'
  }

  // Generic fallback
  return error.message || 'An unexpected error occurred'
}

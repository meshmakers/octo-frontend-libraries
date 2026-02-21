/**
 * Transforms known backend error messages into user-friendly messages.
 * Returns null if the error message is not recognized and should be displayed as-is.
 */
export function transformErrorMessage(message: string): { userMessage: string; technicalDetails: string } | null {
  if (!message) return null;

  // MongoDB E11000 duplicate key error
  if (message.includes('E11000 duplicate key')) {
    return {
      userMessage: 'An entity with this ID already exists. If you are importing data, try using the "Upsert" strategy instead of "Insert Only".',
      technicalDetails: message
    };
  }

  return null;
}

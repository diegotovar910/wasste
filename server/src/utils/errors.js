/** An error with an HTTP status code and a message that is safe to show a user. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const notFound = (message = 'Resource not found') => new ApiError(404, message);
export const serviceUnavailable = (message) => new ApiError(503, message);

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFoundMiddleware(req, res) {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}` });
}

/* eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity. */
export function errorMiddleware(error, req, res, next) {
  const status = error.status || (error.name === 'ValidationError' ? 400 : 500);

  // An ApiError was raised deliberately, so its message is already written for
  // the user - including 5xx ones like "AI analysis is temporarily
  // unavailable". Only unexpected failures get hidden behind a generic message.
  const isDeliberate = error instanceof ApiError;

  if (status >= 500 && !isDeliberate) {
    console.error('[error]', error);
  }

  res.status(status).json({
    error: isDeliberate || status < 500 ? error.message : 'Something went wrong on the Wasste server.',
    details: error.details,
  });
}

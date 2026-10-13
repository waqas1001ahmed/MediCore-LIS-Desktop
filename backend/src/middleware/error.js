import { ApiError } from '../utils/errors.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err.code === 11000 || err.code === 'E11000') {
    status = 409;
    message = 'A record with these details already exists';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'Uploaded file is too large';
  } else if (err.name === 'MulterError') {
    status = 400;
  }

  if (status >= 500) {
    console.error('[error]', err);
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }

  res.status(status).json({
    error: {
      message,
      ...(details ? { details } : {}),
    },
  });
}

export class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const notFound = (code, message) => new AppError(404, code, message)
export const conflict = (code, message) => new AppError(409, code, message)
export const unauthorized = (code, message) => new AppError(401, code, message)

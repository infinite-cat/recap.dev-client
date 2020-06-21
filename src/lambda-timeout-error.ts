export class LambdaTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LambdaTimeoutError'
  }
}

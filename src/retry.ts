export interface RetryOptions {
  /**
   * Maximum number of retry attempts after the initial failure.
   * Default: 0 (retries disabled).
   */
  maxRetries?: number;
  /**
   * Initial delay in milliseconds before the first retry attempt.
   * Default: 200ms.
   */
  initialDelayMs?: number;
  /**
   * Maximum delay cap in milliseconds between retry attempts.
   * Default: 3000ms.
   */
  maxDelayMs?: number;
  /**
   * Multiplier applied to the delay on each subsequent retry.
   * Default: 2.
   */
  backoffFactor?: number;
  /**
   * Predicate determining if an error is transient and eligible for retry.
   * By default, all thrown errors are considered retryable.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Executes an asynchronous function with exponential backoff retry.
 * Configurable and off by default (maxRetries = 0).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 0;
  if (maxRetries <= 0) {
    return operation();
  }

  const initialDelayMs = options.initialDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const backoffFactor = options.backoffFactor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let attempt = 0;
  let currentDelay = initialDelayMs;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs);
    }
  }
}

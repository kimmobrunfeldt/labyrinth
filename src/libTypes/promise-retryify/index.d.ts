type Options = {
  // Decision function which gets the Promise rejection error as a parameter
  // Should return true of false synchronously
  shouldRetry?: (err: Error) => boolean

  // Executed before each retry. Can return a Promise for async operations
  beforeRetry?: (retryCount: number) => Promise<void>

  // Retry count overrides even though shouldRetry returns true
  // For unlimited retries, use Infinity.
  // To disable retrying, use 0.
  maxRetries?: number

  // Timeout before retrying
  retryTimeout?: (retryCount: number) => number

  attributePicker?: (attrKey: string) => boolean

  onAllFailed?: (err: Error) => void
}

type ObjectFormat = { [key: string]: any }
type FunctionFormat = (...args: any) => Promise<any>
function retryify<T extends ObjectFormat | FunctionFormat>(
  obj: T,
  opts?: Options
): T
export default retryify

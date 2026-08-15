// Import the real sonner entry directly; using the deep path avoids the alias rewrite
import * as Sonner from 'sonner/dist/index.mjs'

// Suppress noisy forbidden messages globally
const shouldSuppress = (message: unknown) =>
  typeof message === 'string' && message.trim().toLowerCase() === 'forbidden.'

const wrap = <T extends (...args: any[]) => any>(fn: T | undefined) => {
  if (!fn) return undefined as T
  return ((message: unknown, ...rest: any[]) => {
    if (shouldSuppress(message)) return
    return fn(message as any, ...rest)
  }) as T
}

const baseToast = Sonner.toast

export const toast = Object.assign(wrap(baseToast), {
  ...baseToast,
  success: wrap(baseToast?.success),
  info: wrap(baseToast?.info),
  warning: wrap(baseToast?.warning),
  error: wrap(baseToast?.error),
  message: wrap((baseToast as any)?.message ?? baseToast),
})

export * from 'sonner/dist/index.mjs'

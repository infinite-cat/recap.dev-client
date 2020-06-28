export const debugLog = (...args: any) => {
  if (process.env.RECAP_DEV_DEBUG_LOG) {
    console.log(...args)
  }
}

import { config } from './config'

export const debugLog = (...args: any) => {
  if (config.isDebugLogEnabled) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

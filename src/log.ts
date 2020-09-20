import { config } from './config'

export const debugLog = (...args: any) => {
  if (config.isDebugLogEnabled) {
    console.log(...args)
  }
}

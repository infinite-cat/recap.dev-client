class Config {
  get disablePayloadCapture() {
    return (process.env.RECAP_DEV_DISABLE_PAYLOAD_CAPTURE && Boolean(process.env.RECAP_DEV_DISABLE_PAYLOAD_CAPTURE)) || false
  }

  get syncTimeout() {
    return process.env.RECAP_DEV_SYNC_TIMEOUT ? Number(process.env.RECAP_DEV_SYNC_TIMEOUT) : 1000
  }

  get maxPayloadLength() {
    return process.env.RECAP_DEV_MAX_PAYLOAD ? Number(process.env.RECAP_DEV_MAX_PAYLOAD) : 10000
  }

  get syncEndpoint() {
    return process.env.RECAP_DEV_SYNC_ENDPOINT
  }

  get serverlessTimeoutWindow() {
    return process.env.RECAP_DEV_TIMEOUT_WINDOW ? Number(process.env.RECAP_DEV_TIMEOUT_WINDOW) : 200
  }

  get pgDriverModulePath() {
    return process.env.RECAP_DEV_POSTGRES_MODULE ? `${process.cwd()}${process.env.RECAP_DEV_POSTGRES_MODULE}` : 'pg'
  }

  get isDebugLogEnabled() {
    return !!process.env.RECAP_DEV_DEBUG_LOG
  }
}

export const config = new Config()

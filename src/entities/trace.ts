import { FunctionCallEvent } from './function-call-event'
import { ResourceAccessEvent } from './resource-access-event'
import { LogEntry } from './log-entry'

export class Trace {
  id?: string

  unitName: string

  unitType: string

  request: any

  response: any

  start?: number

  end?: number

  error?: string

  logs: LogEntry[] = []

  appName = process.env.RECAP_DEV_APP_NAME

  status: 'OK' | 'ERROR' = 'OK'

  functionCallEvents: FunctionCallEvent[] = []

  resourceAccessEvents: ResourceAccessEvent[] = []

  extraData: any = {}

  constructor(id: string, unitName: string, unitType: string) {
    this.id = id
    this.unitName = unitName
    this.unitType = unitType
  }
}

import url from 'url'

import { debugLog } from '../log'
import { getModules } from './utils'
import { tracer } from '../tracer'

const eventsMap = {}

const getResponse = (event) => {
  const { commandName, reply } = event

  switch (commandName) {
    case 'find':
      if (reply.cursor && Array.isArray(reply.cursor.firstBatch)) {
        return { itemsCount: reply.cursor.firstBatch.length, firstBatch: reply.cursor.firstBatch }
      }
      if (Array.isArray(reply)) {
        return { reply }
      }
      break
    case 'getMore':
      if (reply.cursor && Array.isArray(reply.cursor.nextBatch)) {
        return { itemsCount: reply.cursor.nextBatch.length, nextBatch: reply.cursor.nextBatch }
      }
      if (Array.isArray(reply)) {
        return { reply }
      }
      break
    case 'count':
      if (reply.ok) {
        return { itemsCount: reply.n }
      }
      if (Array.isArray(reply)) {
        return { reply }
      }
      break
    default:
      return {}
  }

  return {}
}

function getConnectionDetails(connectionId) {
  if (connectionId) {
    if (typeof connectionId === 'string') {
      const parsedUrl = url.parse(connectionId)
      return { host: parsedUrl.hostname, port: parsedUrl.port }
    }

    if (connectionId.domainSocket) {
      return { host: 'localhost', port: connectionId.port }
    }

    return { host: connectionId.host, port: connectionId.port }
  }

  return { host: undefined, port: undefined }
}

function onStartHook(event: any) {
  try {
    const { host, port } = getConnectionDetails(event?.connectionId)

    let collection = event.command.collection || event.command[event.commandName]

    if (typeof collection !== 'string') {
      collection = ''
    }

    const mongoDbEvent = tracer.resourceAccessStart(
      'mongodb',
      {
        host,
        port,
        database: event.databaseName,
        collection,
      },
      {
        request: {
          ...event.command,
          operation: event.commandName,
        },
      },
    )

    eventsMap[event.requestId] = mongoDbEvent
  } catch (error) {
    debugLog(error)
  }
}

function handleResponse(event, hasError: boolean = false) {
  try {
    const endTime = Date.now()
    const mongoDbEvent = eventsMap[event.requestId]

    mongoDbEvent.end = endTime
    mongoDbEvent.status = hasError ? 'ERROR' : 'OK'
    mongoDbEvent.response = getResponse(event)

    delete eventsMap[event.requestId]
  } catch (error) {
    debugLog(error)
  }
}

function onSuccessHook(event) {
  handleResponse(event)
}

function onFailureHook(event) {
  handleResponse(event, true)
}

export const trackMongoDb = () => {
  const modules = getModules('mongodb')
  debugLog(`recap.dev patching ${modules.length} mongodb modules`)
  modules.forEach((mongodb) => {
    const listener = mongodb.instrument({}, (error) => {
      if (error) {
        debugLog('recap.dev mongodb instrumentation error', error)
      }
    })
    listener.on('started', onStartHook)
    listener.on('succeeded', onSuccessHook)
    listener.on('failed', onFailureHook)
  })
}

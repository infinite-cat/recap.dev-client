import { isFunction, isNull, isUndefined, isString } from 'lodash-es'
import { config } from './config'

export const isPromise = (value: any) =>
  value && isFunction(value.then) && Object.prototype.toString.call(value) === '[object Promise]'

export const safeParse = (parseString?: string | null) => {
  try {
    return JSON.parse(parseString!)
  } catch (e) {
    return null
  }
}

export const appendBodyChunk = (chunk, body) => {
  if (chunk && body.length < config.maxPayloadLength) {
    return body + chunk
  }
  return body
}

export const limitPayload = (
  payload: object | string | undefined | null,
  limit: number = config.maxPayloadLength,
): object | string | undefined | null => {
  if (isNull(payload) || isUndefined(payload)) {
    return payload
  }

  if (isString(payload) && payload.length > limit) {
    return `${payload.substr(0, limit - 3)}...`
  }

  const stringifiedPayload = JSON.stringify(payload)

  if (stringifiedPayload.length > limit) {
    return `${stringifiedPayload.substr(0, limit - 3)}...`
  }

  return payload
}

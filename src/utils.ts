import { isFunction } from 'lodash-es'
import { config } from './config'

export const isPromise = (value: any) => (
  value
  && isFunction(value.then)
  && Object.prototype.toString.call(value) === '[object Promise]'
)

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

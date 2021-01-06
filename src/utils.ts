import { isFunction } from 'lodash-es'

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

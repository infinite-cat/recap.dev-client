import { intersection } from 'lodash-es'

const snsEventProperties = [
  'Type',
  'MessageId',
  'TopicArn',
  'Message',
  'Timestamp',
  'SignatureVersion',
  'Signature'
]

export const getSNSTrigger = (messages: any[]) => {
  let snsEvent = null
  messages.some(message => {
    try {
      let body = null

      if (message.Body) {
        body = JSON.parse(message.Body)
      } else if (message.body) {
        body = JSON.parse(message.body)
      } else {
        return true
      }

      if (
        intersection(Object.keys(body!), snsEventProperties).length >= snsEventProperties.length
      ) {
        snsEvent = body
        return true
      }
    } catch (ex) {
      // Continue to the next message
    }

    return true
  })

  return snsEvent
}

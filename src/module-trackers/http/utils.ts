import zlib from 'zlib'
import urlLib from 'url'

import { debugLog } from '../../log'

export const extractHostname = (url?: string): string => {
  if (!url) {
    return 'unknown'
  }

  const parsedUrl = urlLib.parse(url)
  return (parsedUrl && parsedUrl.hostname!)
    || (parsedUrl && parsedUrl.host!)
}

const isUrlBlacklisted = (host, path) => {
  const syncEndpointHost = extractHostname(process.env.RECAP_DEV_SYNC_ENDPOINT)

  const urlBlacklistMap: any = {
    [syncEndpointHost]: 'endsWith',
    'oauth2.googleapis.com': 'endsWith',
    'amazonaws.com':
      (url, pattern) => url.endsWith(pattern)
        && (url.indexOf('.execute-api.') === -1)
        && (url.indexOf('.es.') === -1)
        && (url.indexOf('.elb.') === -1)
        && (url.indexOf('.appsync-api.') === -1),
    'blob.core.windows.net': 'endsWith',
    'documents.azure.com': 'endsWith',
    '127.0.0.1': (url, pattern, urlPath) => (url === pattern) && urlPath.startsWith('/2018-06-01/runtime/invocation/'),
    '169.254.169.254': 'startsWith', // EC2 document ip. Have better filtering in the future
  }

  return Object.keys(urlBlacklistMap).some((key) => {
    if (typeof urlBlacklistMap[key] === typeof (() => {})) {
      return urlBlacklistMap[key](host, key, path)
    }
    return host[urlBlacklistMap[key]](key)
  })
}

const isUrlIgnoredByUser = (host) => {
  const ignorePatterns: string[] = (process.env.RECAP_DEV_IGNORE_HTTP_PATTERNS && process.env.RECAP_DEV_IGNORE_HTTP_PATTERNS.split(',')) || []
  return ignorePatterns.some((pattern) => host.includes(pattern))
}

export const isUrlIgnored = (host, path) => isUrlBlacklisted(host, path) || isUrlIgnoredByUser(host)

const ENCODING_FUNCTIONS = {
  // @ts-ignore
  br: zlib.brotliDecompressSync,
  // @ts-ignore
  brotli: zlib.brotliDecompressSync,
  gzip: zlib.gunzipSync,
  deflate: zlib.deflateSync,
}

export const decodeJson = (data, encoding) => {
  try {
    let jsonData = data
    if (ENCODING_FUNCTIONS[encoding]) {
      try {
        jsonData = ENCODING_FUNCTIONS[encoding](data)
      } catch (err) {
        debugLog('Could not decode JSON')
      }
    }
    JSON.parse(jsonData)
    return jsonData.toString()
  } catch (err) {
    debugLog('Could not parse JSON', err)
  }
  return undefined
}

const maxHttpValueSize = 10 * 1024

export const addChunk = (chunk, chunks) => {
  if (chunk) {
    const totalSize = chunks.reduce((total, item) => item.length + total, 0)
    if (totalSize + chunk.length <= maxHttpValueSize) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
  }
}

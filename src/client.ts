import awsSdkV3Tracker from "./module-trackers/aws-sdk-v3"
import {trackHttp} from "./module-trackers/http/http"
import {trackHttp2} from "./module-trackers/http/http2"

export * from './tracer'
export * from './wrappers'
export * from './entities'
export * from './module-trackers'

awsSdkV3Tracker.init()
trackHttp()
trackHttp2()

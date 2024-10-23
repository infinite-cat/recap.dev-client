import awsSdkV3Tracker from "./module-trackers/aws-sdk-v3"

export * from './tracer'
export * from './wrappers'
export * from './entities'
export * from './module-trackers'

awsSdkV3Tracker.init()

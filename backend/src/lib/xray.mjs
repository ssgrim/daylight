// AWS X-Ray tracing helper for Lambda and Node.js
// Usage: import { captureAsyncFunc } from './xray.mjs'

let AWSXRay = null
try {
  AWSXRay = await import('aws-xray-sdk-core')
} catch (e) {
  // Not installed or not in AWS Lambda
}

export function captureAsyncFunc(name, fn) {
  if (AWSXRay && AWSXRay.captureAsyncFunc) {
    return AWSXRay.captureAsyncFunc(name, fn)
  }
  // fallback: just run the function
  return fn()
}

export function capturePromise(name, promiseFn) {
  if (AWSXRay && AWSXRay.captureAsyncFunc) {
    return new Promise((resolve, reject) => {
      AWSXRay.captureAsyncFunc(name, async (subsegment) => {
        try {
          const result = await promiseFn()
          subsegment && subsegment.close()
          resolve(result)
        } catch (err) {
          subsegment && subsegment.addError(err)
          subsegment && subsegment.close()
          reject(err)
        }
      })
    })
  }
  return promiseFn()
}

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

const sm = new SecretsManagerClient({})
const ssm = new SSMClient({})
const cache = new Map()

export async function getSecretValue(secretArnOrName, opts = { fromSSM: false }) {
  if (!secretArnOrName) return null
  if (cache.has(secretArnOrName)) return cache.get(secretArnOrName)
  try {
    if (opts.fromSSM) {
      const cmd = new GetParameterCommand({ Name: secretArnOrName, WithDecryption: true })
      const res = await ssm.send(cmd)
      const v = res.Parameter?.Value || null
      cache.set(secretArnOrName, v)
      return v
    }
    const cmd = new GetSecretValueCommand({ SecretId: secretArnOrName })
    const res = await sm.send(cmd)
    const secret = res.SecretString || null
    cache.set(secretArnOrName, secret)
    return secret
  } catch (err) {
    console.warn('getSecretValue error', String(err))
    return null
  }
}

export default { getSecretValue }

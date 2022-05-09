/**
 * This networking module is used in node code. The mapping happens
 * in package.json "browser" field.
 */

import { createServerWebSocketNetworking } from 'src/core/server/networking/webSocket'
import { CreateServerNetworkingOptions, ServerNetworking } from './utils'

export async function createServerNetworking(
  opts: CreateServerNetworkingOptions
): Promise<ServerNetworking> {
  await createServerWebSocketNetworking(opts)

  return {
    peerId: 'not used',
  }
}

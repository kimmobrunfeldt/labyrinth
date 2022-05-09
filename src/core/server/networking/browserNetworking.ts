/**
 * This networking module is used in browser code. The mapping happens
 * in package.json "browser" field.
 */

import { createPeerJsNetworking } from 'src/core/server/networking/peerjs'
import { CreateServerNetworkingOptions, ServerNetworking } from './utils'

export async function createServerNetworking(
  opts: CreateServerNetworkingOptions
): Promise<ServerNetworking> {
  const peerJs = await createPeerJsNetworking(opts)

  return {
    peerId: peerJs.peerId,
  }
}

export const iceServers = [
  {
    urls: 'stun:openrelay.metered.ca:80',
  },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

/**
 * 0 Prints no logs.
 * 1 Prints only errors.
 * 2 Prints errors and warnings.
 * 3 Prints all logs.
 */
export const debugLevel = 2

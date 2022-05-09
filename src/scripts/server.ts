import { createServer } from 'src/core/server/server'
import yargs from 'yargs'

const parser = yargs
  .command(
    'start',
    'Starts the server',
    (yargs) =>
      yargs.options({
        p: {
          required: true,
          alias: 'port',
          type: 'number',
          describe: 'WebSocket listening port',
        },
        t: {
          required: false,
          alias: 'token',
          type: 'string',
          describe: 'Admin token',
        },
      }),
    async ({ p, t }) => {
      await createServer({
        serverPeerId: 'not-used-in-node',
        serverWebSocketPort: p,
        adminToken: t,
      })
    }
  )
  .help()

;(async () => {
  await parser.argv
})()

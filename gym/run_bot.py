import argparse
import asyncio
from bot.LabyrinthBot import LabyrinthBot

parser = argparse.ArgumentParser()
parser.add_argument('websocket_url', help='Websocket url to connect')
parser.add_argument("-t", "--token", help="Admin token for the game server")

args = parser.parse_args()


async def main():
    bot = LabyrinthBot(args.websocket_url, admin_token=args.token)
    loop = asyncio.get_running_loop()
    task = loop.create_task(bot.connect())

    while not bot.has_connected():
        print('not connected yet')
        await asyncio.sleep(1)

    await bot.restart()
    # Demo of json rpc await
    print('state', await bot.get_state())

    await task

l = asyncio.get_event_loop()
l.run_until_complete(main())

from bot.LabyrinthBot import LabyrinthBot
from bot.SyncLabyrinthBot import SyncLabyrinthBot
import nest_asyncio
import argparse
import asyncio
import time
from labyrinth_env import LabyrinthEnv
from stable_baselines3.common.env_checker import check_env

# To make syncer working in SyncLabyrinthBot
# This could probably be work-arounded by running the tasks within the running
# event loop, but this just worked so...
nest_asyncio.apply()

parser = argparse.ArgumentParser()
parser.add_argument('websocket_url', help='Websocket url to connect')
parser.add_argument("-t", "--token", help="Admin token for the game server")

args = parser.parse_args()


async def main():
    bot = LabyrinthBot(args.websocket_url, admin_token=args.token)
    loop = asyncio.get_running_loop()
    task = loop.create_task(bot.connect())
    print('sync_bot')

    while not bot.has_connected():
        print('not connected yet')
        await asyncio.sleep(1)

    print('Connected!')
    sync_bot = SyncLabyrinthBot(bot)
    env = LabyrinthEnv(sync_bot)
    env.reset()
    check_env(env)

    await asyncio.ensure_future(task)


l = asyncio.get_event_loop()
l.run_until_complete(main())

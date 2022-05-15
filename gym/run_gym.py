from bot.LabyrinthBot import LabyrinthBot
from bot.SyncLabyrinthBot import SyncLabyrinthBot
import nest_asyncio
import argparse
import asyncio
import time
from labyrinth_env import LabyrinthEnv
from stable_baselines3.ppo import PPO

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

    model = PPO("MultiInputPolicy", env, verbose=1)
    model.learn(total_timesteps=10)

    print('connect to game now!')
    sync_bot.restart()
    await asyncio.sleep(10)
    obs = env.reset()

    for i in range(200):
        action, _states = model.predict(obs)
        print(action)
        obs, rewards, dones, info = env.step(action)
        print('rewards', rewards)
        while True:
            state_now = sync_bot.get_state()
            if state_now['players'][state_now['playerTurn']]['id'] == state_now['me']['id']:
                break

            print('waiting for my turn..')
            await asyncio.sleep(4)

    await task


l = asyncio.get_event_loop()
l.run_until_complete(main())

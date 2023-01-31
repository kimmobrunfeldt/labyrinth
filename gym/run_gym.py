import random
from bot.LabyrinthBot import LabyrinthBot
from bot.SyncLabyrinthBot import SyncLabyrinthBot
from labyrinth_env import gym_action_to_game_action
from labyrinth_env import game_state_to_observation
from labyrinth_env import TensorboardCallback
import nest_asyncio
import argparse
import asyncio
import time
from labyrinth_env import LabyrinthEnv
from stable_baselines3.ppo import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3 import SAC
from stable_baselines3.common.callbacks import EvalCallback, StopTrainingOnRewardThreshold


# To make syncer working in SyncLabyrinthBot
# This could probably be work-arounded by running the tasks within the running
# event loop, but this just worked so...
nest_asyncio.apply()

parser = argparse.ArgumentParser()
parser.add_argument('websocket_url', help='Websocket url to connect')
parser.add_argument("-t", "--token", help="Admin token for the game server")
parser.add_argument("-o", "--open", help="Open saved model")

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
    check_env(env)

    if not args.open:
        model = PPO("MultiInputPolicy", env, verbose=1,
                    tensorboard_log="./tensorboard/")
        # Stop training when the model reaches the reward threshold
        callback_on_best = StopTrainingOnRewardThreshold(
            reward_threshold=800, verbose=1)
        eval_callback = EvalCallback(
            env, callback_on_new_best=callback_on_best, eval_freq=10000, best_model_save_path='./models', verbose=1)
        rewards_callback = TensorboardCallback()
        model.learn(total_timesteps=100_000_000, callback=[
                    rewards_callback, eval_callback])
        print('saving model..')
        model.save("snakemodel")
        print('model saved!')
        return

    model = PPO.load(args.open)
    print('connect to game now!')
    sync_bot.restart()
    await asyncio.sleep(10)

    for i in range(200):
        while True:
            state_now = sync_bot.get_state()
            if state_now['players'][state_now['playerTurn']]['id'] != state_now['me']['id']:
                print('waiting for my turn..')
                await asyncio.sleep(4)
                continue

            obs = game_state_to_observation(state_now)
            action, _states = model.predict(obs)
            game_action = gym_action_to_game_action(action)
            print('game_action', game_action)
            await bot.push(game_action['push']['position'], game_action['push']['rotation'])
            await asyncio.sleep(2)
            await bot.move(game_action['move'])

            state_now = sync_bot.get_state()
            if state_now['players'][state_now['playerTurn']]['id'] == state_now['me']['id']:
                print('failed to do correct actions')
                if not state_now['playerHasPushed']:
                    valid_positions = bot.get_valid_push_positions()
                    pushPosition = random.sample(valid_positions, 1)[0]
                    rotation = random.sample([0, 90, 180, 270], 1)[0]
                    await bot.push(pushPosition, rotation)

                myPos = bot.get_my_position()
                await bot.move(myPos)

            break

    await task


l = asyncio.get_event_loop()
l.run_until_complete(main())

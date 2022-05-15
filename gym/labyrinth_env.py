import gym
from bot import utils
from bot import SyncLabyrinthBot
from bot.LabyrinthBot import LabyrinthBot
from bot.utils import BOARD_PUSH_POSITIONS
from gym.spaces import Discrete, Box, Dict, Tuple
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.td3.policies import MlpPolicy
from stable_baselines3.ppo import PPO
from stable_baselines3.common.env_util import make_vec_env

GRID = (7, 7)
PIECE_TYPES = 3
PUSH_POSITIONS = 12
ROTATIONS = 4
TROPHIES = 24

PIECE_TROPHIES = TROPHIES + 1  # +1 for "no trophy"

trophy_to_index = {
    # 0 indicates "no trophy"
    "KnightHelmet": 1,
    "Candles": 2,
    "Dagger": 3,
    "Diamond": 4,
    "Treasure": 5,
    "Ring": 6,
    "HolyGrail": 7,
    "Keys": 8,
    "Crown": 9,
    "Potion": 10,
    "Coins": 11,
    "Book": 12,
    "Mouse": 13,
    "Bomb": 14,
    "Pony": 15,
    "Bat": 16,
    "Ghost": 17,
    "Cat": 18,
    "Mermaid": 19,
    "Dinosaur": 20,
    "Cannon": 21,
    "Owl": 22,
    "Lizard": 23,
    "Bug": 24
}
inv_trophy_to_index = {v: k for k, v in trophy_to_index.items()}

rotation_to_index = {
    0: 0,
    90: 1,
    180: 2,
    270: 3
}
inv_rotation_to_index = {v: k for k, v in rotation_to_index.items()}

piece_type_to_index = {
    'corner': 0,
    'straight': 1,
    't-shape': 2
}
inv_piece_type_to_index = {v: k for k, v in piece_type_to_index.items()}


class LabyrinthEnv(gym.Env):
    def __init__(self, bot):
        self.bot = bot
        self.action_space = Dict({
            "push": Dict({
                "position": Discrete(PUSH_POSITIONS),
                "rotation": Discrete(ROTATIONS)
            }),
            "move": Dict({
                "x": Discrete(7),
                "y": Discrete(7)
            })
        })

        self.observation_space = Dict(
            {
                "extra_piece": Dict({
                    "trophy": Discrete(PIECE_TROPHIES),
                    "rotation": Discrete(ROTATIONS)
                }),
                "my_next_card": Discrete(TROPHIES),
                "my_position": Dict({
                    "x": Discrete(7),
                    "y": Discrete(7)
                }),
                "board_piece_types": Box(low=1, high=PIECE_TYPES, shape=GRID),
                "board_piece_rotations": Box(low=1, high=ROTATIONS, shape=GRID),
                "board_piece_trophies": Box(low=1, high=PIECE_TROPHIES, shape=GRID),
            }
        )

    def reset(self):
        self.bot.restart()
        self.bot.start()
        self.observation_space = self.bot.get_game_state()

    def step(self, action):
        prev_state = self.bot.get_game_state()
        game_action = gym_action_to_game_action(action)
        self.bot.push(
            game_action['push']['position'],
            game_action['push']['rotation']
        )
        move_result = self.bot.move(game_action['move'])
        print('move_result', move_result)
        new_state = self.bot.get_game_state()
        observation = game_state_to_observation(new_state)
        reward = state_transition_to_reward(prev_state, new_state)
        episode_finished = new_state['stage'] == 'finished'
        return observation, reward, episode_finished, {}


def game_state_to_observation(state):
    extra_piece = state['pieceBag'][0]
    pieces = state['board']['pieces']
    my_position = utils.get_player_position(
        pieces,
        state['me']['id']
    )
    return {
        "extra_piece": {
            "trophy": piece_to_trophy_index(extra_piece),
            "rotation": rotation_to_index[extra_piece['rotation']]
        },
        # The game server supports multiple cards at once, but only uses 1 at a time
        "my_current_card": trophy_to_index[state['myCurrentCards'][0]['trophy']],
        "my_position": my_position,
        "board_piece_types": map(lambda row: map(lambda piece: piece_type_to_index[piece['type']], row), pieces),
        "board_piece_rotations": map(lambda row: map(lambda piece: rotation_to_index[piece['rotation']], row), pieces),
        "board_piece_trophies": map(lambda row: map(lambda piece: piece_to_trophy_index(piece), row), pieces),
    }


def gym_action_to_game_action(gym_action):
    return {
        "push": {
            "position": BOARD_PUSH_POSITIONS[gym_action['push']['position']],
            "rotation": inv_rotation_to_index[gym_action['push']['rotation']],
        },
        "move": {
            "x": gym_action['move']['x'],
            "y": gym_action['move']['y'],
        }
    }


def piece_to_trophy_index(piece):
    if 'trophy' in piece:
        return trophy_to_index[piece['trophy']]

    return 0


def state_transition_to_reward(state1, state2):
    state1_found = sum(
        (1 if c['found'] else 0 for c in state1['me']['censoredCards'])
    )
    state2_found = sum(
        (1 if c['found'] else 0 for c in state2['me']['censoredCards'])
    )
    return state2_found - state1_found


if __name__ == '__main__':
    print('in main')
    env = LabyrinthEnv()

    #model = PPO("MlpPolicy", env, verbose=1)
    # model.learn(total_timesteps=10000)

    obs = env.reset()
    for i in range(10):
        action, _states = model.predict(obs)
        print(action)
        obs, rewards, dones, info = env.step(action)

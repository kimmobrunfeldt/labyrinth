import math
import gym
import numpy as np
from bot import utils
from bot import SyncLabyrinthBot
from bot.LabyrinthBot import LabyrinthBot
from bot.utils import BOARD_PUSH_POSITIONS, get_piece_position, get_player_position
from gym.spaces import Discrete, Box, Dict, Tuple, MultiDiscrete
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import BaseCallback
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


# Convert grid positions into indices
position_to_index = {}
idx = 0
for x in range(GRID[0]):
    for y in range(GRID[1]):
        position_to_index[(x, y)] = idx
        idx += 1
inv_position_to_index = {v: k for k, v in position_to_index.items()}


class LabyrinthEnv(gym.Env):
    def __init__(self, bot):
        self.bot = bot

        # self._max_episode_steps = 200

        self.action_space = MultiDiscrete((
            # Push positions
            PUSH_POSITIONS,
            # Rotation
            ROTATIONS,
            # Move positions
            GRID[0] * GRID[1]
        ))

        self.observation_space = Dict(
            {
                "extra_piece": MultiDiscrete((
                    PIECE_TROPHIES,
                    ROTATIONS
                )),
                "my_current_card": Discrete(PIECE_TROPHIES),
                "my_position": Discrete(GRID[0] * GRID[1]),
                "board_piece_types": Box(low=0, high=PIECE_TYPES, shape=GRID, dtype=np.int8),
                "board_piece_rotations": Box(low=0, high=ROTATIONS, shape=GRID, dtype=np.int8),
                "board_piece_trophies": Box(low=0, high=PIECE_TROPHIES, shape=GRID, dtype=np.int8),
            }
        )

    def reset(self):
        self.bot.restart()
        self.bot.start()
        observation = game_state_to_observation(self.bot.get_state())
        return observation

    def step(self, action):
        prev_state = self.bot.get_cached_game_state()
        game_action = gym_action_to_game_action(action)
        self.bot.push(
            game_action['push']['position'],
            game_action['push']['rotation']
        )
        self.bot.move(game_action['move'])
        new_state = self.bot.get_state()
        observation = game_state_to_observation(new_state)
        print('new_observation', observation)
        reward = state_transition_to_reward(prev_state, new_state)
        self.tensor_reward = reward
        print('-- REWARD', reward)
        episode_finished = new_state['stage'] == 'finished' or reward < -10
        print('episode_finished', episode_finished)
        return observation, reward, episode_finished, {}


def game_state_to_observation(state):
    extra_piece = state['pieceBag'][0]
    pieces = state['board']['pieces']
    my_position = utils.get_player_position(
        pieces,
        state['me']['id']
    )
    return {
        "extra_piece": np.array([
            piece_to_trophy_index(extra_piece),
            rotation_to_index[extra_piece['rotation']]
        ]),
        # The game server supports multiple cards at once, but only uses 1 at a time
        "my_current_card": trophy_to_index[state['myCurrentCards'][0]['trophy']] if len(state['myCurrentCards']) > 0 else 0,
        "my_position": position_to_index[(my_position['x'], my_position['y'])] if my_position is not None else 0,
        "board_piece_types": np.array(
            map_pieces(
                lambda piece: piece_type_to_index[piece['type']],
                pieces
            ),
            dtype=np.int8
        ),
        "board_piece_rotations": np.array(
            map_pieces(
                lambda piece: rotation_to_index[piece['rotation']],
                pieces
            ),
            dtype=np.int8
        ),
        "board_piece_trophies": np.array(
            map_pieces(
                lambda piece: piece_to_trophy_index(piece),
                pieces
            ),
            dtype=np.int8
        ),
    }


def distance(x1, y1, x2, y2):
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def map_pieces(f, pieces):
    return list(
        map(
            lambda row: list(
                map(
                    f,
                    row
                )
            ),
            pieces
        ),
    )


def gym_action_to_game_action(gym_action):
    move = inv_position_to_index[gym_action[2]]
    return {
        "push": {
            "position": BOARD_PUSH_POSITIONS[gym_action[0]],
            "rotation": inv_rotation_to_index[gym_action[1]],
        },
        "move": {
            "x": move[0],
            "y": move[1],
        }
    }


def piece_to_trophy_index(piece):
    if 'trophy' in piece:
        return trophy_to_index[piece['trophy']]

    return 0


def state_transition_to_reward(state1, state2):
    if state2['stage'] == 'setup':
        return 0

    if state2['stage'] == 'finished':
        return 100

    if state1['turnCounter'] == state2['turnCounter']:
        return -100

    state1_found = sum(
        (1 if c['found'] else 0 for c in state1['me']['censoredCards'])
    )
    state2_found = sum(
        (1 if c['found'] else 0 for c in state2['me']['censoredCards'])
    )
    if state2_found > state1_found:
        print('found more', state2_found, state1_found)
        return state2_found - state1_found  # this should always be 1

    curr_trophy = state2['myCurrentCards'][0]['trophy']

    extra_piece = state2['pieceBag'][0]
    if 'trophy' in extra_piece and extra_piece['trophy']:
        return 0.5  # It is a semi-good thing to get your trophy as the extra piece

    if state1['myPosition']['x'] == state2['myPosition']['x'] and state1['myPosition']['y'] == state2['myPosition']['y']:
        # Zero reward for staying in place
        return 0

    pieces = state2['board']['pieces']
    trophy_pos = get_piece_position(
        pieces,
        lambda p: 'trophy' in p and p['trophy'] == curr_trophy
    )
    my_pos = state2['myPosition']
    max_distance = distance(0, 0, 6, 6)
    distance_to_trophy = distance(
        my_pos['x'], my_pos['y'], trophy_pos['x'], trophy_pos['y'])

    # Give reward from 0 - 10 depending on the distance towards trophy
    return (max_distance - distance_to_trophy) / max_distance * 10


class TensorboardCallback(BaseCallback):
    def __init__(self, verbose=1):
        super(TensorboardCallback, self).__init__(verbose)
        self.cumulative_reward = 0

    def _on_rollout_end(self) -> None:
        self.logger.record("rollout/cumulative_reward", self.cumulative_reward)

        # reset vars once recorded
        self.cumulative_reward = 0

    def _on_step(self) -> bool:
        self.cumulative_reward += self.training_env.get_attr("tensor_reward")[
            0]
        return True

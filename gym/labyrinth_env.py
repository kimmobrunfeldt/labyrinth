import gym
import numpy as np
from bot import utils
from bot import SyncLabyrinthBot
from bot.LabyrinthBot import LabyrinthBot
from bot.utils import BOARD_PUSH_POSITIONS
from gym.spaces import Discrete, Box, Dict, Tuple, MultiDiscrete
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
                "my_current_card": Discrete(TROPHIES),
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
        move_result = self.bot.move(game_action['move'])
        new_state = self.bot.get_state()
        print('new_state', new_state)
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
    if state1['turnCounter'] == state2['turnCounter']:
        return -1

    state1_found = sum(
        (1 if c['found'] else 0 for c in state1['me']['censoredCards'])
    )
    state2_found = sum(
        (1 if c['found'] else 0 for c in state2['me']['censoredCards'])
    )
    return state2_found - state1_found

import json
import asyncio
from bot.utils import BOARD_PUSH_POSITIONS
import websockets
import bot.utils as utils


class LabyrinthBot:
    def __init__(self, ws_url, meta=None, admin_token=None):
        self.ws_url = ws_url
        self.admin_token = admin_token
        self.ws = None
        self.meta = meta if meta is not None else {
            "playerId": "snake-ai",
            # "playerId": "snake-ai-{}".format(next(utils.counter())),
            "playerName": "SnakeAI"
        }
        self.game_state = None

        self.turns_reacted = set()
        self.handlers = {
            "onStateChange": self.on_state_change,
            "onMessage": self.on_message,
            "onJoin": self.on_join,
            "onServerReject": self.on_server_reject,
        }

        self.waiting_responses = {}

    def has_connected(self):
        return self.ws is not None

    async def connect(self):
        connection = websockets.connect(uri=self.ws_url)
        print('connection created')
        async with connection as websocket:
            self.ws = websocket
            await self.ws.send(json.dumps(self.meta))

            async for data in self.ws:
                message = json.loads(data)

                if 'method' in message:
                    result = await self.handleRequest(message)
                    response = utils.format_response(
                        message['id'] if 'id' in message else None,
                        result
                    )
                    await self.ws.send(json.dumps(response))
                elif 'result' in message:
                    await self.handleResponse(message)
                else:
                    print('Unknown message type:', message)

            # Closes the connection.
            await self.ws.close()

    async def handleRequest(self, message):
        method = message['method']
        print('<-', method)
        if method in self.handlers:
            result = await self.handlers[method](*message['params'])
            if result:
                return result

        return None

    async def handleResponse(self, message):
        if message['id'] not in self.waiting_responses:
            print('Response id not found', message)
            return

        print('Response to', message['id'])
        future = self.waiting_responses[message['id']]
        future.set_result(message['result'])
        del self.waiting_responses[message['id']]

    # Bot actions

    async def move(self, position):
        print('-> move', position)
        req = utils.format_notify('move', position)
        await self.ws.send(json.dumps(req))

    async def push(self, pushPosition, rotation):
        print('-> setExtraPieceRotation', rotation)
        req = utils.format_notify('setExtraPieceRotation', rotation)
        await self.ws.send(json.dumps(req))

        print('-> push', pushPosition)
        req = utils.format_notify('push', pushPosition)
        await self.ws.send(json.dumps(req))

    async def get_state(self):
        req = utils.format_request('getState')
        await self.ws.send(json.dumps(req))

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.waiting_responses[req['id']] = future
        result = await future
        self.game_state = result
        return result

    async def start(self):
        req = utils.format_notify('start', self.admin_token)
        await self.ws.send(json.dumps(req))

    async def restart(self):
        req = utils.format_notify('restart', self.admin_token)
        await self.ws.send(json.dumps(req))

     # Bot reactions

    async def on_state_change(self, state):
        return

        if self.game_state and self.game_state['stage'] != state['stage']:
            # Reset reaction memory
            self.turns_reacted = set()

        self.game_state = state

        is_playing = state['stage'] == 'playing'
        player_in_turn = state['players'][state['playerTurn']]
        is_our_turn = player_in_turn['id'] = state['me']['id']
        has_reacted_already = state['turnCounter'] in self.turns_reacted
        if not is_playing or not is_our_turn or has_reacted_already:
            return

        self.turns_reacted.add(state['turnCounter'])
        await self.on_my_turn()

    async def on_my_turn(self, *args):
        pass

    async def on_join(self, *args):
        self.game_state = args[0]

    async def on_message(ws, *args):
        pass

    async def on_server_reject(self, *args):
        print('Server rejected us:', args[0])
        print('Closing websocket ...')
        async with self.ws as websocket:
            await websocket.close()

        print('Closed!')

    # Utils

    def get_cached_game_state(self):
        return self.game_state

    def get_my_position(self):
        if self.game_state is None:
            raise Exception("self.game_state is None")

        return utils.get_player_position(self.game_state['board']['pieces'], self.game_state['me']['id'])

    def get_valid_push_positions(self):
        if self.game_state is None:
            raise Exception("self.game_state is None")

        if 'previousPushPosition' not in self.game_state:
            return BOARD_PUSH_POSITIONS

        prev_push = self.game_state['previousPushPosition']
        return list(filter(
            lambda pos: pos['x'] != prev_push['x'] and pos['y'] != prev_push['y'],
            BOARD_PUSH_POSITIONS
        ))

from bot.framework import LabyrinthBot
from bot.utils import BOARD_PUSH_POSITIONS
import random
import asyncio


class RandomBot(LabyrinthBot):

    async def on_my_turn(self):
        print('myTurn')
        valid_positions = self.get_valid_push_positions()
        pushPosition = random.sample(valid_positions, 1)[0]

        rotation = random.sample([0, 90, 180, 270], 1)[0]
        await self.push(pushPosition, rotation)

        myPos = self.get_my_position()
        await self.move(myPos)

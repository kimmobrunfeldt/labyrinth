from syncer import sync


class SyncLabyrinthBot:

    def __init__(self, bot):
        self.bot = bot

    async def connect(self, *args, **kwargs):
        return sync(self.bot.connect(*args, **kwargs))

    async def move(self, *args, **kwargs):
        return sync(self.bot.move(*args, **kwargs))

    async def push(self, *args, **kwargs):
        return sync(self.bot.push(*args, **kwargs))

    async def start(self, *args, **kwargs):
        return sync(self.bot.start(*args, **kwargs))

    async def restart(self, *args, **kwargs):
        return sync(self.bot.restart(*args, **kwargs))

    # Sync methods
    def has_connected(self, *args, **kwargs):
        return self.bot.has_connected(*args, **kwargs)

    def get_game_state(self, *args, **kwargs):
        return self.bot.get_game_state(*args, **kwargs)

    def get_my_position(self, *args, **kwargs):
        return self.bot.get_my_position(*args, **kwargs)

    def get_valid_push_positions(self, *args, **kwargs):
        return self.bot.get_valid_push_positions(*args, **kwargs)

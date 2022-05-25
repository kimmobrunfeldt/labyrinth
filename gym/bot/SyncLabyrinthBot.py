from syncer import sync


class SyncLabyrinthBot:
    """
    Synchronous wrapper for LabyrinthBot, to allow calling the methods within
    gym env.
    """

    def __init__(self, bot):
        self.bot = bot

        self._connect = sync(self.bot.connect)
        self._move = sync(self.bot.move)
        self._push = sync(self.bot.push)
        self._get_state = sync(self.bot.get_state)
        self._start = sync(self.bot.start)
        self._restart = sync(self.bot.restart)

    def connect(self, *args, **kwargs):
        return self._connect(*args, **kwargs)

    def move(self, *args, **kwargs):
        return self._move(*args, **kwargs)

    def push(self, *args, **kwargs):
        return self._push(*args, **kwargs)

    def get_state(self, *args, **kwargs):
        return self._get_state(*args, **kwargs)

    def start(self, *args, **kwargs):
        return self._start(*args, **kwargs)

    def restart(self, *args, **kwargs):
        return self._restart(*args, **kwargs)

    # Sync methods
    def has_connected(self, *args, **kwargs):
        return self.bot.has_connected(*args, **kwargs)

    def get_cached_game_state(self, *args, **kwargs):
        return self.bot.get_cached_game_state(*args, **kwargs)

    def get_my_position(self, *args, **kwargs):
        return self.bot.get_my_position(*args, **kwargs)

    def get_valid_push_positions(self, *args, **kwargs):
        return self.bot.get_valid_push_positions(*args, **kwargs)

import argparse
import asyncio
from bot.random_bot import RandomBot

parser = argparse.ArgumentParser()
parser.add_argument('websocket_url', help='Websocket url to connect')
parser.add_argument("-t", "--token", help="Admin token for the game server")

args = parser.parse_args()


def main():
    bot = RandomBot(args.websocket_url, admin_token=args.token)
    asyncio.run(bot.connect())


main()

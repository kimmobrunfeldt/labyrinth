import json


def counter():
    """Produces unique ids"""
    val = 1  # Start from >0 because the mole-rpc server has a bug where it doesn't respond to 0 id
    while True:
        yield val
        val += 1


request_id_counter = counter()


def format_request(method, *params):
    id = next(request_id_counter)
    return {
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params
    }


def format_notify(method, *params):
    return {
        "jsonrpc": "2.0",
        "method": method,
        "params": params
    }

# https://www.jsonrpc.org/specification#response_object


def format_response(id, result):
    return {
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    }


BOARD_PUSH_POSITIONS = [
    # top
    {"x": 1, "y": 0, "direction": 'down'},
    {"x": 3, "y": 0, "direction": 'down'},
    {"x": 5, "y": 0, "direction": 'down'},
    # right
    {"x": 6, "y": 1, "direction": 'left'},
    {"x": 6, "y": 3, "direction": 'left'},
    {"x": 6, "y": 5, "direction": 'left'},
    # bottom
    {"x": 5, "y": 6, "direction": 'up'},
    {"x": 3, "y": 6, "direction": 'up'},
    {"x": 1, "y": 6, "direction": 'up'},
    # left
    {"x": 0, "y": 5, "direction": 'right'},
    {"x": 0, "y": 3, "direction": 'right'},
    {"x": 0, "y": 1, "direction": 'right'},
]


def find(f, seq):
    """Return first item in sequence where f(item) == True."""
    for item in seq:
        if f(item):
            return item


def get_player_position(pieces, playerId):
    for y, row in enumerate(pieces):
        for x, piece in enumerate(row):
            p = find(
                lambda p: p['id'] == playerId,
                piece['players']
            )
            if p:
                return {"x": x, "y": y}


def get_piece_position(pieces, predicate):
    for y, row in enumerate(pieces):
        for x, piece in enumerate(row):
            if predicate(piece):
                return {"x": x, "y": y, "piece": piece}

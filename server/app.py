import asyncio
import json
import math
from dataclasses import dataclass

import websockets.server

MAX_AGE = 100


@dataclass
class Cursor:
    x: float
    y: float
    age: int
    color: str

    def validate(self):
        return (
            0 <= self.age < MAX_AGE
            and 0 <= self.x < 1
            and 0 <= self.y < 1
            and self.color in {"black", "red", "green", "blue"}
        )

    def serialize(self):
        return {
            "x": self.x,
            "y": self.y,
            "age": self.age,
            "color": self.color,
        }


class CursorManager:
    def __init__(self):
        self.loop = asyncio.get_event_loop()
        self.cursors = []
        self.clients = []
        self.attrs = {}

    def create(self, x, y, color, from_client):
        c = Cursor(x, y, MAX_AGE - 1, color)
        if c.validate():
            self.cursors.append(c)

        self.tell_all_others(["create", [c.serialize()]], from_client)

    def tell_all_others(self, msg, from_client):
        for client in self.clients:
            if client == from_client:
                continue

            asyncio.create_task(client.send(json.dumps(msg)))

    @property
    def age_rate(self):
        if len(self.cursors) == 0:
            return 2000

        return max(min(5000 / math.sqrt(len(self.cursors)), 2000), 20)

    def tick(self):
        for cursor in self.cursors:
            cursor.age -= 1

        self.cursors = [c for c in self.cursors if c.age > 0]

    async def tick_forever(self):
        while True:
            self.tick()
            await asyncio.sleep(self.age_rate / 1000)


manager = CursorManager()


async def client_handler(socket):
    try:
        manager.clients.append(socket)
        manager.attrs[socket] = {"color": "black", "x": 0, "y": 0}
        manager.tell_all_others(["connect", id(socket)], socket)

        for other in manager.clients:
            if other != socket:
                await socket.send(json.dumps(["connect", id(other)]))
                await socket.send(
                    json.dumps(
                        [
                            "color",
                            {"id": id(other), "color": manager.attrs[other]["color"]},
                        ]
                    )
                )
                await socket.send(
                    json.dumps(
                        [
                            "position",
                            {
                                "id": id(other),
                                "x": manager.attrs[other]["x"],
                                "y": manager.attrs[other]["y"],
                            },
                        ]
                    )
                )

        await socket.send(
            json.dumps(["create", [c.serialize() for c in manager.cursors]])
        )

        async for message in socket:
            mtype, message = json.loads(message)
            if mtype == "create":
                manager.create(message["x"], message["y"], message["color"], socket)

            elif mtype == "color":
                if message not in {"black", "red", "green", "blue"}:
                    continue

                manager.tell_all_others(
                    ["color", {"id": id(socket), "color": message}], socket
                )

                manager.attrs[socket]["color"] = message

            elif mtype == "position":
                if 0 <= message["x"] < 1 and 0 <= message["y"] < 1:
                    manager.tell_all_others(
                        [
                            "position",
                            {"id": id(socket), "x": message["x"], "y": message["y"]},
                        ],
                        socket,
                    )
                    manager.attrs[socket]["x"] = message["x"]
                    manager.attrs[socket]["y"] = message["y"]

    finally:
        manager.tell_all_others(["disconnect", id(socket)], socket)
        manager.clients.remove(socket)


async def main():
    asyncio.create_task(manager.tick_forever())
    async with websockets.server.serve(client_handler, "0.0.0.0", 8765):
        await asyncio.Future()


asyncio.run(main())

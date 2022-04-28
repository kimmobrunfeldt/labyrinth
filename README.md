# Labyrinth

Online version of the Labyrinth board game. The game server will run
on the host's browser and networking happens peer-to-peer.

### Code architecture

* [Game server](src/core/server.ts): isolated piece which could be ran in dedicated-mode somewhere else. The server is controlled by the admin client via JSON RPC _(transported via PeerJS WebRTC data connection)_ protocol. In practice, the browser which creates the server also runs the admin client.

    Server code is split into:

    * [src/core/board.ts](src/core/board.ts) Game board utility functions.
    * [src/core/game.ts](src/core/game.ts) Game logic. Synchronous code.
    * [src/core/server.ts](src/core/server.ts) Runs networking and connects it to the core game logic. Asynchronous code.

* [Game client](src/core/client.ts): client for the server. Each client equals one player in the server. Bots are also ran on the host's browser. In the worst scenario, the host is running: the server, admin client (Player 1), bot 1, bot 2, and bot 3 clients.


### Communication methods

**TBD.**

* Star peers
* Broadcast via server
* Client to server
* Server to client
* Await / no await

```
Admin                            Server

Create server ---------------------> launch
          <--------token------------

Connect client -------------------->

Change settings ------------------>
```

### Tech stack

* [PeerJS](https://peerjs.com/) for WebRTC data connection abstraction. Handles [signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#the_signaling_server) for you.

   Reconnecting was painful. Opted for a quite forceful object [recycle/dispose pattern](src/utils/recycler.ts).

* [mole-rpc](https://github.com/koorchik/node-mole-rpc) for JSON RPC communication between the game server and clients (two-way communication).

    Mole-RPC is transport agnostic and it was fairly simple to create custom
    [transporters](src/utils/TransportClient.ts) for PeerJS communication.
* React for the UI. _Clean React code was not the goal.._


## Icon credits

Board

* Knight Helmet by zidney from NounProject.com
* Three Candle by Designs by MB from NounProject.com
* Mouse by Mr Balind from NounProject.com
* Spider by Kiran Shastry from NounProject.com
* Unicorn by Bakunetsu Kaito from NounProject.com
* Dagger by Bonegolem from NounProject.com
* Diamond by Rank Sol from NounProject.com
* Bat by BackFake from NounProject.com
* Treasure by Baboon designs from NounProject.com
* Ghost by Lero Keller from NounProject.com
* Ring by Ayub Irawan from NounProject.com
* Cat by Iris Li from NounProject.com
* Mermaid by Lars Meiertoberens from NounProject.com
* Holy Grail by Lars Meiertoberens from NounProject.com
* Dinosaur by TiRo from NounProject.com
* Key by Alice Design from NounProject.com
* Treasure Map by Muhammad Miftakhul Rizky from NounProject.com
* Cannon by sandra from NounProject.com
* Crown by Pundimon from NounProject.com
* Potion by Desti Silvana Ekasari from NounProject.com
* Owl by DinosoftLab from NounProject.com
* Lizard by Vectorstall from NounProject.com
* Book by Juan Pablo Bravo from NounProject.com
* Bug by SBTS from NounProject.com
* Bomb by NOVITA ASTRI from NounProject.com

UI

* Caret by olcay kurtulus from NounProject.com
* Settings by i cons from NounProject.com
* Play Icon by sureya from NounProject.com
* Player by nico bayu saputro from NounProject.com
* Replay by Cuputo from NounProject.com
* Cross by Joni Ramadhan from NounProject.com
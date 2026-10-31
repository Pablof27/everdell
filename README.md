# 🐿 Everdell

![CI](https://github.com/ymichael/everdell/workflows/CI/badge.svg)

**Play Everdell Online**

We highly recommend [purchasing this board game](https://www.starling.games/everdell) for personal use and all of its expansions! This app is useful if you want to play with people online or play test community mods to the game.

Currently supports:

- [Base game](https://boardgamegeek.com/boardgame/199792/everdell)
- [Pearlbrook Expansion](https://boardgamegeek.com/boardgame/259996/everdell-pearlbrook)
- [Newleaf](https://boardgamegeek.com/boardgame/332390/everdell-newleaf)
- [Bellfaire Locations & Events](https://boardgamegeek.com/boardgame/289057/everdell-bellfaire)

We designed this application with expansions in mind so it should be possible to add support for even more official expansions.

## Demo

You can demo this web app [here](https://everdell.vercel.app/). If you find a bug or have a feature request, please add it as one in issues tab.

## Development

### Code Organization

- This is a [nextjs](https://nextjs.org/) application.
- The core game models are located in `src/model/*`.
- UI components can be found in `src/components/*`.

### Key Concepts:

- Each `Game` is modeled as series of `GameState` (the latest one representing the current state of the game)
- `GameState`s transition to the next state via `GameInput`s (specified by the client)
- The `GameState` also holds things like a list of `Player`s, the `Deck`, discard pile, active `Location`s, `Event`s etc.
- Most of the custom logic can be found in `card.ts`, `location.ts` and `event.ts` where all the respective game objects are implemented.
- Most objects implement a `toJSON` and `fromJSON` method to allow them to be sent to the client. `toJSON` conditionally returns a public view of the object (eg. hides the cards in the player's hands and the cards in the deck).

Some important types that are used throughout the codebase:

| Type                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CardName`, `LocationName`, `EventName`    | String Enums of the various cards/locations & events. These alone are sufficient to encode a generic item. Eg. CardName[] models a Deck of cards with a specific ordering.                                                                                                                                                                                                                                                                                                     |
| `ResourceType`                             | Enum of resources `TWIG` `PEBBLE` `RESIN` `BERRY` `VP`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `GameInput`                                | This describes all the available ways to transition from one `GameState` to another. The `clientOptions` key on `GameInput` types is reserved for client specific variability. Eg. The `PLAY_CARD` input has client options that specify the card to play.                                                                                                                                                                                                                     |
| `GameInputSimple` vs. `GameInputMultiStep` | Simple `GameInput`s are things that players can typically play at the start of their turn (if eligible). Eg. playing a card from their hand. `GameInputMultiStep` are special in that they can only be triggered after taking certain actions. Eg. Choosing a wild resource after placing a worker on a location. The list of valid multi-step inputs are stored as part of the `GameState` (see `pendingGameInputs`) to avoid any unexpected/out-of-turn actions being taken. |
| `GameText`                                 | A way to describe in-game text (eg. on cards, in logs etc). This allows us to reference resources like berries, vp tokens and even cards/other players in the game in a consistent way across various parts of the UI                                                                                                                                                                                                                                                          |

The following test pages exist to make UI development easier:

| Path                  | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `/test/ui`            | Listing of all cards, locations, events as rendered     |
| `/test/inputs`        | Preview of the various variants of the user input forms |
| `/test/log`           | Preview of the game log ui                              |
| `/test/inputBoxLabel` | Preview of the input box labels                         |
| `/test/game`          | Preview of an ongoing game (non-functional)             |

`/test/log` and `/test/inputBoxLabel` are rendered from JSON data collected when running our unit tests.
To regenerate these, you can run `npm run collect_test_data`

### Persistence

The app uses sqlite or postgres for to store the game state across server restarts. Which dbms we use is determined by the environment variables. When deploying to Heroku, its recommended to use postgres so game state is persisted across deploys.

### Bots

Players of a new game can be bots (`src/bot/`), picked by difficulty (`src/bot/difficulties.ts`) or as a custom strategy:

| Bot      | How it plays                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `RANDOM` | A uniformly random legal move.                                                                                                                |
| `GREEDY` | One move ahead, scored by a linear evaluation whose weights are evolved with CMA-ES (`npm run evolve`, weights in `weights/run*/`).           |
| `MCTS_V` | Monte Carlo Tree Search (`src/bot/mcts.ts`) on a determinization of the hidden cards, uniform priors and the linear evaluation at the leaves. |
| `AZ`     | AlphaZero-style: the same search guided by a policy/value network trained by self-play (`weights/az/`).                                       |

Bots play each other in the arena, from the command line or at `/arena`:

```bash
npm run arena -- --bots=GREEDY:weights/run4/greedy-evolved.json,RANDOM --games=100
# Search bots take options (sims, k = determinizations, ...; see src/bot/botSpecs.ts);
# --workers plays games in parallel, --paired deals the same cards to both seatings.
npm run arena -- --bots=AZ:weights/az/expert:sims=200,MCTS_V:weights/run4/greedy-evolved.json --games=200 --workers=8 --paired
```

#### Training the AlphaZero bot

The network is trained in Python ([PyTorch](https://pytorch.org)) on games the bot plays against itself in TypeScript:

```bash
python3 -m venv train/.venv && train/.venv/bin/pip install -r train/requirements.txt

# The whole loop: self-play with the best network, train a candidate, gate it against the best
# (it must win 55% of 200 games), measure it against fixed anchors. Resumable.
npm run az-loop -- --run=run1 --generations=4 --games=1000 --sims=200 --fullProb=0.25 --fastSims=50 \
  --warmGames=5000 --warmBot=GREEDY:weights/run4/greedy-evolved.json --warmTemp=0.17 --warmEpochs=4
```

It writes self-play data to `data/az/<run>/` (not committed), models to `weights/az/<run>/gen-XXX/`, the current best to `weights/az/<run>/best/` and one row per generation to `weights/az/<run>/progress.csv`. `--warmGames` first trains generation 0 on the greedy bot's games; `--fullProb`/`--fastSims` enable playout cap randomization. The steps also run on their own:

```bash
npm run selfplay -- --bot=AZ:weights/az/run1/best --games=200 --sims=200 --out=data/az/run1/extra
npm run train -- --data data/az/run1 --window 3000 --init weights/az/run1/best/model.json --out weights/az/run1/manual
npm run train -- --data data/az/run1 --overfit 64 --steps 200   # pipeline sanity check
```

A model is a `model.json` manifest (layer offsets, action vocabulary, feature scaling table) plus `model.bin` (float32 parameters); `src/bot/network.ts` runs it in TypeScript and refuses models built for another vocabulary or state encoding. Models are trained for 2-player games. The `Expert` difficulty plays `weights/az/expert` (generation 3 of run1) with 400 simulations × 3 determinizations.

Measured on an Apple M3 Pro (2-player base game, `--paired` arenas of 100–200 games):

| Matchup                                        | Win rate | Mean VP      |
| ---------------------------------------------- | -------- | ------------ |
| `MCTS_V` (200 sims) vs `GREEDY` (same weights) | 41–45%   | 36 vs 40     |
| `AZ` gen 0, warm start (200 sims) vs `GREEDY`  | 66.5%    | 42.8 vs 39.5 |
| `AZ` gen 3 (200 sims) vs `GREEDY`              | 91%      | 49.4 vs 36.7 |
| `AZ` gen 3 (200 sims) vs `MCTS_V` (200 sims)   | 95%      | 48.5 vs 31.6 |
| `Expert` (400 sims × 3) vs `GREEDY` (Hard)     | 91%      | 48.6 vs 35.8 |

A search costs about 0.25 ms per simulation for both `MCTS_V` and `AZ` (200 simulations ≈ 50 ms). `MCTS_V` stays slightly below `GREEDY`: its weights were evolved to rank moves one ply ahead (eg. available workers are worth a lot, which swings the value at every worker placement deeper in the tree), and `tanh` saturates once a game looks decided.

### Getting Started

Install dependencies:

```bash
npm ci
```

Run the development server:

```bash
npm run dev

open http://localhost:3000
```

Running tests & checks:

```bash
npm run typecheck
npm run typecheck:watch

npm run format

npm run test
npm run test:watch
```

## Credits

This project won't exist without the actual board game and was heavily inspired by the [terraforming-mars](https://github.com/bafolts/terraforming-mars) repository.

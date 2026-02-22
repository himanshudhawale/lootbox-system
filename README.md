# 🎰 Lootbox Bot

A Discord lootbox gambling bot integrated with **UnbelievaBoat's economy**. Users spend coins to open lootboxes and win coin prizes or exclusive roles. Fully admin-configurable.

---

## Features

- **Lootbox purchases** — Users buy 1–5 boxes per command with UnbelievaBoat coins
- **50/50 win/lose odds** — Configurable coin ranges for both outcomes
- **Role prizes** — Finite winner slots, auto-assigned by the bot
- **Cooldown system** — Per-user cooldown (default 1 hour, admin-configurable)
- **24h purchase limit** — 5 boxes/24h while role prizes are active; lifts when roles are claimed
- **Prize announcements** — Embed posted to a dedicated prize channel
- **Audit logging** — Full purchase history with user ID, cost, outcomes, and balance changes
- **Admin-only configuration** — Requires `Manage Server` permission
- **Multi-server support** — All data partitioned by guild ID

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Discord Library | discord.js v14 |
| Database | Azure Cosmos DB |
| Economy API | [UnbelievaBoat REST API](https://github.com/UnbelievaBoat/unb-api/) |
| Hosting | Azure Container |

---

## Project Structure

```
lootbox-bot/
├── Dockerfile
├── package.json
├── deploy-commands.js         # One-time slash command registration
├── src/
│   ├── index.js               # Bot entry point
│   ├── config.js              # Environment variable loader
│   ├── commands/
│   │   ├── buy.js             # /buy command (user-facing)
│   │   ├── lootbox-config.js  # /lootbox config subcommands
│   │   ├── lootbox-prize.js   # /lootbox prize subcommands
│   │   ├── lootbox-reset.js   # /lootbox reset
│   │   └── lootbox-help.js    # /lootbox help
│   ├── services/
│   │   ├── unbelievaboat.js   # UnbelievaBoat API wrapper
│   │   ├── lootbox.js         # Core algorithm (roll, payout)
│   │   └── cooldown.js        # Cooldown + 24h purchase tracking
│   ├── db/
│   │   ├── cosmos.js          # Cosmos DB client init
│   │   ├── guildConfig.js     # CRUD for guild config
│   │   ├── rolePrizes.js      # CRUD for role prizes
│   │   └── userPurchases.js   # CRUD for purchase history
│   ├── embeds/
│   │   ├── resultEmbed.js     # Lootbox result embed builder
│   │   └── auditEmbed.js      # Audit log embed builder
│   └── utils/
│       ├── permissions.js     # Manage Server check helper
│       └── constants.js       # Shared constants
```

---

## Setup

### 1. Prerequisites

- Node.js 20+
- A Discord bot application with these intents enabled:
  - `Guilds`
  - `Guild Members` (privileged — enable in Discord Developer Portal)
- An [UnbelievaBoat API token](https://unbelievaboat.com/api/docs)
- An Azure Cosmos DB account

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_GUILD_ID=your-guild-id          # optional, for dev (instant command registration)

COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your-cosmos-key
COSMOS_DATABASE=lootbox-bot

UNB_API_TOKEN=your-unbelievaboat-token
```

### 3. Install & Run

```bash
npm install
node deploy-commands.js   # Register slash commands with Discord
node src/index.js         # Start the bot
```

### 4. Docker

```bash
docker build -t lootbox-bot .
docker run --env-file .env lootbox-bot
```

---

## Commands

### Admin Commands (Manage Server required)

| Command | Description |
|---|---|
| `/lootbox config price <amount>` | Set lootbox price |
| `/lootbox config coins-win <min> <max>` | Set win coin range |
| `/lootbox config coins-lose <min> <max>` | Set loss coin range (negative to 0) |
| `/lootbox config cooldown <seconds>` | Set per-user cooldown (default 3600s) |
| `/lootbox config prize-channel <#channel>` | Set announcement channel |
| `/lootbox config audit-channel <#channel>` | Set audit log channel |
| `/lootbox config purchase-limit <limit>` | Set post-role purchase limit per 24h (0 = unlimited) |
| `/lootbox config show` | Display current configuration |
| `/lootbox prize add-role <@role> <limit>` | Add a role prize with max winners |
| `/lootbox prize remove-role <@role>` | Remove a role prize |
| `/lootbox prize list` | List all role prizes & remaining slots |
| `/lootbox prize set-max <number>` | Set max prize types (0 = unlimited) |
| `/lootbox reset` | Reset all config, prizes, history & cooldowns |
| `/lootbox help` | Show all admin commands |

### User Command

| Command | Description |
|---|---|
| `/buy <amount>` | Buy 1–5 lootboxes |

---

## Algorithm

```
For each lootbox:
  50% chance → LOSE
    → Random coin amount in [loss_min, loss_max] (negative to 0)

  50% chance → WIN
    → If role prizes available: 50/50 between coins and role
    → If no roles left: 100% coin prize

    COINS: Random amount in [win_min, win_max]
    ROLE:  Random eligible role → auto-assigned, slot decremented
```

### Purchase Limits
- **While role prizes active**: 5 boxes per user per rolling 24h
- **After all roles claimed**: 24h limit lifted (or admin-set custom limit)
- **Cooldown always applies** (default 1 hour) regardless of role status

---

## Data Model (Cosmos DB)

All containers are partitioned by `guildId`.

**guildConfig** — One document per server with all settings

**rolePrizes** — One document per role prize (roleId, maxWinners, remainingWinners)

**userPurchases** — One document per `/buy` invocation (results array, cost, timestamps)

**userCooldowns** — One document per user (lastPurchaseTimestamp)

---

## License

Private — All rights reserved.

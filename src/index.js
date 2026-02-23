const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const config = require('./config');
const { initCosmos } = require('./db/cosmos');
const { initUnbelievaBoat } = require('./services/unbelievaboat');

// Command handlers
const { handleBuy } = require('./commands/buy');
const { handleConfig } = require('./commands/lootbox-config');
const { handlePrize } = require('./commands/lootbox-prize');
const { handleReset } = require('./commands/lootbox-reset');
const { handleHelp } = require('./commands/lootbox-help');
const { handleStock } = require('./commands/stock');
const { handleStats } = require('./commands/lootbox-stats');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // needed for role assignment
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[Bot] Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName } = interaction;

    // --- /buy ---
    if (commandName === 'buy') {
      await handleBuy(interaction);
      return;
    }

    // --- /lootbox <group> <subcommand> ---
    if (commandName === 'lootbox') {
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand(false);

      if (group === 'config') {
        await handleConfig(interaction);
      } else if (group === 'prize') {
        await handlePrize(interaction);
      } else if (sub === 'reset') {
        await handleReset(interaction);
      } else if (sub === 'help') {
        await handleHelp(interaction);
      } else if (sub === 'stock') {
        await handleStock(interaction);
      } else if (sub === 'stats') {
        await handleStats(interaction);
      } else {
        await interaction.reply({ content: '❓ Unknown subcommand.', flags: MessageFlags.Ephemeral });
      }
    }
  } catch (err) {
    console.error('[Bot] Unhandled command error:', err);
    const reply = { content: '❌ An unexpected error occurred.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

async function main() {
  console.log('[Bot] Initialising...');
  await initCosmos();
  initUnbelievaBoat();
  await client.login(config.discordToken);
}

main().catch((err) => {
  console.error('[Bot] Fatal error during startup:', err);
  process.exit(1);
});

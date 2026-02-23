/**
 * One-time script to register slash commands with Discord.
 * Run with: node deploy-commands.js
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./src/config');
const { buildConfigSubcommandGroup } = require('./src/commands/lootbox-config');
const { buildPrizeSubcommandGroup } = require('./src/commands/lootbox-prize');
const { buildBuyCommand } = require('./src/commands/buy');

// --- /lootbox (admin umbrella command) ---
const lootboxCommand = new SlashCommandBuilder()
  .setName('lootbox')
  .setDescription('Lootbox bot commands')
  .addSubcommandGroup(buildConfigSubcommandGroup())
  .addSubcommandGroup(buildPrizeSubcommandGroup())
  .addSubcommand((sub) =>
    sub.setName('reset').setDescription('Reset all lootbox data for this server'),
  )
  .addSubcommand((sub) =>
    sub.setName('help').setDescription('Show all admin commands'),
  )
  .addSubcommand((sub) =>
    sub.setName('stock').setDescription('View lootbox prizes, costs, and remaining stock'),
  )
  .addSubcommand((sub) =>
    sub.setName('stats').setDescription('View server-wide lootbox statistics (admin)'),
  );

// --- /buy (user command) ---
const buyCommand = buildBuyCommand();

const commands = [lootboxCommand.toJSON(), buyCommand.toJSON()];

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);

    if (config.guildId) {
      // Guild-specific (instant, good for development)
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
      console.log(`✅ Registered commands for guild ${config.guildId}`);
    } else {
      // Global (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands },
      );
      console.log('✅ Registered global commands');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();

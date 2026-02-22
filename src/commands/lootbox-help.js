const { EmbedBuilder } = require('discord.js');
const { requireManageServer } = require('../utils/permissions');
const { COLOUR_INFO } = require('../utils/constants');

/**
 * Handle /lootbox help — shows all admin commands.
 */
async function handleHelp(interaction) {
  if (!(await requireManageServer(interaction))) return;

  const embed = new EmbedBuilder()
    .setTitle('📖 Lootbox Bot — Admin Help')
    .setColor(COLOUR_INFO)
    .setDescription('All commands require **Manage Server** permission unless noted.')
    .addFields(
      {
        name: '⚙️ Configuration',
        value: [
          '`/lootbox config price <amount>` — Set lootbox price',
          '`/lootbox config coins-win <min> <max>` — Set win coin range',
          '`/lootbox config coins-lose <min> <max>` — Set loss coin range (negative to 0)',
          '`/lootbox config cooldown <seconds>` — Set per-user cooldown (default 3600s)',
          '`/lootbox config prize-channel <#channel>` — Set announcement channel',
          '`/lootbox config audit-channel <#channel>` — Set audit log channel',
          '`/lootbox config purchase-limit <limit>` — Set post-role purchase limit per 24h (0 = unlimited)',
          '`/lootbox config show` — Display current configuration',
        ].join('\n'),
      },
      {
        name: '🎁 Prizes',
        value: [
          '`/lootbox prize add-role <@role> <winner_limit>` — Add a role prize',
          '`/lootbox prize remove-role <@role>` — Remove a role prize',
          '`/lootbox prize list` — List all role prizes & remaining slots',
          '`/lootbox prize set-max <number>` — Set max prize types (0 = unlimited)',
        ].join('\n'),
      },
      {
        name: '🛠️ Management',
        value: [
          '`/lootbox reset` — Reset all config, prizes, history & cooldowns',
          '`/lootbox help` — Show this help message',
        ].join('\n'),
      },
      {
        name: '🎰 User Command',
        value: '`/buy <amount>` — Buy 1–5 lootboxes (available to everyone)',
      },
      {
        name: '📌 Purchase Limits',
        value: [
          '• While role prizes are active: **5 boxes per user per 24h**',
          '• After all roles are claimed: 24h limit is **lifted** (or uses custom limit if set)',
          '• **Cooldown always applies** between purchases regardless of role status',
        ].join('\n'),
      },
      {
        name: '🎲 Odds',
        value: [
          '• **50%** chance to win, **50%** chance to lose',
          '• On win: **50/50** between coins and role (while roles available)',
          '• On win after roles gone: **100%** coin prize',
          '• On loss: 0 or negative coins (admin-configured range)',
        ].join('\n'),
      },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleHelp };

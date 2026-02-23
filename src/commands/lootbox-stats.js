const { EmbedBuilder, MessageFlags } = require('discord.js');
const { requireManageServer } = require('../utils/permissions');
const { getContainer } = require('../db/cosmos');
const { withRetry } = require('../db/retry');
const { CONTAINER_USER_PURCHASES } = require('../utils/constants');

/**
 * Handle /lootbox stats — shows aggregate server statistics.
 */
async function handleStats(interaction) {
  if (!(await requireManageServer(interaction))) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;

  const stats = await withRetry(async () => {
    const container = getContainer(CONTAINER_USER_PURCHASES);
    const { resources } = await container.items
      .query({
        query: `
          SELECT
            COUNT(1) AS totalPurchases,
            SUM(c.boxCount) AS totalBoxes,
            SUM(c.totalCost) AS totalSpent,
            SUM(c.netCoinChange) AS totalNetChange
          FROM c
          WHERE c.guildId = @guildId
        `,
        parameters: [{ name: '@guildId', value: guildId }],
      })
      .fetchAll();
    return resources[0] || {};
  }, { label: 'getGuildStats' });

  // Breakdown per outcome type
  const breakdown = await withRetry(async () => {
    const container = getContainer(CONTAINER_USER_PURCHASES);
    const { resources } = await container.items
      .query({
        query: 'SELECT c.results FROM c WHERE c.guildId = @guildId',
        parameters: [{ name: '@guildId', value: guildId }],
      })
      .fetchAll();
    return resources;
  }, { label: 'getGuildBreakdown' });

  // Count unique users
  const userDocs = await withRetry(async () => {
    const container = getContainer(CONTAINER_USER_PURCHASES);
    const { resources } = await container.items
      .query({
        query: 'SELECT DISTINCT c.userId FROM c WHERE c.guildId = @guildId',
        parameters: [{ name: '@guildId', value: guildId }],
      })
      .fetchAll();
    return resources;
  }, { label: 'getUniqueUsers' });
  const uniqueUsers = new Set(userDocs.map((d) => d.userId));

  let totalWins = 0;
  let totalLosses = 0;
  let totalRoleWins = 0;
  let totalCoinWins = 0;
  let totalCoinsWon = 0;
  let totalCoinsLost = 0;

  for (const doc of breakdown) {
    if (!doc.results) continue;
    for (const r of doc.results) {
      if (r.outcome === 'WIN_COINS') {
        totalWins++;
        totalCoinWins++;
        totalCoinsWon += r.coins || 0;
      } else if (r.outcome === 'WIN_ROLE') {
        totalWins++;
        totalRoleWins++;
      } else if (r.outcome === 'LOSS') {
        totalLosses++;
        totalCoinsLost += Math.abs(r.coins || 0);
      }
    }
  }

  const totalBoxes = stats.totalBoxes || 0;
  const totalSpent = stats.totalSpent || 0;
  const totalDrained = totalSpent + totalCoinsLost - totalCoinsWon;
  const totalOutcomes = totalWins + totalLosses;
  const winRate = totalOutcomes > 0 ? ((totalWins / totalOutcomes) * 100).toFixed(1) : '0.0';

  // --- Build a polished multi-embed dashboard ---

  // Embed 1: Overview
  const overviewEmbed = new EmbedBuilder()
    .setTitle('📊  Lootbox Dashboard')
    .setDescription('Server-wide lootbox statistics at a glance.')
    .setColor(0x5865f2)
    .addFields(
      {
        name: '```       ACTIVITY       ```',
        value: [
          `> 👥  **Unique Buyers**  ·  \`${uniqueUsers.size}\``,
          `> 📦  **Boxes Opened**  ·  \`${totalBoxes.toLocaleString()}\``,
          `> 🧾  **Purchases**  ·  \`${(stats.totalPurchases || 0).toLocaleString()}\``,
        ].join('\n'),
        inline: false,
      },
    )
    .setTimestamp();

  // Embed 2: Outcomes
  const winBar = totalOutcomes > 0 ? buildBar(totalWins, totalOutcomes, '🟩') : '`No data`';
  const lossBar = totalOutcomes > 0 ? buildBar(totalLosses, totalOutcomes, '🟥') : '`No data`';

  const outcomesEmbed = new EmbedBuilder()
    .setTitle('🎲  Win / Loss Breakdown')
    .setColor(0x57f287)
    .addFields(
      {
        name: `✅  Wins — ${totalWins.toLocaleString()}  (${winRate}%)`,
        value: [
          winBar,
          `> 💰  Coin wins: **${totalCoinWins.toLocaleString()}**`,
          `> 🏆  Role wins: **${totalRoleWins.toLocaleString()}**`,
        ].join('\n'),
        inline: false,
      },
      {
        name: `❌  Losses — ${totalLosses.toLocaleString()}  (${(100 - parseFloat(winRate)).toFixed(1)}%)`,
        value: lossBar,
        inline: false,
      },
    );

  // Embed 3: Economy
  const economyEmbed = new EmbedBuilder()
    .setTitle('💰  Economy Impact')
    .setColor(totalDrained >= 0 ? 0xed4245 : 0x57f287)
    .addFields(
      {
        name: '```      MONEY FLOW      ```',
        value: [
          `> 💸  **Spent on boxes**`,
          `>     \`-${totalSpent.toLocaleString()}\` coins`,
          `> `,
          `> 🟢  **Coins won as prizes**`,
          `>     \`+${totalCoinsWon.toLocaleString()}\` coins`,
          `> `,
          `> 🔴  **Coins lost in boxes**`,
          `>     \`-${totalCoinsLost.toLocaleString()}\` coins`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '━━━━━━━━━━━━━━━━━━━━━━━━━━',
        value: [
          totalDrained >= 0
            ? `> 🏦  **Total coins drained from economy**`
            : `> 🏦  **Total coins injected into economy**`,
          `>     **\`${totalDrained >= 0 ? '-' : '+'}${Math.abs(totalDrained).toLocaleString()}\`** coins`,
        ].join('\n'),
        inline: false,
      },
    );

  await interaction.editReply({ embeds: [overviewEmbed, outcomesEmbed, economyEmbed] });
}

/**
 * Build a visual progress bar using emoji blocks.
 */
function buildBar(value, total, emoji) {
  const barLength = 10;
  const filled = Math.round((value / total) * barLength);
  const empty = barLength - filled;
  return emoji.repeat(filled) + '⬛'.repeat(empty);
}

module.exports = { handleStats };

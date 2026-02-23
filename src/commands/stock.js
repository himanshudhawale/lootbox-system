const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../db/guildConfig');
const { getRolePrizes } = require('../db/rolePrizes');
const {
  COLOUR_INFO,
  DEFAULT_COOLDOWN_SECONDS,
  DEFAULT_PURCHASE_LIMIT_ROLES_ACTIVE,
  WIN_CHANCE,
  ROLE_VS_COINS_CHANCE,
} = require('../utils/constants');

/**
 * Handle /lootbox stock — shows prizes, costs, and remaining stock (available to all users).
 */
async function handleStock(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;
  const cfg = await getGuildConfig(guildId);

  if (!cfg || cfg.price == null) {
    return interaction.editReply({
      content: '⚠️ Lootbox is not configured yet. Ask an admin to run `/lootbox config`.',
    });
  }

  // --- Fetch role prizes ---
  const rolePrizes = await getRolePrizes(guildId);

  // --- Build embed ---
  const embed = new EmbedBuilder()
    .setTitle('🎁 Lootbox Stock')
    .setColor(COLOUR_INFO)
    .setTimestamp();

  // Pricing
  embed.addFields({
    name: '💰 Price per box',
    value: `**${cfg.price.toLocaleString()}** coins`,
    inline: true,
  });

  // Cooldown
  const cd = cfg.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
  const cdText = cd === 0 ? 'None' : formatDuration(cd);
  embed.addFields({
    name: '⏱️ Cooldown',
    value: cdText,
    inline: true,
  });

  // Purchase limit
  const hasActiveRoles = rolePrizes.some((r) => r.remainingWinners > 0);
  let limitText;
  if (cfg.purchaseLimitOverride != null) {
    limitText = `${cfg.purchaseLimitOverride} per 24h (admin override)`;
  } else if (hasActiveRoles) {
    limitText = `${DEFAULT_PURCHASE_LIMIT_ROLES_ACTIVE} per 24h (default · roles in stock)`;
  } else {
    limitText = 'Unlimited';
  }
  embed.addFields({
    name: '📦 Purchase limit',
    value: limitText,
    inline: true,
  });

  // Win odds — use admin-configured win chance or default
  const winPct = Math.round((cfg.winChance ?? WIN_CHANCE) * 100);
  const rolePct = Math.round(ROLE_VS_COINS_CHANCE * 100);
  embed.addFields({
    name: '🎲 Odds',
    value: `**${winPct}%** chance to win · **${100 - winPct}%** chance to lose\nWins: **${rolePct}%** role / **${100 - rolePct}%** coins (when roles in stock)`,
    inline: false,
  });

  // Coin ranges
  const coinLines = [];
  if (cfg.winCoinMin != null && cfg.winCoinMax != null) {
    coinLines.push(`🟢 Win: **${cfg.winCoinMin.toLocaleString()}** – **${cfg.winCoinMax.toLocaleString()}** coins`);
  }
  if (cfg.lossCoinMin != null && cfg.lossCoinMax != null) {
    coinLines.push(`🔴 Lose: **${cfg.lossCoinMin.toLocaleString()}** – **${cfg.lossCoinMax.toLocaleString()}** coins`);
  }
  if (coinLines.length) {
    embed.addFields({ name: '💵 Coin ranges', value: coinLines.join('\n'), inline: false });
  }

  // Role prizes
  if (rolePrizes.length === 0) {
    embed.addFields({ name: '🏆 Role prizes', value: 'None configured', inline: false });
  } else {
    const roleLines = rolePrizes.map((r) => {
      const remaining = r.remainingWinners;
      const max = r.maxWinners;
      const status = remaining > 0
        ? `✅ **${remaining}**/${max} remaining`
        : '❌ Sold out';
      return `<@&${r.roleId}> — ${status}`;
    });
    embed.addFields({ name: '🏆 Role prizes', value: roleLines.join('\n'), inline: false });
  }

  // Footer
  const totalRemaining = rolePrizes.reduce((sum, r) => sum + Math.max(0, r.remainingWinners), 0);
  embed.setFooter({ text: `${totalRemaining} role prize(s) remaining in total` });

  return interaction.editReply({ embeds: [embed] });
}

/**
 * Format seconds into a human-friendly duration string.
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = { handleStock };

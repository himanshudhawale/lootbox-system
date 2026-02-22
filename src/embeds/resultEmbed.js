const { EmbedBuilder } = require('discord.js');
const { COLOUR_WIN, COLOUR_LOSS, COLOUR_INFO } = require('../utils/constants');

/**
 * Build the summary embed shown in the prize channel after a /buy command.
 *
 * @param {object} user - Discord user object
 * @param {number} boxCount
 * @param {number} totalCost
 * @param {number} netCoinChange - sum of all coin outcomes (wins + losses)
 * @param {Array}  results - array of result objects from openBoxes()
 * @param {number} balanceAfter - user's balance after everything
 * @param {number} purchasesLast24h - total boxes opened in last 24h (including this buy)
 * @returns {EmbedBuilder}
 */
function buildResultEmbed(user, boxCount, totalCost, netCoinChange, results, balanceAfter, purchasesLast24h) {
  const lines = results.map((r, i) => {
    const idx = `Box ${i + 1}`;
    switch (r.outcome) {
      case 'LOSS':
        return `${idx}: ❌ LOSS — ${formatCoins(r.coins)} coins`;
      case 'WIN_COINS':
        return `${idx}: ✅ WIN — ${formatCoins(r.coins)} coins`;
      case 'WIN_ROLE':
        return `${idx}: ✅ WIN — 🎭 Role: <@&${r.roleId}> (${r.remainingSlots} slot${r.remainingSlots !== 1 ? 's' : ''} left)`;
      default:
        return `${idx}: ❓ Unknown`;
    }
  });

  const hasWin = results.some((r) => r.outcome.startsWith('WIN'));
  const colour = hasWin ? COLOUR_WIN : COLOUR_LOSS;

  return new EmbedBuilder()
    .setTitle('🎰 Lootbox Results')
    .setColor(colour)
    .setThumbnail(user.displayAvatarURL({ size: 64 }))
    .setDescription(lines.join('\n'))
    .addFields(
      { name: 'Total Cost', value: `${totalCost.toLocaleString()} coins`, inline: true },
      { name: 'Net Coin Change', value: `${formatCoins(netCoinChange)} coins`, inline: true },
      { name: 'Balance After', value: `${balanceAfter.toLocaleString()} coins`, inline: true },
      { name: 'Purchases (24h)', value: `${purchasesLast24h}/5`, inline: true },
    )
    .setFooter({ text: `${user.tag} (${user.id})` })
    .setTimestamp();
}

/**
 * Format a coin amount with a + or − sign.
 */
function formatCoins(amount) {
  if (amount > 0) return `+${amount.toLocaleString()}`;
  if (amount < 0) return amount.toLocaleString(); // negative sign is included
  return '0';
}

module.exports = { buildResultEmbed };

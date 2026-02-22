const { EmbedBuilder } = require('discord.js');
const { COLOUR_AUDIT } = require('../utils/constants');

/**
 * Build the audit log embed posted in the admin audit channel.
 *
 * @param {object} user - Discord user object
 * @param {number} boxCount
 * @param {number} totalCost
 * @param {number} netCoinChange
 * @param {Array}  results
 * @param {number} balanceBefore
 * @param {number} balanceAfter
 * @param {number} purchasesLast24h
 * @returns {EmbedBuilder}
 */
function buildAuditEmbed(user, boxCount, totalCost, netCoinChange, results, balanceBefore, balanceAfter, purchasesLast24h) {
  const lines = results.map((r, i) => {
    const idx = `Box ${i + 1}`;
    switch (r.outcome) {
      case 'LOSS':
        return `${idx}: ❌ LOSS — ${formatCoins(r.coins)} coins`;
      case 'WIN_COINS':
        return `${idx}: ✅ WIN — ${formatCoins(r.coins)} coins`;
      case 'WIN_ROLE':
        return `${idx}: ✅ WIN — 🎭 Role: <@&${r.roleId}> (${r.remainingSlots} left)`;
      default:
        return `${idx}: ❓ Unknown`;
    }
  });

  return new EmbedBuilder()
    .setTitle('📋 Audit Log — Lootbox Purchase')
    .setColor(COLOUR_AUDIT)
    .setThumbnail(user.displayAvatarURL({ size: 64 }))
    .addFields(
      { name: 'User', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
      { name: 'Boxes Opened', value: `${boxCount}`, inline: true },
      { name: 'Total Cost', value: `${totalCost.toLocaleString()} coins`, inline: true },
    )
    .setDescription(lines.join('\n'))
    .addFields(
      { name: 'Net Coin Change', value: `${formatCoins(netCoinChange)} coins`, inline: true },
      { name: 'Balance', value: `${balanceBefore.toLocaleString()} → ${balanceAfter.toLocaleString()}`, inline: true },
      { name: 'Purchases (24h)', value: `${purchasesLast24h}`, inline: true },
    )
    .setFooter({ text: `User: ${user.tag}` })
    .setTimestamp();
}

function formatCoins(amount) {
  if (amount > 0) return `+${amount.toLocaleString()}`;
  if (amount < 0) return amount.toLocaleString();
  return '0';
}

module.exports = { buildAuditEmbed };

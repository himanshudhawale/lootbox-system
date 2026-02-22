const { MessageFlags } = require('discord.js');
const { requireManageServer } = require('../utils/permissions');
const { deleteGuildConfig } = require('../db/guildConfig');
const { deleteAllRolePrizes } = require('../db/rolePrizes');
const { deleteAllPurchases } = require('../db/userPurchases');
const { clearAllCooldowns } = require('../services/cooldown');

/**
 * Handle /lootbox reset — wipes all config, prizes, purchase history, and cooldowns.
 */
async function handleReset(interaction) {
  if (!(await requireManageServer(interaction))) return;

  const guildId = interaction.guildId;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  await Promise.all([
    deleteGuildConfig(guildId),
    deleteAllRolePrizes(guildId),
    deleteAllPurchases(guildId),
    clearAllCooldowns(guildId),
  ]);

  await interaction.editReply('🗑️ All lootbox data has been reset for this server.');
}

module.exports = { handleReset };

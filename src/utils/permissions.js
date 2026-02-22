const { PermissionFlagsBits } = require('discord.js');

/**
 * Returns true if the member has Manage Guild permission.
 */
function hasManageServer(interaction) {
  return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Sends an ephemeral "no permission" reply and returns false,
 * or returns true if the user has the required permission.
 */
async function requireManageServer(interaction) {
  if (!hasManageServer(interaction)) {
    await interaction.reply({
      content: '❌ You need the **Manage Server** permission to use this command.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

module.exports = { hasManageServer, requireManageServer };

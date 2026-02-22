const { SlashCommandSubcommandGroupBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { requireManageServer } = require('../utils/permissions');
const { getGuildConfig } = require('../db/guildConfig');
const { getRolePrizes, addRolePrize, removeRolePrize } = require('../db/rolePrizes');
const { COLOUR_INFO } = require('../utils/constants');

/**
 * Build the "prize" subcommand group for /lootbox.
 */
function buildPrizeSubcommandGroup() {
  return new SlashCommandSubcommandGroupBuilder()
    .setName('prize')
    .setDescription('Manage role prizes')
    .addSubcommand((sub) =>
      sub
        .setName('add-role')
        .setDescription('Add a role as a lootbox prize')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('The role to award').setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('winner_limit')
            .setDescription('Maximum number of winners for this role')
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-role')
        .setDescription('Remove a role prize')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('The role to remove').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all configured role prizes and remaining slots'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set-max')
        .setDescription('Set the maximum number of prize types allowed')
        .addIntegerOption((opt) =>
          opt
            .setName('number')
            .setDescription('Max prize types (0 = unlimited)')
            .setRequired(true)
            .setMinValue(0),
        ),
    );
}

/**
 * Handle /lootbox prize <subcommand> interactions.
 */
async function handlePrize(interaction) {
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  switch (sub) {
    case 'add-role': {
      const role = interaction.options.getRole('role');
      const winnerLimit = interaction.options.getInteger('winner_limit');

      // Check max prize types
      const cfg = await getGuildConfig(guildId);
      const existingPrizes = await getRolePrizes(guildId);

      if (cfg?.maxPrizeTypes && existingPrizes.length >= cfg.maxPrizeTypes) {
        await interaction.reply({
          content: `❌ Maximum prize types reached (${cfg.maxPrizeTypes}). Remove one first or increase the limit.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await addRolePrize(guildId, role.id, role.name, winnerLimit);
      await interaction.reply({
        content: `✅ Added role prize **${role.name}** with **${winnerLimit}** winner slot${winnerLimit !== 1 ? 's' : ''}.`,
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case 'remove-role': {
      const role = interaction.options.getRole('role');
      const removed = await removeRolePrize(guildId, role.id);
      if (removed) {
        await interaction.reply({ content: `✅ Removed role prize **${role.name}**.`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `⚠️ Role **${role.name}** was not a configured prize.`, flags: MessageFlags.Ephemeral });
      }
      break;
    }

    case 'list': {
      const prizes = await getRolePrizes(guildId);
      if (prizes.length === 0) {
        await interaction.reply({ content: '📭 No role prizes configured.', flags: MessageFlags.Ephemeral });
        return;
      }

      const lines = prizes.map(
        (p) =>
          `<@&${p.roleId}> — **${p.remainingWinners}**/${p.maxWinners} slots remaining`,
      );

      const embed = new EmbedBuilder()
        .setTitle('🎁 Role Prizes')
        .setColor(COLOUR_INFO)
        .setDescription(lines.join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      break;
    }

    case 'set-max': {
      const num = interaction.options.getInteger('number');
      const { upsertGuildConfig } = require('../db/guildConfig');
      await upsertGuildConfig(guildId, { maxPrizeTypes: num === 0 ? null : num });
      const msg = num === 0
        ? '✅ Max prize types set to **unlimited**.'
        : `✅ Max prize types set to **${num}**.`;
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      break;
    }
  }
}

module.exports = { buildPrizeSubcommandGroup, handlePrize };

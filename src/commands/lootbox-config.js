const { SlashCommandSubcommandGroupBuilder } = require('discord.js');
const { requireManageServer } = require('../utils/permissions');
const { getGuildConfig, upsertGuildConfig } = require('../db/guildConfig');
const { COLOUR_INFO } = require('../utils/constants');
const { EmbedBuilder } = require('discord.js');

/**
 * Build the "config" subcommand group for /lootbox.
 */
function buildConfigSubcommandGroup() {
  return new SlashCommandSubcommandGroupBuilder()
    .setName('config')
    .setDescription('Configure the lootbox bot settings')
    .addSubcommand((sub) =>
      sub
        .setName('price')
        .setDescription('Set the cost per lootbox')
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Price in coins').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('coins-win')
        .setDescription('Set the coin win range')
        .addIntegerOption((opt) =>
          opt.setName('min').setDescription('Minimum coins won').setRequired(true).setMinValue(1),
        )
        .addIntegerOption((opt) =>
          opt.setName('max').setDescription('Maximum coins won').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('coins-lose')
        .setDescription('Set the coin loss range (negative to 0)')
        .addIntegerOption((opt) =>
          opt.setName('min').setDescription('Most coins lost (negative, e.g. -500)').setRequired(true).setMaxValue(0),
        )
        .addIntegerOption((opt) =>
          opt.setName('max').setDescription('Least coins lost (0 = can lose nothing)').setRequired(true).setMaxValue(0),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set the per-user cooldown between purchases')
        .addIntegerOption((opt) =>
          opt.setName('seconds').setDescription('Cooldown in seconds (default 3600)').setRequired(true).setMinValue(0),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('prize-channel')
        .setDescription('Set the channel for prize announcements')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Prize announcement channel').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('audit-channel')
        .setDescription('Set the channel for admin audit logs')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Audit log channel').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('purchase-limit')
        .setDescription('Set a custom purchase limit per 24h (after roles are gone)')
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Max boxes per 24h (0 = unlimited)')
            .setRequired(true)
            .setMinValue(0),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Display the current configuration'),
    );
}

/**
 * Handle /lootbox config <subcommand> interactions.
 */
async function handleConfig(interaction) {
  if (!(await requireManageServer(interaction))) return;

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  switch (sub) {
    case 'price': {
      const amount = interaction.options.getInteger('amount');
      await upsertGuildConfig(guildId, { price: amount });
      await interaction.reply({ content: `✅ Lootbox price set to **${amount.toLocaleString()}** coins.`, ephemeral: true });
      break;
    }

    case 'coins-win': {
      const min = interaction.options.getInteger('min');
      const max = interaction.options.getInteger('max');
      if (min > max) {
        await interaction.reply({ content: '❌ Min must be ≤ Max.', ephemeral: true });
        return;
      }
      await upsertGuildConfig(guildId, { winCoinMin: min, winCoinMax: max });
      await interaction.reply({ content: `✅ Win coin range set to **${min.toLocaleString()}** – **${max.toLocaleString()}**.`, ephemeral: true });
      break;
    }

    case 'coins-lose': {
      const min = interaction.options.getInteger('min');
      const max = interaction.options.getInteger('max');
      if (min > max) {
        await interaction.reply({ content: '❌ Min must be ≤ Max (e.g. min: -500, max: 0).', ephemeral: true });
        return;
      }
      await upsertGuildConfig(guildId, { lossCoinMin: min, lossCoinMax: max });
      await interaction.reply({ content: `✅ Loss coin range set to **${min.toLocaleString()}** – **${max.toLocaleString()}**.`, ephemeral: true });
      break;
    }

    case 'cooldown': {
      const seconds = interaction.options.getInteger('seconds');
      await upsertGuildConfig(guildId, { cooldownSeconds: seconds });
      await interaction.reply({ content: `✅ Cooldown set to **${seconds}** seconds.`, ephemeral: true });
      break;
    }

    case 'prize-channel': {
      const channel = interaction.options.getChannel('channel');
      await upsertGuildConfig(guildId, { prizeChannelId: channel.id });
      await interaction.reply({ content: `✅ Prize channel set to <#${channel.id}>.`, ephemeral: true });
      break;
    }

    case 'audit-channel': {
      const channel = interaction.options.getChannel('channel');
      await upsertGuildConfig(guildId, { auditChannelId: channel.id });
      await interaction.reply({ content: `✅ Audit log channel set to <#${channel.id}>.`, ephemeral: true });
      break;
    }

    case 'purchase-limit': {
      const limit = interaction.options.getInteger('limit');
      await upsertGuildConfig(guildId, { purchaseLimitOverride: limit === 0 ? null : limit });
      const msg = limit === 0
        ? '✅ Post-role purchase limit removed (unlimited).'
        : `✅ Post-role purchase limit set to **${limit}** per 24h.`;
      await interaction.reply({ content: msg, ephemeral: true });
      break;
    }

    case 'show': {
      const cfg = await getGuildConfig(guildId);
      if (!cfg) {
        await interaction.reply({ content: '⚠️ No configuration found. Use `/lootbox config` subcommands to set up.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Lootbox Configuration')
        .setColor(COLOUR_INFO)
        .addFields(
          { name: 'Price', value: cfg.price != null ? `${cfg.price.toLocaleString()} coins` : 'Not set', inline: true },
          { name: 'Win Range', value: cfg.winCoinMin != null ? `${cfg.winCoinMin.toLocaleString()} – ${cfg.winCoinMax.toLocaleString()}` : 'Not set', inline: true },
          { name: 'Loss Range', value: cfg.lossCoinMin != null ? `${cfg.lossCoinMin.toLocaleString()} – ${cfg.lossCoinMax.toLocaleString()}` : 'Not set', inline: true },
          { name: 'Cooldown', value: `${cfg.cooldownSeconds}s`, inline: true },
          { name: 'Prize Channel', value: cfg.prizeChannelId ? `<#${cfg.prizeChannelId}>` : 'Not set', inline: true },
          { name: 'Audit Channel', value: cfg.auditChannelId ? `<#${cfg.auditChannelId}>` : 'Not set', inline: true },
          { name: 'Max Prize Types', value: cfg.maxPrizeTypes != null ? `${cfg.maxPrizeTypes}` : 'Unlimited', inline: true },
          { name: 'Post-Role Limit', value: cfg.purchaseLimitOverride != null ? `${cfg.purchaseLimitOverride}/24h` : 'Unlimited', inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
  }
}

module.exports = { buildConfigSubcommandGroup, handleConfig };

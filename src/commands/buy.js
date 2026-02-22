const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../db/guildConfig');
const { hasActiveRolePrizes } = require('../db/rolePrizes');
const { getBoxesOpenedLast24h, recordPurchase } = require('../db/userPurchases');
const { checkCooldown, setCooldown } = require('../services/cooldown');
const { getBalance, deductCost } = require('../services/unbelievaboat');
const { openBoxes } = require('../services/lootbox');
const { buildResultEmbed } = require('../embeds/resultEmbed');
const { buildAuditEmbed } = require('../embeds/auditEmbed');
const { playOpenAnimation } = require('../embeds/animation');
const { DEFAULT_PURCHASE_LIMIT_ROLES_ACTIVE } = require('../utils/constants');

/**
 * Build the /buy slash command.
 */
function buildBuyCommand() {
  return new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy lootboxes!')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of lootboxes to buy (1–5)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5),
    );
}

/**
 * Handle /buy <amount>
 */
async function handleBuy(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger('amount');

  // --- Validate guild config exists ---
  const cfg = await getGuildConfig(guildId);
  if (!cfg || cfg.price == null || cfg.winCoinMin == null || cfg.lossCoinMin == null) {
    await interaction.reply({
      content: '❌ Lootbox is not configured yet. Ask an admin to set up with `/lootbox config`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // --- Cooldown check ---
  const { onCooldown, remainingMs } = await checkCooldown(guildId, userId, cfg.cooldownSeconds);
  if (onCooldown) {
    const mins = Math.ceil(remainingMs / 60000);
    const secs = Math.ceil(remainingMs / 1000);
    const display = secs >= 120 ? `${mins} minute${mins !== 1 ? 's' : ''}` : `${secs} second${secs !== 1 ? 's' : ''}`;
    await interaction.reply({
      content: `⏳ You're on cooldown. Try again in **${display}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // --- 24h purchase limit check ---
  const rolesActive = await hasActiveRolePrizes(guildId);
  const boxesLast24h = await getBoxesOpenedLast24h(guildId, userId);

  let effectiveLimit = null; // null = unlimited
  if (cfg.purchaseLimitOverride != null) {
    effectiveLimit = cfg.purchaseLimitOverride; // admin override always wins
  } else if (rolesActive) {
    effectiveLimit = DEFAULT_PURCHASE_LIMIT_ROLES_ACTIVE; // default 5 when roles in stock
  }

  if (effectiveLimit != null && boxesLast24h + amount > effectiveLimit) {
    const remaining = Math.max(0, effectiveLimit - boxesLast24h);
    await interaction.reply({
      content: `❌ You can only open **${effectiveLimit}** boxes per 24h. You have **${remaining}** remaining.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // --- Balance check & deduct ---
  const totalCost = amount * cfg.price;
  let balanceBefore;
  try {
    balanceBefore = await getBalance(guildId, userId);
  } catch (err) {
    console.error('[Buy] Failed to get balance:', err.message);
    await interaction.reply({ content: '❌ Failed to check your balance. Try again later.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (balanceBefore < totalCost) {
    await interaction.reply({
      content: `❌ Insufficient funds. You need **${totalCost.toLocaleString()}** coins but only have **${balanceBefore.toLocaleString()}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Defer reply since box opening may take a moment
  await interaction.deferReply();

  try {
    await deductCost(guildId, userId, totalCost);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_FUNDS') {
      await interaction.editReply('❌ Insufficient funds (balance changed since check).');
      return;
    }
    console.error('[Buy] Failed to deduct cost:', err.message);
    await interaction.editReply('❌ Failed to process payment. Try again later.');
    return;
  }

  // --- Open boxes ---
  let results;
  try {
    results = await openBoxes(guildId, userId, amount, cfg, interaction);
  } catch (err) {
    console.error('[Buy] Error opening boxes:', err);
    await interaction.editReply('❌ Something went wrong while opening your lootboxes. Your cost has been deducted — contact an admin.');
    return;
  }

  // --- Calculate net coin change ---
  const netCoinChange = results.reduce((sum, r) => sum + (r.coins || 0), 0);

  // --- Get updated balance ---
  let balanceAfter;
  try {
    balanceAfter = await getBalance(guildId, userId);
  } catch {
    balanceAfter = balanceBefore - totalCost + netCoinChange; // estimate
  }

  const purchasesLast24h = boxesLast24h + amount;

  // --- Record purchase ---
  try {
    await recordPurchase(guildId, userId, totalCost, netCoinChange, results);
  } catch (err) {
    console.error('[Buy] Failed to record purchase:', err.message);
  }

  // --- Set cooldown ---
  try {
    await setCooldown(guildId, userId);
  } catch (err) {
    console.error('[Buy] Failed to set cooldown:', err.message);
  }

  // --- Build result embed ---
  const resultEmbed = buildResultEmbed(
    interaction.user, amount, totalCost, netCoinChange, results, balanceAfter, purchasesLast24h,
  );

  // --- Play opening animation then reveal final results ---
  await playOpenAnimation(interaction, amount, results, resultEmbed);

  // --- Post to prize channel ---
  if (cfg.prizeChannelId) {
    try {
      const prizeChannel = interaction.guild.channels.cache.get(cfg.prizeChannelId) ||
        (await interaction.guild.channels.fetch(cfg.prizeChannelId));
      if (prizeChannel) {
        await prizeChannel.send({ embeds: [resultEmbed] });
      }
    } catch (err) {
      console.error('[Buy] Failed to post to prize channel:', err.message);
    }
  }

  // --- Post audit log ---
  if (cfg.auditChannelId) {
    try {
      const auditEmbed = buildAuditEmbed(
        interaction.user, amount, totalCost, netCoinChange, results, balanceBefore, balanceAfter, purchasesLast24h,
      );
      const auditChannel = interaction.guild.channels.cache.get(cfg.auditChannelId) ||
        (await interaction.guild.channels.fetch(cfg.auditChannelId));
      if (auditChannel) {
        await auditChannel.send({ embeds: [auditEmbed] });
      }
    } catch (err) {
      console.error('[Buy] Failed to post audit log:', err.message);
    }
  }
}

module.exports = { buildBuyCommand, handleBuy };

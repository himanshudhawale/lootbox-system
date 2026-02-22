const { WIN_CHANCE, ROLE_VS_COINS_CHANCE } = require('../utils/constants');
const { getEligibleRolePrizes, decrementRolePrize } = require('../db/rolePrizes');
const { modifyBalance } = require('./unbelievaboat');

/**
 * Random integer between min and max (inclusive).
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Open a single lootbox and return the result object.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {object} guildConfig - the guild's config document
 * @param {object} interaction - Discord interaction (for role assignment)
 * @returns {object} { outcome: 'WIN_COINS'|'WIN_ROLE'|'LOSS', coins?, roleId?, roleName? }
 */
async function openBox(guildId, userId, guildConfig, interaction) {
  const roll = Math.random();

  // --- LOSE ---
  if (roll >= WIN_CHANCE) {
    const coinResult = randomInt(guildConfig.lossCoinMin, guildConfig.lossCoinMax); // negative-to-0 range
    if (coinResult !== 0) {
      await modifyBalance(guildId, userId, coinResult);
    }
    return { outcome: 'LOSS', coins: coinResult };
  }

  // --- WIN ---
  const eligibleRoles = await getEligibleRolePrizes(guildId);

  // Filter out roles the user already has (prevent duplicate role wins)
  let member = null;
  let availableRoles = eligibleRoles;
  if (eligibleRoles.length > 0) {
    try {
      member = interaction.guild.members.cache.get(userId) ||
        (await interaction.guild.members.fetch(userId));
      availableRoles = eligibleRoles.filter((r) => !member.roles.cache.has(r.roleId));
    } catch (err) {
      console.error('[Lootbox] Failed to fetch member for role check:', err.message);
    }
  }

  let pickType = 'COINS';
  if (availableRoles.length > 0 && Math.random() < ROLE_VS_COINS_CHANCE) {
    pickType = 'ROLE';
  }

  if (pickType === 'COINS') {
    const coinResult = randomInt(guildConfig.winCoinMin, guildConfig.winCoinMax);
    await modifyBalance(guildId, userId, coinResult);
    return { outcome: 'WIN_COINS', coins: coinResult };
  }

  // --- WIN ROLE ---
  const chosenRole = availableRoles[Math.floor(Math.random() * availableRoles.length)];
  const updated = await decrementRolePrize(guildId, chosenRole.roleId);

  if (!updated) {
    // Race condition: slots filled between check and decrement — fallback to coins
    const coinResult = randomInt(guildConfig.winCoinMin, guildConfig.winCoinMax);
    await modifyBalance(guildId, userId, coinResult);
    return { outcome: 'WIN_COINS', coins: coinResult };
  }

  // Auto-assign role (member already fetched above)
  try {
    if (!member) {
      member = interaction.guild.members.cache.get(userId) ||
        (await interaction.guild.members.fetch(userId));
    }
    await member.roles.add(chosenRole.roleId);
  } catch (err) {
    console.error(`[Lootbox] Failed to assign role ${chosenRole.roleId} to ${userId}:`, err.message);
    // Still count as a role win even if auto-assign fails — audit log will show it
  }

  return {
    outcome: 'WIN_ROLE',
    roleId: chosenRole.roleId,
    roleName: chosenRole.roleName,
    remainingSlots: updated.remainingWinners,
  };
}

/**
 * Open N lootboxes. Returns an array of result objects.
 */
async function openBoxes(guildId, userId, count, guildConfig, interaction) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = await openBox(guildId, userId, guildConfig, interaction);
    results.push(result);
  }
  return results;
}

module.exports = { openBoxes };

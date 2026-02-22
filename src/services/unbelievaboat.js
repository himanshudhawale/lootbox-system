const { Client } = require('unb-api');
const config = require('../config');

let unbClient;

/**
 * Initialise the UnbelievaBoat API client.
 */
function initUnbelievaBoat() {
  unbClient = new Client(config.unbApiToken);
  console.log('[UnbelievaBoat] API client ready.');
}

/**
 * Get a user's cash balance.
 */
async function getBalance(guildId, userId) {
  const user = await unbClient.getUserBalance(guildId, userId);
  return user.cash;
}

/**
 * Add coins to a user (positive amount) or remove coins (negative amount).
 * Uses the cash balance. Returns the updated balance object.
 */
async function modifyBalance(guildId, userId, amount) {
  if (amount >= 0) {
    return unbClient.editUserBalance(guildId, userId, { cash: amount });
  }
  // For negative amounts, use editUserBalance with negative cash
  return unbClient.editUserBalance(guildId, userId, { cash: amount });
}

/**
 * Deduct a flat cost from the user. Throws if insufficient funds.
 * Returns the updated balance.
 */
async function deductCost(guildId, userId, cost) {
  const balance = await getBalance(guildId, userId);
  if (balance < cost) {
    const err = new Error('Insufficient balance');
    err.code = 'INSUFFICIENT_FUNDS';
    err.balance = balance;
    err.cost = cost;
    throw err;
  }
  return modifyBalance(guildId, userId, -cost);
}

module.exports = { initUnbelievaBoat, getBalance, modifyBalance, deductCost };

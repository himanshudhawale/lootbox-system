const { EmbedBuilder } = require('discord.js');
const { COLOUR_INFO } = require('../utils/constants');

const FRAME_DELAY_MS = 1200;

/**
 * Utility to sleep for a given number of ms.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Play an "unboxing" animation by editing the interaction reply through
 * several frames, then reveal the final result embed.
 *
 * @param {ChatInputCommandInteraction} interaction - already deferred
 * @param {number} boxCount - number of boxes being opened
 * @param {Array}  results  - the actual results array (used for per-box reveal)
 * @param {EmbedBuilder} finalEmbed - the full result embed to show at the end
 */
async function playOpenAnimation(interaction, boxCount, results, finalEmbed) {
  // --- Frame 1: Shaking boxes ---
  const frame1 = new EmbedBuilder()
    .setColor(COLOUR_INFO)
    .setTitle('🎰 Lootbox')
    .setDescription(
      `${boxShake(boxCount)}\n\n` +
      `**Preparing ${boxCount} lootbox${boxCount > 1 ? 'es' : ''}...**`
    );
  await interaction.editReply({ embeds: [frame1] });
  await sleep(FRAME_DELAY_MS);

  // --- Frame 2: Boxes rumbling ---
  const frame2 = new EmbedBuilder()
    .setColor(COLOUR_INFO)
    .setTitle('🎰 Lootbox')
    .setDescription(
      `${boxRumble(boxCount)}\n\n` +
      `**The box${boxCount > 1 ? 'es are' : ' is'} shaking...**\n` +
      spinner(0)
    );
  await interaction.editReply({ embeds: [frame2] });
  await sleep(FRAME_DELAY_MS);

  // --- Frames 3+: Reveal each box one by one ---
  const revealedLines = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    revealedLines.push(formatRevealLine(i + 1, r));

    const remaining = boxCount - (i + 1);
    const unopened = remaining > 0
      ? `\n\n${closedBoxes(remaining)} **${remaining}** box${remaining !== 1 ? 'es' : ''} remaining...`
      : '';

    const frame = new EmbedBuilder()
      .setColor(COLOUR_INFO)
      .setTitle('🎰 Opening Lootboxes...')
      .setDescription(
        revealedLines.join('\n') +
        unopened +
        (remaining > 0 ? '\n' + spinner(i + 1) : '')
      );
    await interaction.editReply({ embeds: [frame] });

    if (i < results.length - 1) {
      await sleep(FRAME_DELAY_MS);
    }
  }

  // --- Final frame: Full results ---
  await sleep(800);
  await interaction.editReply({ embeds: [finalEmbed] });
}

/**
 * Format one result line for the per-box reveal.
 */
function formatRevealLine(idx, result) {
  switch (result.outcome) {
    case 'LOSS': {
      const coins = result.coins;
      const display = coins === 0 ? '0' : coins.toLocaleString();
      return `📦 Box ${idx}: ❌ **${display} coins**`;
    }
    case 'WIN_COINS':
      return `📦 Box ${idx}: ✅ **+${result.coins.toLocaleString()} coins**`;
    case 'WIN_ROLE':
      return `📦 Box ${idx}: ✅ 🎭 **Role: <@&${result.roleId}>**`;
    default:
      return `📦 Box ${idx}: ❓`;
  }
}

/**
 * Closed box emojis for N boxes.
 */
function closedBoxes(n) {
  return '🎁'.repeat(Math.min(n, 5));
}

/**
 * Shaking box display.
 */
function boxShake(n) {
  const boxes = [];
  for (let i = 0; i < Math.min(n, 5); i++) {
    boxes.push(i % 2 === 0 ? '📦' : '🎁');
  }
  return boxes.join(' ');
}

/**
 * Rumbling box display.
 */
function boxRumble(n) {
  const frames = ['💥', '📦', '✨', '🎁', '💫'];
  const boxes = [];
  for (let i = 0; i < Math.min(n, 5); i++) {
    boxes.push(frames[i % frames.length]);
  }
  return boxes.join(' ');
}

/**
 * Spinner text based on frame index.
 */
function spinner(frameIdx) {
  const spinners = ['⏳ ░░░░░░░░░░', '⏳ ███░░░░░░░', '⏳ █████░░░░░', '⏳ ████████░░', '⏳ ██████████'];
  return spinners[Math.min(frameIdx, spinners.length - 1)];
}

module.exports = { playOpenAnimation };

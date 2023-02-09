// eslint-disable-next-line no-unused-vars
const { Guild } = require('discord.js')

/**
 * Generates the post body of a leaderboard
 * @param {Object} leaderboard The leaderboard object
 * @return {String} The contents of the leaderboard message
 */
function generateLeaderboardPost (leaderboard) {
  const content = `**__${leaderboard.title}__**`
  const userLines = Object.entries(leaderboard.scores).sort((b, a) => {
    // Return the number of items associated with the key, or the score associated with it
    return (a[1].length || a[1]) - (b[1].length || b[1])
  }).map(([userID, score], index) => `${index + 1}. <@${userID}>: ${score.length || score}`).join('\n')
  if (!userLines) return content + '\n\nNothing here yet!'

  return `${content}\n\n${userLines}`
}

/**
 * Gets a message associated with a leaderboard
 * @param {Object} leaderboard The leaderboard object
 * @param {Guild} guild The guild that the leaderboard belongs to
 */
async function getLeaderboardMessage (leaderboard, guild) {
  const channel = await guild.channels.fetch(leaderboard.channelID)
  const message = await channel?.messages?.fetch(leaderboard.messageID)
    .catch(() => {})
  return message
}

/**
 * Updates a leaderboard post
 * @param {Object} leaderboard The leaderboard object
 * @param {Guild} guild The guild that the leaderboard belongs to
 */
async function updateLeaderboardPost (leaderboard, guild) {
  const message = await getLeaderboardMessage(leaderboard, guild)
  if (!message) return // Nothing to update
  message.edit(generateLeaderboardPost(leaderboard))
}

module.exports = { generateLeaderboardPost, updateLeaderboardPost, getLeaderboardMessage }

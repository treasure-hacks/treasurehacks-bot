// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Responds to the user with the number of points they have, that is, the number of messages
 * they sent plus 15 times the number of weekly challenges they have participated in and 20
 * times the number of workshops they have attended.
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function respondWithPoints (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const userID = interaction.member.id
  let points = 0
  let messages = 0
  let weekly = 0
  if (serverConfig.messageCounter) {
    points += messages = serverConfig.messageCounter.counts[userID] || 0
  }
  /** @todo sometime later, maybe make the leaderboard name/typeconfigurable */
  const weeklyLeaderboard = serverConfig.leaderboards?.weekly?.scores
  if (weeklyLeaderboard && weeklyLeaderboard[userID]) {
    const count = weeklyLeaderboard[userID].length || weeklyLeaderboard[userID] || 0
    points += weekly = count * 15
  }

  /** @todo Add workshop attendance counter, and leave a similar @todo doc in place of this one */
  const attendance = serverConfig.attendance || {}
  const workshops = Object.values(attendance).filter(w => w.find(p => p === userID)).length
  points += workshops * 20

  const plural = points === 1 ? '' : 's'
  interaction.reply({
    content: '',
    embeds: [{
      title: '📊 Point Counter',
      description: `You have ${points} point${plural} in ${interaction.guild.name}`,
      fields: [
        { name: 'Messages', value: `${messages} sent`, inline: true },
        { name: 'Weekly Challenges', value: `${weekly / 15} completed`, inline: true },
        { name: 'Workshops', value: `${workshops} attended`, inline: true }
      ]
    }],
    ephemeral: true
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('Gets the number of points you have in the server'),
  execute: async (interaction, client) => {
    return respondWithPoints(interaction, client)
  }
}

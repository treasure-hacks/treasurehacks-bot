// eslint-disable-next-line no-unused-vars
const { ModalSubmitInteraction } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
// const { getAlertsChannel, sendMessageAsync } = require('../modules/message')
const { getLeaderboard, updateLeaderboardPost, getLeaderboardMessage } = require('../scripts/leaderboard')

/**
 * Adds a post to a leaderboard
 * @param {ModalSubmitInteraction} interaction The modal interaction
 */
async function addPostToLeaderboard (interaction) {
  const messageID = interaction.extension
  const message = await interaction.channel.messages.fetch(messageID).catch(() => {})
  if (!message) {
    return interaction.reply({
      content: 'That message could not be found',
      ephemeral: true
    })
  }

  // Get the leaderboard
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const name = interaction.fields.getTextInputValue('modal_txt_leaderboard_name')
  const leaderboard = await getLeaderboard(serverConfig, name)
  if (!leaderboard) {
    return interaction.reply({
      content: `No such leaderboard with name ${name} exists`,
      ephemeral: true
    })
  }
  if (leaderboard.type !== 'post') {
    return interaction.reply({
      content: 'Leaderboard is not a post leaderboard',
      ephemeral: true
    })
  }

  // Add the score in the object
  const userScore = leaderboard.scores[message.member.id] || []
  leaderboard.scores[message.member.id] = userScore
  if (userScore.find(m => m.messageID === messageID)) {
    return interaction.reply({
      content: 'This message has already been counted',
      ephemeral: true
    })
  }
  userScore.push({ channelID: interaction.channel.id, messageID })

  // Update remotely
  updateLeaderboardPost(leaderboard, interaction.guild)
  await serverSettingsDB.put(serverConfig)
  const lm = await getLeaderboardMessage(leaderboard, interaction.guild)
  interaction.reply({
    embeds: [{
      title: 'Leaderboard Updated',
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Title', value: leaderboard.title, inline: true },
        { name: 'Message Link', value: lm ? `[#${lm.channel.name}](${lm.url})` : '<None>', inline: true }
      ],
      color: 0x0077cc
    }]
  })
}

/**
 * Replies to a modal submission
 * @param {ModalSubmitInteraction} interaction The modal interaction
 */
async function addUserToLeaderboard (interaction) {
  const userID = interaction.extension
  if (!userID) {
    interaction.reply({
      content: 'Somehow unable to get the user',
      ephemeral: true
    })
  }

  // Get the leaderboard
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const name = interaction.fields.getTextInputValue('modal_txt_leaderboard_name')
  const amount = parseInt(interaction.fields.getTextInputValue('modal_txt_leaderboard_amount')) || 1
  const leaderboard = await getLeaderboard(serverConfig, name)
  if (!leaderboard) {
    return interaction.reply({
      content: `No such leaderboard with name ${name} exists`,
      ephemeral: true
    })
  }
  if (leaderboard.type !== 'user') {
    return interaction.reply({
      content: 'Leaderboard is not a user leaderboard',
      ephemeral: true
    })
  }

  // Add the score in the object
  const userScore = leaderboard.scores[userID] || 0
  leaderboard.scores[userID] = userScore + amount

  // Update remotely
  updateLeaderboardPost(leaderboard, interaction.guild)
  await serverSettingsDB.put(serverConfig)
  const lm = await getLeaderboardMessage(leaderboard, interaction.guild)
  interaction.reply({
    embeds: [{
      title: 'Leaderboard Updated',
      fields: [
        { name: 'Name', value: name, inline: true },
        { name: 'Title', value: leaderboard.title, inline: true },
        { name: 'Message Link', value: lm ? `[#${lm.channel.name}](${lm.url})` : '<None>', inline: true }
      ],
      color: 0x0077cc
    }]
  })
}

module.exports = [
  { name: 'modal_root_leaderboard_message', handler: addPostToLeaderboard },
  { name: 'modal_root_leaderboard_user', handler: addUserToLeaderboard }
]

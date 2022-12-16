// eslint-disable-next-line no-unused-vars
const { SlashCommandBuilder, Client, ChatInputCommandInteraction, PermissionFlagsBits } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Replies with who has helped others the most times
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function replyWithMostHelpful (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const helpfulMessages = serverConfig.helpfulMessages || []

  const users = [...new Set(helpfulMessages.map(m => m.user))]
  const texts = users.map(id => {
    const occurrences = helpfulMessages.filter(m => m.user === id).length
    const s = occurrences === 1 ? '' : 's'
    return `<@!${id}> helped others ${occurrences} time${s}`
  })

  interaction.reply({
    content: texts.join('\n') || 'No messages have been marked helpful'
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('most-helpful')
    .setDescription('Gets a list of people who have helped others')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction, client) => {
    return replyWithMostHelpful(interaction, client)
  }
}

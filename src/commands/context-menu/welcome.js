// eslint-disable-next-line no-unused-vars
const { Client, PermissionFlagsBits, MessageContextMenuCommandInteraction, ApplicationCommandType, ContextMenuCommandBuilder } = require('discord.js')

/**
 * Responds to getting users
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function compileTags (interaction, client) {
  const channel = interaction.channel
  const newerMessages = await channel.messages.fetch({ after: interaction.targetMessage.id, limit: 100 })
  await interaction.guild.members.fetch() // refresh
  const messages = [interaction.targetMessage, ...newerMessages.map(x => x)]
  const users = [...new Set(messages.map(m => m.member?.id))]
  const mentions = users.map(userID => userID ? `<@${userID}>` : '')
    .filter(x => !!x).join(', ')
  interaction.reply({
    content: mentions ? `\`${mentions}\`` : 'No mentions',
    ephemeral: true
  })
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Compile Tags')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: compileTags
}

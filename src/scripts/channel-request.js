const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
// eslint-disable-next-line no-unused-vars
const { ModalSubmitInteraction, PermissionsBitField, ChannelType } = require('discord.js')

function clearChannelRequestButtons (components) {
  return components.filter(c => {
    if (c.type === 1) c.components = clearChannelRequestButtons(c.components)
    const isChannelRequestHandler = c.data?.custom_id?.includes('btn_channel_request_')
    const isEmptyComponentRow = c.type === 1 && !c.components.length
    return !isChannelRequestHandler && !isEmptyComponentRow
  })
}

async function editMessageIfNeeded (message, color) {
  const embed = message.embeds[0]
  const newComponents = clearChannelRequestButtons(message.components)

  // There's other components in this bot message; only remove the action button
  if (newComponents.length > 0) {
    await message.edit({
      embeds: message.embeds,
      components: newComponents
    })
    return false
  }

  embed.data.color = color
  await message.edit({
    content: 'This channel creation request has been addressed',
    embeds: message.embeds,
    components: newComponents
  })
  return true
}

/**
 * Approves a channel creation request
 * @param {ButtonInteraction | ModalSubmitInteraction} interaction The Discord bot's button interaction
 */
async function approveChannelRequest (interaction) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const embed = interaction.message.embeds[0]
  const fields = embed.fields

  // Refresh users
  await interaction.guild.members.fetch()

  const membersField = fields.find(f => f.name === 'Members')
  const team = await Promise.all(membersField.value.split(', ').map(async mention => {
    const userId = mention.match(/<@!?(\d+)>/)[1]
    const user = await interaction.guild.members.fetch(userId)
    return user
  }))

  const nameField = fields.find(f => f.name === 'Team Name')
  const category = serverConfig.channelRequest?.category
  const channel = await interaction.guild.channels.create({
    name: nameField.value,
    type: ChannelType.GuildText,
    parent: category
  })

  // Add overwrites on top of category if chosen to sync first, otherwise just set overwrites
  if (serverConfig.channelRequest?.syncFirst) {
    await channel.permissionOverwrites.create(channel.guild.roles.everyone, { ViewChannel: false })
    for (const user of team) {
      await channel.permissionOverwrites.create(user.id, { ViewChannel: true })
    }
  } else {
    channel.permissionOverwrites.set([
      {
        id: interaction.guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      ...team.map(user => ({
        id: user.id,
        allow: [PermissionsBitField.Flags.ViewChannel]
      }))
    ])
  }

  const reasonField = fields.find(f => f.name === 'Reason')
  if (reasonField) {
    channel.send('Created From Private Channel Request\n**Reason:** ' +
      reasonField.value + '\n' + membersField.value.replace(/,\s/g, ' '))
  }
  fields.push({ name: 'Channel', value: `<#${channel.id}>`, inline: true })
  const edited = await editMessageIfNeeded(interaction.message, 0x00ff00)
  if (!edited) interaction.deferUpdate()
}

module.exports = { editMessageIfNeeded, approveChannelRequest }

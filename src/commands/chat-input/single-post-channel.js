// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, PermissionOverwriteManager } = require('discord.js')
const { serverSettingsDB } = require('../../modules/database')

/**
 * Sets the "single-post" status of a channel
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 * @param {Boolean} active Whether the message counter should be enabled
 */
async function setSPChannel (interaction, client, active) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const spChannels = serverConfig.singlePostChannels ??= []

  const channelID = interaction.channelId
  if (spChannels.includes(channelID) === active) {
    const content = `Channel is ${active ? 'already' : 'not'} a single-post channel`
    return interaction.reply({ content, ephemeral: true })
  }

  if (active) {
    spChannels.push(channelID)
    interaction.reply({ content: `Added <#${channelID}> as a single-post channel`, ephemeral: true })
  } else {
    spChannels.splice(spChannels.indexOf(channelID), 1)
    interaction.reply({ content: `<#${channelID}> is no longer a single-post channel`, ephemeral: true })
  }
  await serverSettingsDB.put(serverConfig)
  client.emit('*UpdateSinglePostChannels', interaction.guild.id, spChannels)
}

/**
 * Responds with the "single-post" status of a channel
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 * @param {Boolean} active Whether the message counter should be enabled
 */
async function getSPCStatus (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const spChannels = serverConfig.singlePostChannels ??= []
  const channelID = interaction.channelId
  const active = spChannels.includes(channelID)

  const content = `<#${channelID}> ${active ? 'currently is' : 'is currently not'} a single-post channel`
  return interaction.reply({ content, ephemeral: true })
}

/**
 * Responds with the "single-post" status of a channel
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 * @param {Boolean} active Whether the message counter should be enabled
 */
async function grantSendPermission (interaction, client) {
  const user = interaction.options.getUser('user')

  // Check whether the channel is a single-post channel
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const spChannels = serverConfig.singlePostChannels ??= []
  if (!spChannels.includes(interaction.channelId)) {
    return interaction.reply({ content: 'Channel is not a single-post channel', ephemeral: true })
  }

  /** @type {PermissionOverwriteManager} */
  const overwrites = interaction.channel.permissionOverwrites
  await overwrites.create(user.id, { ViewChannel: true, SendMessages: true })
  interaction.reply({ content: `Granted send message permission to ${user}`, ephemeral: true })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spc')
    .setDescription('Configure a channel where users can only post once at a time')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('add-channel').setDescription('Sets the current channel to a single-post channel')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('remove-channel').setDescription('Changes this channel back to a normal channel')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('status').setDescription('Returns whether this channel is a single-post channel')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('grant')
        .setDescription('Grants permission for someone to post once to this channel')
        .addUserOption(option => option
          .setName('user')
          .setDescription('The user to grant permission to')
          .setRequired(true)
        )
      return subcommand
    }),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'add-channel': return setSPChannel(interaction, client, true)
      case 'remove-channel': return setSPChannel(interaction, client, false)
      case 'status': return getSPCStatus(interaction, client)
      case 'grant': return grantSendPermission(interaction, client)
    }
  },
  // Expose for tests
  setSPChannel,
  getSPCStatus,
  grantSendPermission
}

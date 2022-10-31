const { SlashCommandBuilder } = require('@discordjs/builders')
const { ChannelType } = require('discord-api-types/v9')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

async function setLog (interaction, client) {
  const channel = interaction.options.getChannel('channel')
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  let embed = {}
  if (channel && !channel.id) {
    embed = {
      title: 'Error in configuration',
      description: 'Unable to find that channel',
      color: 0xff0000
    }
  } else if (!channel) {
    serverConfig.logChannel = null
    await serverSettingsDB.put(serverConfig)
    embed = {
      title: 'Success',
      description: 'Successfully removed the log channel',
      color: 0x00ff00
    }
  } else {
    serverConfig.logChannel = channel.id
    serverConfig.inviteLogChannel = undefined
    await serverSettingsDB.put(serverConfig)
    embed = {
      title: 'Success',
      description: `Set the log channel to <#${channel.id}>`,
      color: 0x00ff00
    }
  }
  interaction.reply({
    embeds: [embed],
    ephemeral: channel && !channel.id
  })
}
async function toggleFeature (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const subcommand = interaction.options.getSubcommand()
  const featureName = subcommand.replace(/-\w/g, m0 => m0[1].toUpperCase())
  const isEnabled = interaction.options.getBoolean('enabled')
  if (isEnabled == null) {
    // If left empty, perform a read instead of a write for the setting
    interaction.reply({
      embeds: [{
        title: 'Config',
        description: `${subcommand} is currently ${serverConfig.enabledFeatures[featureName] ? 'enabled' : 'disabled'}`,
        color: 0x0088ff
      }]
    })
    return
  }
  if (!serverConfig.enabledFeatures) serverConfig.enabledFeatures = {}
  serverConfig.enabledFeatures[featureName] = isEnabled
  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Success',
      description: `Successfully ${isEnabled ? 'enabled' : 'disabled'} ${subcommand}`,
      color: 0x00ff00
    }]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure settings related to the Treasure Hacks Bot')
    .addSubcommand(subcommand => {
      subcommand.setName('log').setDescription('Specifies which channel should be used to log info')
        .addChannelOption(option => option
          .setName('channel')
          .setDescription('The channel that should be used to log Treasure Hacks Bot events. Leave blank to disable')
          .addChannelTypes(ChannelType.GuildText)
        )
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('link-scanner').setDescription('Configure automatic malware and scam link removal')
        .addBooleanOption(option => option
          .setName('enabled')
          .setDescription('Whether to enable automatic malware and scam link removal')
        )
      return subcommand
    }),
  userPermissions: ['ADMINISTRATOR'],
  defaultMemberPermissions: 8,
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'log': return setLog(interaction, client)
      case 'link-scanner': return toggleFeature(interaction, client)
    }
  }
}

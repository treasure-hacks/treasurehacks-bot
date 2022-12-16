// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, ChannelType, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

function dashedToCamelCase (str) {
  return str.replace(/-\w/g, m0 => m0[1].toUpperCase())
}

/**
 * Sets the log channel
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
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

/**
 * Sets the alert channel
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function setAlerts (interaction, client) {
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
    const currentChannel = serverConfig.alertsChannel
    embed = {
      title: 'Config',
      description: currentChannel
        ? `The alerts channel is currently set to <#${currentChannel}>`
        : 'You have not set up an alerts channel yet',
      color: 0x0088ff
    }
  } else {
    serverConfig.alertsChannel = channel.id
    await serverSettingsDB.put(serverConfig)
    embed = {
      title: 'Success',
      description: `Set the alerts channel to <#${channel.id}>`,
      color: 0x00ff00
    }
  }
  interaction.reply({
    embeds: [embed],
    ephemeral: channel && !channel.id
  })
}

/**
 * Gets the feature config reply for the current feature
 * @param {ChatInputCommandInteraction} interaction The interaction created by the user
 * @param {Client} client The bot client
 * @param {Object} config The server configuration
 * @returns {Object} The Discord reply object
 */
async function getFeatureConfig (interaction, client, config) {
  const subcommand = interaction.options.getSubcommand()
  const featureName = dashedToCamelCase(subcommand)
  const serverConfig = config || await serverSettingsDB.get(interaction.guild.id)
  const featureConfig = serverConfig[featureName] || {}

  const reply = {
    embeds: [{
      title: 'Config',
      description: `${subcommand} is currently ${featureConfig.enabled ? 'enabled' : 'disabled'}`,
      fields: [],
      color: 0x0088ff
    }]
  }
  Object.entries(featureConfig).forEach(([name, value]) => {
    switch (name) {
      case 'channel':
      case 'category':
        value = `<#${value}>`
    }
    reply.embeds[0].fields.push({ name, value: value.toString(), inline: true })
  })
  return reply
}

// async function toggleFeature (interaction, client) {
//   const serverConfig = await serverSettingsDB.get(interaction.guild.id)
//   const subcommand = interaction.options.getSubcommand()
//   const featureName = dashedToCamelCase(subcommand)
//   const isEnabled = interaction.options.getBoolean('enabled')
//   if (isEnabled == null) {
//     // If left empty, perform a read instead of a write for the setting
//     interaction.reply({
//       embeds: [{
//         title: 'Config',
//         description: `${subcommand} is currently ${serverConfig.enabledFeatures[featureName] ? 'enabled' : 'disabled'}`,
//         color: 0x0088ff
//       }]
//     })
//     return
//   }
//   if (!serverConfig.enabledFeatures) serverConfig.enabledFeatures = {}
//   serverConfig.enabledFeatures[featureName] = isEnabled
//   await serverSettingsDB.put(serverConfig)
//   interaction.reply({
//     embeds: [{
//       title: 'Success',
//       description: `Successfully ${isEnabled ? 'enabled' : 'disabled'} ${subcommand}`,
//       color: 0x00ff00
//     }]
//   })
// }

/**
 * Updates the configuration for a feature
 * @param {ChatInputCommandInteraction} interaction The interaction created by the user
 * @param {Client} client The bot client
 */
async function updateFeatureConfig (interaction, client) {
  const subcommand = interaction.options.getSubcommand()
  const featureName = dashedToCamelCase(subcommand)
  const optionEntries = interaction.options.data[0].options.map(dict => [dashedToCamelCase(dict.name), dict])
  // const options = Object.fromEntries(optionEntries)
  if (optionEntries.length === 0) return interaction.reply(await getFeatureConfig(interaction))

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig[featureName]) serverConfig[featureName] = {}
  const featureConfig = serverConfig[featureName]

  optionEntries.forEach(([name, option]) => {
    switch (option.type) {
      // case ApplicationCommandOptionType.String:
      //   featureConfig[name] = getValue(option)
      default:
        featureConfig[name] = option.value
    }
  })
  await serverSettingsDB.put(serverConfig)
  const reply = await getFeatureConfig(interaction, client, serverConfig)
  reply.embeds[0].title = `Updated ${subcommand} config`
  interaction.reply(reply)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure settings related to the Treasure Hacks Bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
      subcommand.setName('alerts').setDescription('Specifies which channel should be used for important alerts')
        .addChannelOption(option => option
          .setName('channel')
          .setDescription('The channel that should be used to show Treasure Hacks Bot alerts')
          .addChannelTypes(ChannelType.GuildText)
        )
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('channel-request').setDescription('Configure private chat channel requests')
        .addBooleanOption(option => option
          .setName('enabled')
          .setDescription('Whether to enable private chat channel requests')
        )
        .addChannelOption(option => option
          .setName('category')
          .setDescription('The category to create private chat channels in')
          .addChannelTypes(ChannelType.GuildCategory)
        )
      return subcommand
    }),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'log': return setLog(interaction, client)
      case 'alerts': return setAlerts(interaction, client)
      case 'channel-request': return updateFeatureConfig(interaction, client)
    }
  }
}

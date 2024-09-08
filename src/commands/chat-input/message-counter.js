// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { serverSettingsDB } = require('../../modules/database')

const defaultServerConfig = { enabled: false, ignoredRoles: [], counts: {} }

/**
 * Gets the specified roles from the slash command options
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
function getRolesFromOptions (interaction) {
  const addRoles = interaction.options.getString('add')?.split(' ') || []
  const removeRoles = interaction.options.getString('remove')?.split(' ') || []
  const setRoles = interaction.options.getString('set')?.split(' ') || []

  const allRoles = [addRoles, removeRoles, setRoles].flat()
  if (allRoles.some(c => !c.match(/^<@&\d+>$/))) return { error: 'Roles are not formatted properly. Please enter channel names, separated by spaces. ie `@Group @Lobby`' }

  function isValidRole (role) {
    return !role.managed && role.name !== '@everyone'
  }

  const roleCache = [...interaction.guild.roles.cache.values()]
  const warnings = allRoles.filter(role => {
    return !roleCache.find(r => r.toString() === role && isValidRole(role))
  })

  const serverData = {
    addRoles: roleCache.filter(role => {
      return addRoles.includes(role.toString())
    }),
    removeRoles: roleCache.filter(role => {
      return removeRoles.includes(role.toString())
    }),
    setRoles: roleCache.filter(role => {
      return setRoles.includes(role.toString())
    }),
    warnings: warnings.length ? ['Could not find the following channels or roles: ' + warnings.join(', ')] : []
  }

  return serverData
}

/**
 * Enables or disables the message counter
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 * @param {Boolean} enabled Whether the message counter should be enabled
 */
async function setCounterStatus (interaction, client, enabled) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig.messageCounter) serverConfig.messageCounter = defaultServerConfig
  serverConfig.messageCounter.enabled = enabled

  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Success',
      description: `Successfully ${enabled ? 'enabled' : 'disabled'} the message counter`,
      color: 0x00ff00
    }]
  })
}
/**
 * Updates which roles should be ignored by the message counter
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function updateIgnoredRoles (interaction, client) {
  const { addRoles, removeRoles, setRoles, error } = getRolesFromOptions(interaction)
  if (error) {
    interaction.reply({
      embeds: [{
        title: 'Error in configuration',
        description: error,
        color: 0xff0000
      }],
      ephemeral: true
    })
    return
  }

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig.messageCounter) serverConfig.messageCounter = defaultServerConfig
  let ignoredRoles = serverConfig.messageCounter.ignoredRoles || []
  let message = ''

  if (setRoles.length || (addRoles.length === 0 && removeRoles.length === 0)) {
    ignoredRoles = setRoles.map(r => r.id)
    message = 'Set the ignored roles to ' + (setRoles.join(', ') || 'None')
  } else {
    addRoles.forEach(role => {
      if (!ignoredRoles.includes(role.id)) ignoredRoles.push(role.id)
    })
    removeRoles.forEach(role => {
      if (!ignoredRoles.includes(role.id)) return
      const index = ignoredRoles.indexOf(role.id)
      ignoredRoles.splice(index, 1)
    })
    message = `Added the following roles to the ignore list: ${addRoles.join(', ') || 'None'}\n` +
      `Removed the following roles from the ignore list: ${removeRoles.join(', ') || 'None'}`
  }
  const ignoredRolesStr = ignoredRoles.map(r => `<@&${r}>`).join(', ')

  serverConfig.messageCounter.ignoredRoles = ignoredRoles // In case it's re-referenced by set roles
  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Message Counter',
      description: 'Successfully updated the ignore list of the message counter.\n' +
        `${message}\nCurrent Ignored Rules: ${ignoredRolesStr || 'None'}`,
      color: 0x0088ff
    }]
  })
}

/**
 * Replies with the number of messages the top 100 people have sent
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function replyWithCounts (interaction, client) {
  const isPublic = interaction.channel.permissionsFor(interaction.guild.roles.everyone)
    .has(PermissionFlagsBits.ViewChannel)
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const counts = serverConfig.messageCounter?.counts
  if (!counts) return interaction.reply({ content: 'No counts yet', ephemeral: true })
  const entries = Object.entries(counts)
  const messageContent = entries
    .sort((b, a) => a[1] - b[1]) // Sort descending by count
    .slice(0, 75) // Only the first 75 users
    .map(x => `<@${x[0]}>: ${x[1]}`)
    .join('\n')
  interaction.reply({
    content: '__**Message Counts:**__\n\n' + messageContent +
      (Object.values(counts).length > 75 ? '\n...' : ''),
    ephemeral: isPublic
  })
}

/**
 * Replies with the status of the message counter
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function replyWithStatus (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const enabled = serverConfig.messageCounter?.enabled
  const ignoredRoles = serverConfig.messageCounter?.ignoredRoles || []
  const ignoredRolesStr = ignoredRoles.map(r => `<@&${r}>`).join(', ')
  interaction.reply({
    embeds: [{
      title: 'Message Counter',
      description: `Message counter is currently ${enabled ? 'enabled' : 'disabled'}\n` +
        `Ignored roles: ${ignoredRolesStr || 'None'}`,
      color: enabled ? 0x00ff00 : 0xff0000
    }]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('message-counter')
    .setDescription('Automatically counts messages sent by users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('enable').setDescription('Enables the message counter')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('disable').setDescription('Disables the message counter')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('status').setDescription('Gets the status of the message counter')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('counts').setDescription('Gets the number of messages everyone has sent')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('ignored-roles').setDescription('Modifies roles whose messages should not be counter')
        .addStringOption(option => option
          .setName('add')
          .setDescription('Adds roles (with the @, separated by spaces) to the ignore list')
        )
        .addStringOption(option => option
          .setName('remove')
          .setDescription('Removes roles (with the @, separated by spaces) from the ignore list')
        )
        .addStringOption(option => option
          .setName('set')
          .setDescription('Overrides the ignore list with the specified roles (separated by spaces)')
        )
      return subcommand
    }),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'enable': return setCounterStatus(interaction, client, true)
      case 'disable': return setCounterStatus(interaction, client, false)
      case 'counts': return replyWithCounts(interaction, client, false)
      case 'ignored-roles': return updateIgnoredRoles(interaction, client)
      case 'status': return replyWithStatus(interaction, client)
    }
  }
}

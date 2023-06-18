// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const defaultServerConfig = { enabled: false, ignoredRoles: [], maxDays: 7 }

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
 * Enables or disables the crypto scam scanner
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 * @param {Boolean} enabled Whether the crypto scam scanner should be enabled
 */
async function setScannerStatus (interaction, client, enabled) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig.cryptoScamScanner) serverConfig.cryptoScamScanner = defaultServerConfig
  serverConfig.cryptoScamScanner.enabled = enabled

  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Success',
      description: `Successfully ${enabled ? 'enabled' : 'disabled'} the crypto scam scanner`,
      color: 0x00ff00
    }]
  })
}

/**
 * Sets the max age of a user whose messages should be scanner
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 * @param {Number} age The number of days
 */
async function setMaxUserAge (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig.cryptoScamScanner) serverConfig.cryptoScamScanner = defaultServerConfig
  const age = interaction.options.getNumber('days')
  serverConfig.cryptoScamScanner.maxDays = age

  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Crypto Scam Scanner',
      description: `Successfully set the max user age to ${age} days`,
      color: 0x00ff00
    }]
  })
}

/**
 * Updates which roles should be ignored by the crypto scam scanner
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
  if (!serverConfig.cryptoScamScanner) serverConfig.cryptoScamScanner = defaultServerConfig
  let ignoredRoles = serverConfig.cryptoScamScanner.ignoredRoles || []
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

  serverConfig.cryptoScamScanner.ignoredRoles = ignoredRoles // In case it's re-referenced by set roles
  await serverSettingsDB.put(serverConfig)
  interaction.reply({
    embeds: [{
      title: 'Crypto Scam Scanner',
      description: 'Successfully updated the ignore list of the crypto scam scanner.\n' +
        `${message}\nCurrent Ignored Rules: ${ignoredRolesStr || 'None'}`,
      color: 0x0088ff
    }]
  })
}

/**
 * Replies with the status of the crypto scam scanner
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function replyWithStatus (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const enabled = serverConfig.cryptoScamScanner?.enabled
  const maxDays = serverConfig.cryptoScamScanner?.maxDays
  const ignoredRoles = serverConfig.cryptoScamScanner?.ignoredRoles || []
  const ignoredRolesStr = ignoredRoles.map(r => `<@&${r}>`).join(', ')
  interaction.reply({
    embeds: [{
      title: 'Crypto Scam Scanner',
      description: `Crypto scam scanner is currently ${enabled ? 'enabled' : 'disabled'}\n` +
        `Scans messages from users who have been in the server for less than ${maxDays} days\n` +
        `Ignored roles: ${ignoredRolesStr || 'None'}`,
      color: enabled ? 0x00ff00 : 0xff0000
    }]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scam-checker')
    .setDescription('Enables AI-based crypto scam detection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('enable').setDescription('Enables the crypto scam scanner')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('disable').setDescription('Disables the crypto scam scanner')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('max-age').setDescription('Sets the max membership age to scan (days)')
        .addNumberOption(option => option
          .setName('days')
          .setDescription('Scan messages from users in the server for at most this number of days')
          .setRequired(true)
        )
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('status').setDescription('Gets the status of the crypto scam scanner')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('ignored-roles').setDescription('Modifies roles whose messages should never be scanned')
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
      case 'enable': return setScannerStatus(interaction, client, true)
      case 'disable': return setScannerStatus(interaction, client, false)
      case 'max-age': return setMaxUserAge(interaction, client)
      case 'ignored-roles': return updateIgnoredRoles(interaction, client)
      case 'status': return replyWithStatus(interaction, client)
    }
  },
  // Expose for tests
  setScannerStatus,
  setMaxUserAge,
  updateIgnoredRoles,
  replyWithStatus
}

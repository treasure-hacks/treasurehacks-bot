// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, AutocompleteInteraction, Collection, AutocompleteFocusedOption, Invite } = require('discord.js')
const { Deta } = require('deta')
const { getStats } = require('../../modules/role-stats')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const isValidRole = role => !role.managed && role.name !== '@everyone'
/**
 * Gets the channels and roles from the slash command interaction options
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
function getRoles (interaction) {
  const [addOpt, removeOpt] = [
    interaction.options.getString('add-roles'),
    interaction.options.getString('remove-roles')
  ]
  const add = addOpt?.toLowerCase() === 'none' ? [] : addOpt?.split(' ')
  const remove = removeOpt?.toLowerCase() === 'none' ? [] : removeOpt?.split(' ')

  if (add?.some(c => !c.match(/^<@&\d+>$/))) return { error: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`' }
  if (remove?.some(c => !c.match(/^<@&\d+>$/))) return { error: 'Roles are not formatted properly. Please enter role names, separated by spaces. ie `@Group @Lobby`' }

  const warnings = add?.filter(role => {
    return !interaction.guild.roles.cache.find(r => r.toString() === role && isValidRole(role))
  })

  const serverData = {
    roles: add && interaction.guild.roles.cache.filter(role => {
      return add.includes(role.toString())
    }),
    removeRoles: remove && interaction.guild.roles.cache.filter(role => {
      return remove.includes(role.toString())
    }),
    warnings: warnings?.length ? ['Could not find the following channels or roles: ' + warnings.join(', ')] : []
  }

  return serverData
}

/**
 * Gets a color from the slash command interaction options
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
function getColorFromOptions (interaction) {
  const color = interaction.options.getString('color') || undefined
  if (!color) return { color: undefined }
  if (color.match(/^#?[0-9a-f]{6}$/i)) return { color: parseInt(color.replace(/^#/, ''), 16) }

  if (!color.match(/^<@&\d+>$/)) return { error: 'Color must either be valid HEX or contain exactly one role to inherit color from' }
  const role = interaction.guild.roles.cache.find(role => {
    return color === role.toString()
  })
  return { color: role.color }
}

/**
 * Returns a list of invites whose IDs match those specified in the command interaction
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @returns {Promise<Invite[]>} A list of invites
 */
async function invitesFromInteraction (interaction) {
  const inviteIDs = interaction.options.getString('invites')?.split(',')?.map(c => c.trim())
  if (!inviteIDs) return []
  if (inviteIDs.includes('(new)')) {
    // Create a new invite
    const invite = await interaction.guild.invites.create(interaction.channel, { maxAge: 0 })
      .catch(() => console.log('Unable to create invite'))
    inviteIDs[inviteIDs.indexOf('(new)')] = invite?.code
  }
  const guildInvites = await interaction.guild.invites.fetch()
  return guildInvites.filter(i => inviteIDs.includes(i.code)).map(x => x)
}

/**
 * Adds a rule to manage invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function addInviteRule (interaction, client, isUpdate) {
  const name = interaction.options.getString('name')
  const renameTo = isUpdate && interaction.options.getString('rename')
  const description = interaction.options.getString('description') || undefined
  const invites = await invitesFromInteraction(interaction)
  const enabled = interaction.options.getBoolean('enabled')

  const { color } = getColorFromOptions(interaction)
  if (name.match(/[^0-9a-zA-Z-_]/)) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Name must only be alphanumeric characters, dashes, and underscores'
      }],
      ephemeral: true
    })
    return
  }
  const { error, roles, removeRoles, warnings } = getRoles(interaction)
  const { error: error2 } = getColorFromOptions(interaction)
  if (error || error2) {
    const embeds = [{
      color: 0xff0000,
      title: 'Invalid Arguments',
      description: error || error2
    }]
    return interaction.reply({ embeds, ephemeral: true })
  }

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const hasInvalidRoles = roles?.some(role => {
    const roleJSON = role.toJSON()
    return roleJSON.name === '@everyone' || roleJSON.managed
  })
  if (hasInvalidRoles) {
    return interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Invalid roles: you cannot assign @everyone or managed roles.'
      }],
      ephemeral: true
    })
  }

  const existingRule = serverConfig.inviteRoles.find(rule => rule.name === name)
  if (!existingRule === isUpdate) {
    // Force separation of commands because we don't want accidental changes being made
    return interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: `Error while ${isUpdate ? 'updating' : 'creating'} rule \`${name}\``,
        description: isUpdate ? 'Rule does not exist' : 'Rule already exists'
      }],
      ephemeral: true
    })
  }
  const replyContent = { embeds: [], ephemeral: true }
  if (warnings.length) {
    replyContent.embeds.push({
      color: 0xf0b800,
      title: 'Warnings',
      description: warnings.join('\n')
    })
  }

  if (existingRule) {
    if (color) existingRule.color = color
    if (roles) existingRule.rolesToAdd = [...new Set(roles.map(r => r.id))]
    if (removeRoles) existingRule.rolesToRemove = [...new Set(removeRoles.map(r => r.id))]
    if (invites.length) existingRule.invites = [...new Set(invites.map(i => i.code))]
    if (renameTo) existingRule.name = renameTo
    if (enabled != null) existingRule.enabled = enabled
    existingRule.updated_at = Date.now()
    const { created_at: createdAt, occurrences } = getStats(existingRule)
    replyContent.embeds.push({
      title: `Updated \`${name}\`` + (renameTo ? ` (renamed from ${name})` : ''),
      color: existingRule.color,
      description: (existingRule.description ? existingRule.description + '\n\n' : '') +
        `Applies to invites: ${existingRule.invites.join(', ')}` +
        `\nPeople invited will have these roles: ${existingRule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
        `\nPeople invited will lose these roles: ${existingRule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
      footer: {
        text: `Created ${createdAt} • Updated just now • ${occurrences} use${occurrences === 1 ? '' : 's'}` +
          (!existingRule.enabled ? ' • Disabled' : '')
      }
    })
  } else {
    const rolesArray = [...new Set(roles?.values() || [])]
    const roleRemovalArray = [...new Set(removeRoles?.values() || [])]
    serverConfig.inviteRoles.push({
      name,
      color: color,
      description,
      invites: invites.map(i => i.code),
      rolesToAdd: rolesArray.map(r => r.id),
      rolesToRemove: roleRemovalArray.map(r => r.id),
      occurrences: 0,
      enabled: enabled ?? true,
      created_at: Date.now(),
      updated_at: Date.now()
    })
    replyContent.embeds.push({
      title: `Created \`${name}\``,
      color,
      description: (description ? description + '\n\n' : '') +
        `Applies to invites: ${invites.map(i => i.code)}` +
        `\nPeople invited will have these roles: ${rolesArray.join(', ')}` +
        `\nPeople invited will lose these roles: ${roleRemovalArray.join(', ')}`,
      footer: { text: 'Created just now • Updated just now • 0 uses' + (enabled === false ? ' • Disabled' : '') }
    })
  }

  serverSettingsDB.put(serverConfig)
  autocompleteCache.delete(interaction.guild.id)
  interaction.reply(replyContent)
}

/**
 * Lists the existing rules for invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function listInviteRoles (interaction, client) {
  const name = interaction.options.getString('name')
  const listAll = name == null
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const embeds = serverConfig.inviteRoles.filter(rule => {
    return rule.name === name || listAll
  }).map(rule => {
    const stats = getStats(rule)
    return {
      title: `Invite Role Assignment: ${rule.name}`,
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites: ${rule.invites.join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
        `\nPeople invited will lose these roles: ${rule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
      footer: {
        text: `Created ${stats.created_at} • Updated ${stats.updated_at} • ${stats.occurrences} use` +
          `${stats.occurrences === 1 ? '' : 's'}${!rule.enabled ? ' • Disabled' : ''}`
      }
    }
  })

  if (!embeds.length) {
    embeds.push({
      title: listAll
        ? 'Command Failed: No Invite Role Assignments'
        : 'Command Failed: No Matching Rule',
      description: listAll
        ? 'Your server does not have any invite role assignment rules associated with it.\nTry adding one with the `/inviteroles add` command!'
        : 'There was no invite role assignment rule with the name that was provided'
    })
  }

  interaction.reply({
    content: listAll ? 'Details of all role assignments:' : undefined,
    embeds,
    ephemeral: !embeds.length
  })
}

/**
 * Removes a rule that manages invite roles
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function removeInviteRule (interaction, client) {
  const name = interaction.options.getString('name')
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)

  const rule = serverConfig.inviteRoles.find(rule => rule.name === name)
  if (!rule) {
    const embeds = [{
      color: 0xff0000,
      title: 'Unable to delete ' + name,
      description: 'This invite role assignment rule does not exist'
    }]
    return interaction.reply({ embeds, ephemeral: true })
  }

  const stats = getStats(rule)
  const embeds = [{
    title: `Deleted \`${name}\``,
    color: rule.color,
    description:
      `Applies to invites: ${rule.invites.join(', ')}` +
      `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}` +
      `\nPeople invited will lose these roles: ${rule.rolesToRemove.map(role => `<@&${role}>`).join(', ')}`,
    footer: { text: `Created ${stats.created_at} • Deleted just now • ${stats.occurrences} use${stats.occurrences === 1 ? '' : 's'}` }
  }]

  serverConfig.inviteRoles = serverConfig.inviteRoles.filter(r => r !== rule)
  await serverSettingsDB.put(serverConfig)
  autocompleteCache.delete(interaction.guild.id)
  interaction.reply({ embeds, ephemeral: true })
}

const autocompleteCache = new Collection()
/**
 * Returns a list of inviterole names to show
 * @param {AutocompleteInteraction} interaction The autocomplete interaction
 * @param {AutocompleteFocusedOption} interaction The autocomplete interaction
 */
async function getInviteRoleNames (interaction, option) {
  const serverConfig = autocompleteCache.get(interaction.guild.id) ||
    await serverSettingsDB.get(interaction.guild.id).then(s => { autocompleteCache.set(interaction.guild.id, s); return s })

  if (!serverConfig.inviteRoles) return await interaction.respond([])

  const ruleNames = serverConfig.inviteRoles.map(r => r.name)
  const options = ruleNames.filter(n => n.startsWith(option.value)).sort()
    .concat(ruleNames.filter(n => !n.startsWith(option.value) && n.includes(option.value)).sort())
    .map(name => ({ name, value: name }))
    .slice(0, 25)

  interaction.respond(options)
}

/**
 * Returns a list of inviterole names to show
 * @param {AutocompleteInteraction} interaction The autocomplete interaction
 * @param {AutocompleteFocusedOption} interaction The autocomplete interaction
 */
async function getRecentInvites (interaction, { value }) {
  const codes = value.split(',').map(s => s.trim())
  const search = codes.at(-1)
  const mustExist = codes.slice(0, codes.length - 1)
  const invites = await interaction.guild.invites.fetch()
  invites.sort((b, a) => a.createdTimestamp - b.createdTimestamp)

  const allExist = mustExist.every(c => invites.find(i => i.code === c))
  if (!allExist) return interaction.respond([])

  const prefix = mustExist.length ? mustExist.join(', ') + ', ' : ''
  const options = invites.filter(i => i.code.startsWith(search))
    .concat(invites.filter(i => !i.code.startsWith(search) && i.code.includes(search)))
    .filter(i => !mustExist.includes(i.code))
    .map(i => ({ name: prefix + i.code, value: prefix + i.code }))
    .slice(0, 24)
  options.push({ name: prefix + 'New Invite', value: prefix + '(new)' })

  interaction.respond(options)
}

function addUpdateCommandOptions (subcommand, isCreate) {
  return subcommand
    .addStringOption(option => option.setName('name').setDescription('The name of your invite role assignment rule').setRequired(true).setAutocomplete(!isCreate))
    .addStringOption(option => option.setName('add-roles').setDescription('Roles (with the @), separated by spaces, to grant to people who are invited to this channel'))
    .addStringOption(option => option.setName('remove-roles').setDescription('Roles (with the @), separated by spaces, to remove from those invited to this channel'))
    .addStringOption(option => option.setName('color').setDescription('A HEX string to assign a color to this rule'))
    .addStringOption(option => option.setName('invites').setDescription('Existing invites to link to this rule (separated by commas)').setAutocomplete(true))
    .addBooleanOption(option => option.setName('enabled').setDescription('Whether to activate this rule (defaults to true)'))
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteroles')
    .setDescription('Manage roles that are automatically added when people join with certain invites')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('add').setDescription('Add a new invite role assignment rule')
      addUpdateCommandOptions(subcommand, true)
      return subcommand
    })
    .addSubcommand(subcommand => subcommand
      .setName('details')
      .setDescription('List role assignments that occur when someone joins the server')
      .addStringOption(option => option.setName('name').setDescription('The name of the assignment rule').setAutocomplete(true))
    )
    .addSubcommand(subcommand => subcommand
      .setName('delete')
      .setDescription('Deletes an invite role assignment rule')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name of the rule you want to delete')
        .setRequired(true)
        .setAutocomplete(true)
      )
    )
    .addSubcommand(subcommand => {
      subcommand.setName('update').setDescription('Override fields to an invite role assignment rule')
      addUpdateCommandOptions(subcommand, false)
      subcommand.addStringOption(option => option.setName('rename').setDescription('A new name for this rule'))
      return subcommand
    }),
  autocomplete: async (interaction, client) => {
    const focusedOption = interaction.options.getFocused(true)
    switch (focusedOption.name) {
      case 'name': return await getInviteRoleNames(interaction, focusedOption)
      case 'invites': return await getRecentInvites(interaction, focusedOption)
    }
  },
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'add': return addInviteRule(interaction, client, false, false)
      case 'details': return listInviteRoles(interaction, client)
      case 'delete': return removeInviteRule(interaction, client)
      case 'update': return addInviteRule(interaction, client, true, false)
    }
  },
  // Expose for tests
  addInviteRule,
  listInviteRoles,
  removeInviteRule
}

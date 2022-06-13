require('dotenv').config()

const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { sendMessage, sendEmbeds } = require('./modules/message')
const { getStats } = require('./modules/role-stats')

const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const fs = require('fs')
const { Client, Intents, Collection } = require('discord.js')
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_INVITES
  ]
}) // Connect to our discord bot
let commands = new Collection() // Where the bot (slash) commands will be stored
const commandPermssions = {}
const token = process.env.DISCORD_TOKEN
const rest = new REST({ version: '9' }).setToken(token)

const enabledByDefault = {
  linkScanner: true
}

async function registerSlashCommands () {
  commands = new Collection()
  const commandArray = [] // Array to store commands for sending to the REST API
  const commandFiles = fs
    .readdirSync('src/commands')
    .filter(file => file.endsWith('.js')) // Get and filter all the files in the "Commands" Folder.

  // Loop through the command files
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`) // Get and define the command file.
    if (command.userPermissions) {
      command.data.defaultPermission = false
      command.data.defaultMemberPermissions = command.defaultMemberPermissions
      command.data.userPermissions = command.userPermissions
    } else {
      command.data.defaultPermission = true
      command.data.defaultMemberPermissions = true
      command.data.userPermissions = []
    }
    commands.set(command.data.name, command) // Set the command name and file for handler to use.
    commandArray.push(command.data.toJSON()) // Push the command data to an array (for sending to the API).
    commandPermssions[command.data.name] = command.userPermissions || []
  }

  // Send command list to Discord API
  const body = commandArray.sort((a, b) => (commandPermssions[a.name]?.length || 0) - (commandPermssions[b.name]?.length || 0))
  try {
    console.log('Refreshing application (/) commands...')
    const commandResponse = await rest.put(Routes.applicationCommands(client.user.id), { body })
    console.log('Successfully reloaded application (/) commands.')
    return { success: true, message: 'Successfully reloaded application (/) commands', request: body, response: commandResponse }
  } catch (error) {
    console.error(error)
    return { success: false, error, request: body }
  }
}
async function respondToCommand (interaction) {
  const command = commands.get(interaction.commandName)
  if (!command) return

  try {
    await command.execute(interaction, client)
  } catch (error) {
    console.error(error)
    return interaction.reply({
      content: 'There was an error while executing this command!',
      ephemeral: true
    })
  }
}

// Track Invites
const invites = global.invites = new Collection()

async function loadInvites () {
  // Cache invites
  client.guilds.cache.forEach(async guild => {
    // Fetch all Guild Invites
    const firstInvites = await guild.invites.fetch()
    const inviteArray = firstInvites.map((invite) => [invite.code, invite.uses])
    invites.set(guild.id, new Collection(inviteArray))
    const serverConfig = await serverSettingsDB.get(guild.id)
    if (!serverConfig) serverSettingsDB.put({ key: guild.id, inviteLogChannel: null, inviteRoles: [], enabledFeatures: enabledByDefault })
  })
}
function updateGuildInvites (guild) {
  guild.invites.fetch().then(guildInvites => {
    // This is the same as the ready event
    invites.set(guild.id, new Map(guildInvites.map((invite) => [invite.code, invite.uses])))
  })
}
function trackInvites (client) {
  client.on('inviteDelete', (invite) => {
    // Delete the Invite from Cache
    invites.get(invite.guild.id).delete(invite.code)
  })
  client.on('inviteCreate', (invite) => {
    // Update cache on new invites
    invites.get(invite.guild.id).set(invite.code, invite.uses)
  })
  client.on('guildCreate', async (guild) => {
    // We've been added to a new Guild. Let's fetch all the invites, and save it to our cache
    updateGuildInvites(guild)
    await serverSettingsDB.put({
      key: guild.id,
      inviteLogChannel: null,
      inviteRoles: [],
      enabledFeatures: enabledByDefault
    })
  })
  client.on('guildDelete', (guild) => {
    // We've been removed from a Guild. Let's delete all their invites
    invites.delete(guild.id)
  })
}
trackInvites(client)

client.once('ready', async () => {
  console.log(`Logged in as \x1b[34m${client.user.tag}\x1b[0m`)
  registerSlashCommands()
  loadInvites()
})
client.on('interactionCreate', async interaction => {
  // Command handler
  if (!interaction.isCommand()) return
  respondToCommand(interaction)
})
client.on('guildMemberAdd', async member => {
  const serverConfig = await serverSettingsDB.get(member.guild.id)

  const newInvites = await member.guild.invites.fetch()
  // This is the *existing* invites for the guild.
  const oldInvites = invites.get(member.guild.id)
  // Look through the invites, find the one for which the uses went up.
  const invite = newInvites.find(i => i.uses > oldInvites.get(i.code))
  updateGuildInvites(member.guild)

  const channels = await member.guild.channels.fetch()
  const inviteLogChannel = channels.get(serverConfig.inviteLogChannel)

  const embeds = [{
    color: parseInt('5a686c', 16),
    author: { name: 'Member Joined', iconURL: member.displayAvatarURL() },
    title: '',
    description: `<@!${member.id}> has been invited to the server!`,
    fields: [
      { name: 'Inviter', value: `${invite.inviter.username}#${invite.inviter.discriminator}`, inline: true },
      { name: 'Code', value: invite.code, inline: true },
      { name: 'Channel', value: `${invite.channel.name}`, inline: true }
    ],
    timestamp: Date.now()
  }]

  const actions = serverConfig.inviteRoles.filter(action => action.inviteChannelIds?.includes(invite.channel.id))
  serverConfig.inviteRoles = serverConfig.inviteRoles.map(action => {
    if (!action.inviteChannelIds?.includes(invite.channel.id)) return action
    action.occurrences += 1
    action.rolesToAdd.forEach(roleId => {
      const role = member.guild.roles.cache.get(roleId)
      member.roles.add(role)
        .catch(() => { sendMessage(inviteLogChannel, `Failed to add role ${role.name} to ${member.displayName}`) })
    })
    setTimeout(() => {
      action.rolesToRemove.forEach(roleId => {
        const role = member.guild.roles.cache.get(roleId)
        member.roles.remove(role)
          .catch(() => { sendMessage(inviteLogChannel, `Failed to remove role ${role.name} from ${member.displayName}`) })
      })
    }, 2000)
    const stats = getStats(action)
    embeds.push({
      color: action.color,
      author: { name: `${member.user.username}#${member.user.discriminator}`, iconURL: member.displayAvatarURL() },
      title: 'Invite Role Assignment: ' + action.name,
      description: (action.description ? action.description + '\n\n' : '') +
        `Assigned the following roles to <@!${member.id}>: ${action.rolesToAdd.map(id => `<@&${id}>`).join(', ')}\n` +
        `Removed the following roles from <@!${member.id}>: ${action.rolesToRemove.map(id => `<@&${id}>`).join(', ')}`,
      footer: `Created ${stats.created_at} • Updated ${stats.updated_at} • ${stats.occurrences} use${stats.occurrences === 1 ? '' : 's'}`
    })
    return action
  })
  await serverSettingsDB.put(serverConfig)
  if (actions.length > 0) sendEmbeds(inviteLogChannel, embeds)
})

// Message Scanner
require('./listeners/message')(client)

client.login(token)

const PORT = process.env.PORT
const express = require('express')
const site = express()
site.use(express.json({ extended: true, limit: '5mb' }))
site.use(express.urlencoded({ extended: true }))
site.get('/addToMyServer', (req, res) => {
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${process.env.BOT_CLIENT_ID}&permissions=8&scope=applications.commands%20bot`)
})
site.get('/refresh-commands', async (req, res) => {
  if (req.query.key !== process.env.COMMAND_REFRESH_KEY) return res.send('Incorrect Key')
  const result = await registerSlashCommands()
  res.send(result)
})
site.use((req, res) => {
  res.send('404 Page not found')
})
const http = require('http')
const server = http.Server(site)
server.listen(PORT, function () {
  console.log('Listening on port ' + PORT)
})

// TO DO: listen for role or channel create/destroy

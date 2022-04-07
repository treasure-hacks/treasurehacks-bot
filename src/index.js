require('dotenv').config()

const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const fs = require('fs')
const { Client, Intents, Collection, MessageEmbed } = require('discord.js')
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS
  ]
}) // Connect to our discord bot
const commands = new Collection() // Where the bot (slash) commands will be stored
const commandArray = [] // Array to store commands for sending to the REST API
const token = process.env.DISCORD_TOKEN

function registerSlashCommands () {
  const commandFiles = fs
    .readdirSync('src/commands')
    .filter(file => file.endsWith('.js')) // Get and filter all the files in the "Commands" Folder.

  // Loop through the command files
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`) // Get and define the command file.
    commands.set(command.data.name, command) // Set the command name and file for handler to use.
    commandArray.push(command.data.toJSON()) // Push the command data to an array (for sending to the API).
  }

  const rest = new REST({ version: '9' }).setToken(token);
  // Send command list to Discord API
  (async () => {
    try {
      console.log('Refreshing application (/) commands...')
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandArray
      })
      console.log('Successfully reloaded application (/) commands.')
    } catch (error) {
      console.error(error)
    }
  })()
  console.log(`Logged in as ${client.user.tag}!`)
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
  client.on('guildCreate', (guild) => {
    // We've been added to a new Guild. Let's fetch all the invites, and save it to our cache
    updateGuildInvites(guild)
  })
  client.on('guildDelete', (guild) => {
    // We've been removed from a Guild. Let's delete all their invites
    invites.delete(guild.id)
  })
}
trackInvites(client)

function sendMessage (channel, data) {
  channel.send(data)
    .then(message => console.log(`Sent message: ${message.content}`))
    .catch(console.error)
}
function sendEmbeds (channel, embedConfigs) {
  const embeds = embedConfigs.map(config => {
    const embed = new MessageEmbed()
      .setColor(config.color)
      .setTitle(config.title)
      .setAuthor(config.author.name, config.author.iconURL, config.author.string)
      .setDescription(config.description)
    if (config.url) embed.setURL('https://discord.js.org/')
    if (config.thumbnail) embed.setThumbnail('https://i.imgur.com/AfFp7pu.png')
    if (config.image) embed.setImage('https://i.imgur.com/AfFp7pu.png')
    if (config.timestamp) embed.setTimestamp(...config.fields)
    if (config.footer) embed.setFooter(...config.fields)
    if (config.fields) embed.addFields(...config.fields)

    return embed
  })

  channel.send({ embeds })
}

client.once('ready', async () => {
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
  const logChannel = channels.get(serverConfig.logChannel)

  const embeds = [{
    color: parseInt('5a686c', 16),
    author: { name: 'Member Joined', iconURL: member.displayAvatarURL() },
    title: '',
    description: `<@!${member.id}> has been invited to the server!`,
    fields: [
      { name: 'Username', value: `${member.user.username}#${member.user.discriminator}`, inline: true },
      { name: 'Inviter', value: `${invite.inviter.username}#${invite.inviter.discriminator}`, inline: true },
      { name: 'Channel', value: `${invite.channel.name}`, inline: true }
    ],
    timestamp: Date.now()
  }]
  // sendMessage(logChannel, `${member.displayName} joined the server from an invite created by ${invite.inviter.username} (Code: ${invite.code})`)

  const actions = serverConfig.inviteRoles.filter(action => action.inviteChannelIds.includes(invite.channel.id))
  actions.forEach(action => {
    action.rolesToAdd.forEach(role => {
      const serverRole = member.guild.roles.cache.find(r => r.name === role)
      member.roles.add(serverRole)
        .catch(() => { sendMessage(logChannel, `Failed to add role ${role} to ${member.displayName}`) })
      embeds.push({
        color: serverRole.color,
        author: { name: `${member.user.username}#${member.user.discriminator}`, iconURL: member.displayAvatarURL() },
        title: '',
        description: `@${member.displayName} was given the <@&${serverRole.id}> role through this invite`
      })
    })
  })
  console.log(embeds)
  if (actions.length > 0) sendEmbeds(logChannel, embeds)
})

client.login(token)

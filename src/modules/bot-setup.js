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
const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
let commands = new Collection() // Where the bot (slash) commands will be stored
const commandPermssions = {}
const token = process.env.DISCORD_TOKEN
const rest = new REST({ version: '9' }).setToken(token)

async function registerSlashCommands () {
  commands = new Collection()
  const commandArray = [] // Array to store commands for sending to the REST API
  const commandFiles = fs
    .readdirSync('src/commands')
    .filter(file => file.endsWith('.js')) // Get and filter all the files in the "Commands" Folder.

  // Loop through the command files
  for (const file of commandFiles) {
    const command = require(`../commands/${file}`) // Get and define the command file.
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

module.exports = { client, token, registerSlashCommands, respondToCommand }

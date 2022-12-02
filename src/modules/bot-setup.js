const fs = require('fs')
const { Client, GatewayIntentBits, Collection } = require('discord.js')
// eslint-disable-next-line no-unused-vars
const { BaseInteraction, ButtonInteraction } = require('discord.js')
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
}) // Connect to our discord bot
const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v10')
let commands = new Collection() // Where the bot (slash) commands will be stored
const buttonActions = new Collection() // Where button actions will be stored
const commandPermssions = {}
const token = process.env.DISCORD_TOKEN
const rest = new REST({ version: '10' }).setToken(token)

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

async function initButtonActions () {
  const actionFiles = fs
    .readdirSync('src/button-actions')
    .filter(file => file.endsWith('.js')) // Get and filter all the files in the "Commands" Folder.

  // Loop through the command files
  for (const file of actionFiles) {
    const fileActions = require(`../button-actions/${file}`) // Get and define the command file.
    fileActions.forEach(action => {
      buttonActions.set(action.name, action.handler) // Set the command name and file for handler to use.
    })
  }
}
initButtonActions()

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

/**
 * Responds to the button interaction
 * @param {ButtonInteraction} interaction The button interaction
 * @param {*} client The Discord bot client
 */
async function respondToButton (interaction, client) {
  const handler = buttonActions.get(interaction.customId)
  handler(interaction, client)
}

/**
 * Responds to the user interaction with the bot
 * @param {BaseInteraction} interaction The interaction with the bot
 */
async function respondToInteraction (interaction) {
  if (interaction.isButton()) return respondToButton(interaction)
  if (interaction.isCommand()) return respondToCommand(interaction)
}

module.exports = { client, token, registerSlashCommands, respondToInteraction }

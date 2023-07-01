const fs = require('fs')
// eslint-disable-next-line no-unused-vars
const { BaseInteraction, CommandInteraction, AutocompleteInteraction, ButtonInteraction, ModalSubmitInteraction } = require('discord.js')
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js')
const path = require('path')
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
}) // Connect to our discord bot
let commands = new Collection() // Where the bot (slash) commands will be stored
const buttonActions = new Collection() // Where button actions will be stored
const modalActions = new Collection() // Where modal submit action handlers will be stored
const commandPermssions = {}
const token = process.env.DISCORD_TOKEN
const rest = new REST({ version: '10' }).setToken(token)

function directoryFiles (dir) {
  return fs.readdirSync(path.join('src', dir)).map(name => ({ name, path: dir }))
}

async function registerSlashCommands () {
  commands = new Collection()
  const commandArray = [] // Array to store commands for sending to the REST API
  const commandFiles = directoryFiles('commands/chat-input')
    .concat(directoryFiles('commands/context-menu'))
    .filter(({ name }) => name.endsWith('.js'))

  // Loop through the command files
  for (const { path, name } of commandFiles) {
    const command = require(`../${path}/${name}`) // Get and define the command file.
    commands.set((command.data.type || 1) + '_' + command.data.name, command) // Set the command name and file for handler to use.
    commandArray.push(command.data.toJSON()) // Push the command data to an array (for sending to the API).
    commandPermssions[command.data.name] = command.userPermissions || []
  }

  // Send command list to Discord API
  const body = commandArray.sort((a, b) => (commandPermssions[a.name]?.length || 0) - (commandPermssions[b.name]?.length || 0))
  try {
    console.log('Refreshing application commands...')
    const commandResponse = await rest.put(Routes.applicationCommands(client.user.id), { body })
    console.log('Successfully reloaded application commands.')
    return { success: true, message: 'Successfully reloaded application commands', request: body, response: commandResponse }
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

async function initModalActions () {
  const actionFiles = fs
    .readdirSync('src/modal-actions')
    .filter(file => file.endsWith('.js')) // Get and filter all the files in the "Commands" Folder.

  // Loop through the command files
  for (const file of actionFiles) {
    const fileActions = require(`../modal-actions/${file}`) // Get and define the command file.
    fileActions.forEach(action => {
      modalActions.set(action.name, action.handler) // Set the command name and file for handler to use.
    })
  }
}

initButtonActions()
initModalActions()

/**
 * Responds to an interaction
 * @param {CommandInteraction} interaction The interaction
 */
async function respondToCommand (interaction) {
  const command = commands.get(interaction.commandType + '_' + interaction.commandName)
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
 * Responds to an interaction
 * @param {AutocompleteInteraction} interaction The interaction
 */
async function respondToAutocomplete (interaction) {
  const command = commands.get(interaction.commandType + '_' + interaction.commandName)
  if (!command) return

  try {
    await command.autocomplete(interaction, client)
  } catch (error) {
    console.error(error)
    return interaction.respond([])
  }
}

/**
 * Responds to the button interaction
 * @param {ButtonInteraction} interaction The button interaction
 * @param {Client} client The Discord bot client
 */
async function respondToButton (interaction, client) {
  interaction.baseID = interaction.customId.replace(/#.*$/, '')
  interaction.extension = interaction.customId.replace(interaction.baseID + '#', '')
  const handler = buttonActions.get(interaction.baseID)
  if (!handler) {
    return interaction.reply({
      content: 'There is no event handler for this button',
      ephemeral: true
    })
  }

  try {
    await handler(interaction, client)
  } catch (error) {
    console.error(error)
    return interaction.reply({
      content: 'There was an error while executing this command!',
      ephemeral: true
    })
  }
}

/**
 * Responds to the modal submission interaction
 * @param {ModalSubmitInteraction} interaction The submission interaction
 * @param {Client} client The Discord bot client
 */
async function respondToModalSubmit (interaction, client) {
  interaction.baseID = interaction.customId.replace(/#.*$/, '')
  interaction.extension = interaction.customId.replace(interaction.baseID + '#', '')
  const handler = modalActions.get(interaction.baseID)
  if (!handler) {
    return interaction.reply({
      content: 'There is no event handler for this modal',
      ephemeral: true
    })
  }

  try {
    await handler(interaction, client)
  } catch (error) {
    console.error(error)
    return interaction.reply({
      content: 'There was an error while executing this command!',
      ephemeral: true
    })
  }
}

/**
 * Responds to the user interaction with the bot
 * @param {BaseInteraction} interaction The interaction with the bot
 */
async function respondToInteraction (interaction) {
  if (interaction.isButton()) return respondToButton(interaction)
  if (interaction.isCommand()) return respondToCommand(interaction)
  if (interaction.isAutocomplete()) return respondToAutocomplete(interaction)
  if (interaction.isModalSubmit()) return respondToModalSubmit(interaction)
}

module.exports = { client, token, registerSlashCommands, respondToInteraction }

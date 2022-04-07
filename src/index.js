require('dotenv').config()

const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const fs = require('fs')
const { Client, Intents, Collection } = require('discord.js')
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
}) // Connect to our discord bot
const commands = new Collection() // Where the bot (slash) commands will be stored
const commandarray = [] // Array to store commands for sending to the REST API
const token = process.env.DISCORD_TOKEN

function registerSlashCommands () {
  const commandFiles = fs
    .readdirSync('src/commands')
    .filter(file => file.endsWith('.js')) // Get and filter all the files in the "Commands" Folder.

  // Loop through the command files
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`) // Get and define the command file.
    commands.set(command.data.name, command) // Set the command name and file for handler to use.
    commandarray.push(command.data.toJSON()) // Push the command data to an array (for sending to the API).
  }

  const rest = new REST({ version: '9' }).setToken(token);
  // Send command list to Discord API
  (async () => {
    try {
      console.log('Refreshing application (/) commands...')
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandarray
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

client.once('ready', registerSlashCommands)
client.on('interactionCreate', async interaction => {
  // Command handler
  if (!interaction.isCommand()) return
  respondToCommand(interaction)
})

client.login(token)

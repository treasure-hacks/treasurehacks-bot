const { SlashCommandBuilder } = require('discord.js')
const axios = require('axios')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Say Hello To me!'),
  execute: async (interaction, client) => {
    const greetings = ['Hey there!', 'Hello!', 'What\'s up?', 'Welcome to Treasure Hacks!', 'How\'s it going?', 'Hi!']
    const fact = await axios({
      method: 'GET',
      url: 'https://uselessfacts.jsph.pl/random.json?language=en'
    }).catch(e => {})
    if (!fact?.data) return interaction.reply(greetings[Math.floor(Math.random() * greetings.length)])
    return interaction.reply(`${greetings[Math.floor(Math.random() * greetings.length)]} Did you know that ${fact.data.text.replace(/[.!?]\s*$/, '').replace(/`/g, '\'')}?`)
  }
}

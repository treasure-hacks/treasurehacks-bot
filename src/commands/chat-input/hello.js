// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder } = require('discord.js')

/**
 * Says hello to the user, and provides a random fact
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function sayHello (interaction, client) {
  const greetings = ['Hey there!', 'Hello!', 'What\'s up?', 'Welcome to Treasure Hacks!', 'How\'s it going?', 'Hi!']
  const fact = await fetch('https://uselessfacts.jsph.pl/random.json?language=en')
    .then(x => x.json()).catch(() => {})
  if (!fact) return interaction.reply(greetings[Math.floor(Math.random() * greetings.length)])
  const factText = fact.text
    .replace(/([^.]{15})[.!?](?=\s+[A-Z]|s*$)/, '$1?') // Replace first sentence with a question
    .replace(/`/g, '\'') // Replace backticks with single quotes
    .replace(/^(the|a|since|until|in|out|when|if|over|under|about|there|here|it|you|this|most|some|all)\b/i,
      m0 => m0.toLowerCase()) // Lowercase the most common first words of the fact
  return interaction.reply(`${greetings[Math.floor(Math.random() * greetings.length)]} ` +
    `Did you know that ${factText}`)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Say Hello To me!'),
  execute: sayHello
}

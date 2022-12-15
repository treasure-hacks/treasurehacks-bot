// eslint-disable-next-line no-unused-vars
const { ButtonInteraction } = require('discord.js')

/**
 * Replies to a button click
 * @param {ButtonInteraction} interaction The button interaction
 */
function respond (interaction) {
  interaction.reply('You clicked me!')
}

module.exports = [
  { name: 'btn_my_custom_button_id', handler: respond }
]

// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const discordTranscripts = require('discord-html-transcripts')
const { JSDOM } = require('jsdom')
const md5 = str => require('crypto').createHash('md5').update(str).digest('hex')
const JSZip = require('jszip')

/**
 * Handles the slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function createTranscript (interaction, client) {
  const embeds = [{
    color: 0x0092cc,
    description: '⏳ Creating Transcript',
    footer: { text: 'File will be posted to this channel once finished' }
  }]

  const transcriptSt = discordTranscripts.createTranscript(interaction.channel, {
    hydrate: true,
    footerText: 'Exported {number} message{s}',
    poweredBy: false
  })
  await interaction.reply({ embeds }) // so this reply does not get included
  const transcript = await transcriptSt

  /** @todo figure out how to programmatically test this stuff */
  const html = new TextDecoder().decode(transcript.attachment)
  const document = new JSDOM(html).window.document
  const zip = new JSZip()

  const footer = document.querySelector('discord-messages > :last-child')
  footer.innerHTML += process.env.EXPORT_FOOTER_CONTENT
  document.querySelectorAll('.discord-author-avatar img').forEach(img => {
    img.src = img.src.replace('?size=64', '?size=240')
  })

  const dsAttachments = [...document.querySelectorAll('discord-attachment')]
  await Promise.all(dsAttachments.map(async da => {
    const url = da.getAttribute('url')
    const ext = url.match(/\.([^.]+)\?/)?.at(1) || ''
    const name = `${md5(url)}.${ext}`

    da.setAttribute('url', name)
    const file = await fetch(url).then(x => x.arrayBuffer()).catch(() => {})
    zip.file(name, file)
  }))

  zip.file(`transcript__${interaction.channel.name}.html`, document.documentElement.outerHTML)
  const dl = await zip.generateAsync({ type: 'nodebuffer' })
  transcript.attachment = dl
  transcript.name = transcript.name.replace('.html', '.zip')

  interaction.channel.send({
    content: 'Your transcript is ready to download',
    files: [transcript]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Creates an HTML transcript of the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction, client) => {
    return createTranscript(interaction, client)
  }
}

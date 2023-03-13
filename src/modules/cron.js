// eslint-disable-next-line no-unused-vars
const { Client, Guild } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
const cron = require('node-cron')

/**
 * Initiates a cronjob
 * @param {Guild} guild The guild that the cronjob applies to
 * @param {Object} job The cronjob to initiate
 */
async function initJob (guild, job) {
  if (job.type !== 'message') return // Nothing yet
  cron.schedule(job.frequency, async () => {
    const channel = await guild.channels.fetch(job.channel)
    channel.send(job.message)
  }, { timezone: 'America/Los_Angeles' })
}

/**
 * Initiates cronjobs for sending messages
 * @param {Client} client The bot client
 */
async function initCronjobs (client) {
  const guilds = await client.guilds.fetch()
  for (const guild of guilds.map(g => g)) {
    const serverConfig = await serverSettingsDB.get(guild.id)
    const cronJobs = serverConfig.cronJobs || []
    cronJobs.forEach(async j => initJob(await guild.fetch(), j))
  }
}

module.exports = { initCronjobs }

require('dotenv').config()
const path = require('path')

// Discord.JS Setup
const fs = require('fs')
const { Events } = require('discord.js')

// Treasure Hacks Bot Setup
const { client, token, registerSlashCommands, respondToInteraction } = require('./modules/bot-setup.js')
const { initCronjobs } = require('./modules/cron')

client.once('ready', async () => {
  console.log(`Logged in as \x1b[34m${client.user.tag}\x1b[0m`)
  registerSlashCommands()
  initCronjobs(client)
})
client.on(Events.InteractionCreate, respondToInteraction)

// Event Listeners
for (const file of fs.readdirSync('src/listeners')) {
  require('./listeners/' + file)
}

client.login(token)

const PORT = process.env.PORT
const express = require('express')
const cors = require('cors')
const site = express()
site.use(express.json({ extended: true, limit: '5mb' }))
site.use(express.urlencoded({ extended: true }))

const whitelist = process.env.CORS_ORIGINS.split(', ')
function wildcard (origin, root) {
  if (!origin) return null
  const host = new URL(origin).host
  return origin.replace(host, '') + host.replace(/^\w+/, root ? '*.$&' : '*')
}
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 ||
      whitelist.includes(wildcard(origin)) || whitelist.includes(wildcard(origin, true))
    ) {
      callback(null, true)
    } else {
      callback(null, false)
    }
  },
  optionsSuccessStatus: 200
}
site.use(cors(corsOptions))

// Application web-accessible "API" routes
function recursiveRoutes (folderName) {
  fs.readdirSync(folderName).forEach(function (file) {
    const fullName = path.join(folderName, file)
    const stat = fs.lstatSync(fullName)

    if (stat.isDirectory()) {
      recursiveRoutes(fullName)
    } else if (file.toLowerCase().includes('.js')) {
      const routeName = fullName.replace(/^src\/routes|\.js$/g, '')
      const route = require('../' + fullName)
      site.use(routeName.replace(/\/index$/, ''), route)
    }
  })
}
recursiveRoutes('src/routes')

site.use((req, res) => {
  res.status(404).send('404 Page not found')
})
const http = require('http')
const server = http.Server(site)
server.listen(PORT, function () {
  console.log('Listening on port ' + PORT)
})

// TO DO: listen for role or channel create/destroy

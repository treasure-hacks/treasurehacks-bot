const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URL).then(() => console.log('Connected to DB'))

const ServerSettings = mongoose.model('server-settings', new mongoose.Schema({
  _id: String,
  alertsChannel: String,
  attendance: Object,
  channelRequest: { enabled: Boolean, syncFirst: Boolean, category: String },
  cryptoScamScanner: { enabled: Boolean, maxDays: Number, ignoredRoles: [{ type: String }] },
  helpfulMessages: { type: [{ type: { channel: String, id: String, user: String } }], default: undefined },
  inviteRoles: { type: Array, default: undefined },
  leaderboards: Object,
  linkScanner: { enabled: Boolean, ignoredRoles: [{ type: String }] },
  logChannel: String,
  messageCounter: { enabled: Boolean, counts: Object, ignoredRoles: [{ type: String }] },
  singlePostChannels: { type: Array, default: undefined }
}, { versionKey: false }))

const serverSettingsDB = {
  get: async function (serverID) {
    const response = await ServerSettings.findById(serverID).lean()
    if (!response) return null

    // for auto type recognition to be correct
    const data = { ...response, key: response._id, _id: undefined }
    return data
  },
  put: async function (data) {
    const id = data.key
    delete data.key
    await ServerSettings.findByIdAndUpdate(id, data, { new: true, upsert: true })
  }
}

module.exports = { serverSettingsDB }

const express = require('express')
const router = express.Router()
const { addToRole } = require('../../../scripts/role-manager')
const Joi = require('joi')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')

router.post('/google-form', validateAPIKey, async (req, res) => {
  const isValid = validateBody(req, res, {
    guild: Joi.string().required(),
    discord_tag: Joi.string().regex(/^.*#\d{4}$/).required(),
    role: Joi.string().required(),
    reason: Joi.string().required()
  }, { allowUnknown: true })
  if (!isValid) return

  const { guild, discord_tag: discordTag, role, reason } = req.body
  const roleAddResponse = await addToRole(guild, discordTag, role, reason)
  res.send(roleAddResponse)
})

module.exports = router

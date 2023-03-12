const express = require('express')
const router = express.Router()
const { addMultipleRoles } = require('../../../scripts/role-manager')
const Joi = require('joi')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')

router.post('/add', validateAPIKey, async (req, res) => {
  const isValid = validateBody(req, res, {
    guild: Joi.string().required(),
    discord_tag: Joi.string().regex(/^.*#\d{4}$/).required(),
    roles: Joi.array().items(Joi.string()).required().min(1),
    reason: Joi.string().required()
  }, { allowUnknown: true })
  if (!isValid) return

  const { guild, discord_tag: discordTag, roles, reason } = req.body
  const roleAddResponse = await addMultipleRoles(guild, discordTag, roles, reason)
  res.send(roleAddResponse)
})

module.exports = router

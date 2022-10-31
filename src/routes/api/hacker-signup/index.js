const express = require('express')
const router = express.Router()
const { addToRole } = require('../../../scripts/role-manager')
const Joi = require('joi')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')

router.post('/google-form', validateAPIKey, (req, res) => {
  const isValid = validateBody(req, res, { discord_tag: Joi.string().regex(/^.*#\d{4}$/).required() })
  if (!isValid) return
  addToRole()
})

module.exports = router

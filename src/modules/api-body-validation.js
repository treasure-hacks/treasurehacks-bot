const Joi = require('joi')

function validateBody (req, res, schema) {
  const { error } = Joi.object(schema).validate(req.body)
  if (!error) return true
  const errors = error.details.map(d => d.message)
  return res.status(400).send({ errors })
}

module.exports = { validateBody }

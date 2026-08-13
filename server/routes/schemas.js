export const idParams = (name) => ({
  type: 'object',
  additionalProperties: false,
  required: [name],
  properties: { [name]: { type: 'string', minLength: 1, maxLength: 200 } }
})

export const objectDataResponse = {
  type: 'object',
  required: ['data'],
  properties: {
    data: { type: 'object', additionalProperties: true }
  }
}

export const listDataResponse = {
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: {
      type: 'array',
      items: { type: 'object', additionalProperties: true }
    },
    meta: { type: 'object', additionalProperties: true }
  }
}

const taskProperties = {
  name: { type: 'string', minLength: 1, maxLength: 100 },
  description: { type: 'string', maxLength: 2000 },
  steps: {
    type: 'array',
    minItems: 1,
    maxItems: 10,
    items: { type: 'string', minLength: 1, maxLength: 120 }
  },
  targetType: { type: 'string', enum: ['builtin', 'upload', 'url'] },
  targetUrl: { type: 'string', maxLength: 2000 },
  status: { type: 'string', enum: ['draft', 'active', 'paused'] }
}

export const createTaskBody = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'steps'],
  properties: taskProperties
}

export const updateTaskBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: taskProperties.name,
    description: taskProperties.description,
    steps: taskProperties.steps,
    targetUrl: taskProperties.targetUrl,
    status: taskProperties.status
  }
}

export const bearerSecurity = [{ participantToken: [] }]

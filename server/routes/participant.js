import { AppError } from '../errors.js'
import { bearerSecurity, idParams, objectDataResponse } from './schemas.js'

const bearerToken = (request) => {
  const match = /^Bearer\s+(.+)$/i.exec(String(request.headers.authorization || ''))
  if (!match) throw new AppError(401, 'INVALID_SESSION_TOKEN', '会话凭证无效')
  return match[1]
}

const completionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['couponDecision'],
  properties: {
    couponDecision: { type: 'string', enum: ['none', 'applied', 'declined'] },
    duration: { type: 'number', minimum: 0 },
    metrics: { type: 'object', additionalProperties: true },
    result: { type: 'object', additionalProperties: true },
    events: {
      type: 'array',
      maxItems: 10000,
      items: { type: 'object', additionalProperties: true }
    },
    faceFrames: {
      type: 'array',
      maxItems: 600,
      items: { type: 'object', additionalProperties: true }
    }
  }
}

export function participantRoutes(app, _options, done) {
  app.get('/participant/tasks/:taskToken', {
    schema: {
      tags: ['participant'], params: idParams('taskToken'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({ data: app.services.tasks.getPublic(request.params.taskToken) }))

  app.post('/participant/tasks/:taskToken/sessions', {
    bodyLimit: 16 * 1024,
    schema: {
      tags: ['participant'],
      params: idParams('taskToken'),
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['consent'],
        properties: { consent: { const: true } }
      },
      response: { 201: objectDataResponse }
    }
  }, async (request, reply) => reply.code(201).send({
    data: app.services.sessions.createParticipant(request.params.taskToken, request.body.consent)
  }))

  app.get('/participant/sessions/:sessionId', {
    schema: {
      tags: ['participant'], security: bearerSecurity,
      params: idParams('sessionId'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.sessions.getPublic(request.params.sessionId, bearerToken(request))
  }))

  app.post('/participant/sessions/:sessionId/start', {
    schema: {
      tags: ['participant'], security: bearerSecurity,
      params: idParams('sessionId'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.sessions.start(request.params.sessionId, bearerToken(request))
  }))

  app.post('/participant/sessions/:sessionId/complete', {
    bodyLimit: 12 * 1024 * 1024,
    schema: {
      tags: ['participant'], security: bearerSecurity,
      params: idParams('sessionId'), body: completionBody,
      response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.sessions.complete(
      request.params.sessionId,
      bearerToken(request),
      request.body
    )
  }))

  app.delete('/participant/sessions/:sessionId', {
    schema: {
      tags: ['participant'], security: bearerSecurity,
      params: idParams('sessionId'), response: { 200: objectDataResponse }
    }
  }, async (request) => {
    app.services.sessions.abandon(request.params.sessionId, bearerToken(request))
    return { data: { deleted: true } }
  })

  app.get('/reports/:shareToken', {
    schema: {
      tags: ['participant'], params: idParams('shareToken'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.analysis.getSharedReport(request.params.shareToken)
  }))

  done()
}

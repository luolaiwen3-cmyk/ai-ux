import { idParams, listDataResponse, objectDataResponse } from './schemas.js'

export function sessionRoutes(app, _options, done) {
  app.addHook('preHandler', app.requireAdmin)

  app.get('/sessions', {
    schema: {
      tags: ['sessions'],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['created', 'recording', 'completed', 'abandoned'] },
          sort: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          mode: { type: 'string', enum: ['participant', 'trial', 'all'], default: 'participant' }
        }
      },
      response: { 200: listDataResponse }
    }
  }, async (request) => {
    const sessions = app.services.sessions.list(request.query)
    return { data: sessions, meta: { total: sessions.length } }
  })

  app.get('/sessions/:sessionId', {
    schema: {
      tags: ['sessions'], params: idParams('sessionId'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({ data: app.services.sessions.get(request.params.sessionId) }))

  app.post('/sessions/:sessionId/diagnosis', {
    schema: {
      tags: ['sessions'], params: idParams('sessionId'), response: { 202: objectDataResponse }
    }
  }, async (request, reply) => {
    const diagnosis = app.services.analysis.enqueueDiagnosis(request.params.sessionId)
    app.diagnosisWorker.wake()
    return reply.code(202).send({ data: diagnosis })
  })

  app.get('/sessions/:sessionId/diagnosis', {
    schema: {
      tags: ['sessions'], params: idParams('sessionId'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.analysis.getDiagnosis(request.params.sessionId)
  }))

  app.get('/dashboard', {
    schema: { tags: ['sessions'], response: { 200: objectDataResponse } }
  }, async () => ({ data: app.services.analysis.dashboard() }))

  done()
}

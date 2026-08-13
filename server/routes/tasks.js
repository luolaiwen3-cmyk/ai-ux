import { idParams, listDataResponse, objectDataResponse, createTaskBody, updateTaskBody } from './schemas.js'

export function taskRoutes(app, _options, done) {
  app.addHook('preHandler', app.requireAdmin)

  app.get('/tasks', {
    schema: { tags: ['tasks'], response: { 200: listDataResponse } }
  }, async () => {
    const tasks = app.services.tasks.list()
    return {
      data: tasks,
      meta: { total: tasks.length, publicAppUrl: app.config.publicAppUrl }
    }
  })

  app.post('/tasks', {
    bodyLimit: 64 * 1024,
    schema: {
      tags: ['tasks'], body: createTaskBody, response: { 201: objectDataResponse }
    }
  }, async (request, reply) => reply.code(201).send({
    data: app.services.tasks.create(request.body)
  }))

  app.get('/tasks/:taskId', {
    schema: {
      tags: ['tasks'], params: idParams('taskId'), response: { 200: objectDataResponse }
    }
  }, async (request) => ({ data: app.services.tasks.get(request.params.taskId) }))

  app.patch('/tasks/:taskId', {
    bodyLimit: 64 * 1024,
    schema: {
      tags: ['tasks'], params: idParams('taskId'), body: updateTaskBody,
      response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.tasks.update(request.params.taskId, request.body)
  }))

  app.post('/tasks/:taskId/url-validation', {
    bodyLimit: 16 * 1024,
    schema: {
      tags: ['tasks'],
      params: idParams('taskId'),
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['origin', 'sdkVersion'],
        properties: {
          origin: { type: 'string', maxLength: 2000 },
          sdkVersion: { type: 'string', maxLength: 40 }
        }
      },
      response: { 200: objectDataResponse }
    }
  }, async (request) => ({
    data: app.services.tasks.validateUrl(request.params.taskId, request.body)
  }))

  app.post('/tasks/:taskId/trials', {
    schema: {
      tags: ['tasks'], params: idParams('taskId'), response: { 201: objectDataResponse }
    }
  }, async (request, reply) => reply.code(201).send({
    data: app.services.sessions.createTrial(request.params.taskId)
  }))

  done()
}

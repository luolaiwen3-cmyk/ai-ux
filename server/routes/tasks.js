import { idParams, listDataResponse, objectDataResponse, createTaskBody, updateTaskBody } from './schemas.js'

export function taskRoutes(app, _options, done) {
  app.addContentTypeParser(
    ['application/zip', 'application/x-zip-compressed'],
    (request, payload, next) => next(null, payload)
  )
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

  app.put('/tasks/:taskId/site', {
    schema: { tags: ['tasks'], params: idParams('taskId') }
  }, async (request) => {
    const task = app.services.tasks.get(request.params.taskId)
    const installed = await app.siteStorage.installZip(request.body, task)
    const updated = app.services.tasks.installSite(task.id, installed)
    return {
      data: {
        task: updated,
        site: {
          fileCount: installed.fileCount,
          expandedBytes: installed.expandedBytes,
          launchUrl: `/test-content/${updated.contentToken}/index.html`
        }
      }
    }
  })

  done()
}

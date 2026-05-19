import { Express, Request, Response } from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Photopya API Documentation',
      version: '1.0.0',
      description: 'API documentation for Photopya backend',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Local server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/app/modules/**/*.route.ts'], // Path to the API docs
}

const swaggerSpec = swaggerJsdoc(options)

function swaggerDocs(app: Express, port: number) {
  // Swagger Page
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  // Docs in JSON format
  app.get('/docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  console.log(`📚 Swagger docs available at http://localhost:${port}/docs`)
}

export default swaggerDocs

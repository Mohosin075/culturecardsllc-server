# Upload Module

Endpoint for presigned AWS S3 uploads, used to offload large media directly from client to S3.

## Endpoint

- POST `/upload/presign` (requires auth: USER, ADMIN, SUPER_ADMIN)
- Route: [`upload.route.ts`](file:///d:/Mohosin/Mohosin/projects/Photopya-ayoubouajj/src/app/modules/upload/upload.route.ts)
- Controller: [`upload.controller.ts`](file:///d:/Mohosin/Mohosin/projects/Photopya-ayoubouajj/src/app/modules/upload/upload.controller.ts)

## Request

- Body: `{ filename: string, contentType: string, folder?: 'videos' | 'images' }`
- Default folder: `videos`
- URL TTL: 3600 seconds

## Response

- `{ signedUrl: string, publicUrl: string, key: string }`

## Flow

- Request a presigned upload URL from the backend
- Upload the file directly to S3 using `PUT signedUrl` with the correct `Content-Type` header
- Persist your resource using the returned `publicUrl` (and optionally size and type)

## Example

```ts
const { data } = await api.post('/upload/presign', {
  filename: file.name,
  contentType: file.type,
  folder: 'videos',
})

await fetch(data.signedUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
})

await api.post('/post', {
  caption: 'Test',
  media_source: [{ url: data.publicUrl, type: 'video', size: file.size }],
})
```

## Notes

- For large uploads, use presigned URLs; server-side multipart uploads may be rejected on serverless deployments.
- Requires AWS credentials and bucket configuration (see `AWS_*` variables in the root README).

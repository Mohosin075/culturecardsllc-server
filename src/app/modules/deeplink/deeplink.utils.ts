export interface IOpenGraphOptions {
  title: string
  description: string
  image: string
  pageUrl: string
  deepLink: string
  buttonText: string
  isAvatar?: boolean
}

export const generateOpenGraphHtml = (options: IOpenGraphOptions): string => {
  const {
    title,
    description,
    image,
    pageUrl,
    deepLink,
    buttonText,
    isAvatar = false,
  } = options

  const imageStyle = isAvatar
    ? 'width: 120px; height: 120px; border-radius: 60px; margin-bottom: 16px; object-fit: cover;'
    : 'max-width: 100%; border-radius: 12px; margin-bottom: 16px; object-fit: cover; max-height: 300px;'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta property="og:type" content="${isAvatar ? 'profile' : 'website'}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0f172a; color: #fff; margin: 0; }
    .card { max-width: 400px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    img { ${imageStyle} }
    h2 { font-size: 1.25rem; margin: 8px 0; color: #f8fafc; }
    p { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #fff; font-weight: bold; text-decoration: none; border-radius: 8px; font-size: 0.95rem; transition: background 0.2s; }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${image}" alt="${title}" />
    <h2>${title}</h2>
    <p>${description}</p>
    <a href="${deepLink}" class="btn">${buttonText}</a>
  </div>
  <script>
    window.location.href = "${deepLink}";
  </script>
</body>
</html>`
}

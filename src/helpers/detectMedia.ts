// Helper function to detect media type from URL
export function detectMediaType(mediaUrl: string): 'photo' | 'video' {
  const url = mediaUrl.toLowerCase()

  // Common image extensions
  const imageExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.webp',
    '.heic',
  ]
  // Common video extensions
  const videoExtensions = [
    '.mp4',
    '.mov',
    '.avi',
    '.mkv',
    '.webm',
    '.flv',
    '.wmv',
    '.m4v',
  ]

  const isImage = imageExtensions.some(ext => url.includes(ext))
  const isVideo = videoExtensions.some(ext => url.includes(ext))

  if (isImage) return 'photo'
  if (isVideo) return 'video'

  // Default to photo if unknown
  console.warn(
    `⚠️ Unknown media type for URL: ${mediaUrl}, defaulting to photo`,
  )
  return 'photo'
}

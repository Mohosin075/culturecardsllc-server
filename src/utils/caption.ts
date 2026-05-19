export function buildCaptionWithTags(
  caption?: string,
  tags?: string[],
): string {
  if (!tags || tags.length === 0) {
    return caption ?? ''
  }

  const hashTags = tags
    .map(tag => (tag.startsWith('#') ? tag : `#${tag}`))
    .join(' ')

  // Add hashtags after two line breaks if caption exists
  return caption ? `${caption}\n\n${hashTags}` : hashTags
}

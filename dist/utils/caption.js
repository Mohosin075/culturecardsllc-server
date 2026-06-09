"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCaptionWithTags = buildCaptionWithTags;
function buildCaptionWithTags(caption, tags) {
    if (!tags || tags.length === 0) {
        return caption !== null && caption !== void 0 ? caption : '';
    }
    const hashTags = tags
        .map(tag => (tag.startsWith('#') ? tag : `#${tag}`))
        .join(' ');
    // Add hashtags after two line breaks if caption exists
    return caption ? `${caption}\n\n${hashTags}` : hashTags;
}

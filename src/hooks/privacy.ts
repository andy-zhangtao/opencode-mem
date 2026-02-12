const PRIVATE_TAG_REGEX = /<private>[\s\S]*?<\/private>/gi;

export function stripPrivateTags(content: string): string {
  return content.replace(PRIVATE_TAG_REGEX, "");
}

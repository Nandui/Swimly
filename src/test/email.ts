/** Reads our MIME messages for synthetic tests and the loopback preview only. */
export function readEmailParts(mime: string): { headers: string; type: string; content: Buffer }[] {
  const separator = mime.indexOf("\r\n\r\n");
  if (separator < 0) throw new Error("Missing MIME header separator.");
  const headers = mime.slice(0, separator), body = mime.slice(separator + 4);
  const type = /^Content-Type: ([^;\r\n]+)/mi.exec(headers)?.[1].toLowerCase() ?? "text/plain";
  if (type.startsWith("multipart/")) {
    const boundary = /boundary="([^"]+)"/i.exec(headers)?.[1];
    if (!boundary) throw new Error("Missing MIME boundary.");
    const chunks = body.split(`--${boundary}`);
    if (chunks.at(-1)?.trim() !== "--") throw new Error("Missing MIME closing boundary.");
    return chunks.slice(1, -1).flatMap(chunk => readEmailParts(chunk.replace(/^\r\n/, "").replace(/\r\n$/, "")));
  }
  if (!/^Content-Transfer-Encoding: base64\r?$/mi.test(headers)) throw new Error("Expected base64 MIME content.");
  return [{ headers, type, content: Buffer.from(body.trim(), "base64") }];
}

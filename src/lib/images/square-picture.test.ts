import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { squarePicture } from "@/lib/images/square-picture";

const file = async (bytes: Buffer, type = "image/png") => new File([new Uint8Array(bytes)], "logo.png", { type });

test("a solid picture (a supplier's logo) is a white-backed 512px WebP square with no see-through parts", async () => {
  const logo = await sharp({ create: { width: 600, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const result = await squarePicture(await file(logo), { solid: true });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const meta = await sharp(result.bytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.hasAlpha, false);
  const { data } = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240, "the empty corner is white");
});

test("anything that is not a real JPG, PNG or WebP, or too big, is refused in plain words", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.deepEqual(await squarePicture(await file(svg, "image/svg+xml")), { ok: false, error: "Choose a JPG, PNG or WebP image." });
  assert.deepEqual(await squarePicture(await file(svg)), { ok: false, error: "That file is not a valid JPG, PNG or WebP image." });
  assert.deepEqual(await squarePicture(await file(Buffer.alloc(0))), { ok: false, error: "That image is empty. Choose another file." });
  assert.deepEqual(await squarePicture(await file(Buffer.alloc(3 * 1024 * 1024))), { ok: false, error: "Choose an image under 2 MB." });
});

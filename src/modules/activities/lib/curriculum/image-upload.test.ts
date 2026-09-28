import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { prepareImage } from "./image-upload";
import { IMAGE_MAX_BYTES } from "./image";

async function upload(format: "png" | "jpeg" | "webp" = "png") {
  const bytes = await sharp({ create: { width: 900, height: 300, channels: 4, background: "blue" } })[format]().toBuffer();
  const form = new FormData();
  form.set("image", new File([new Uint8Array(bytes)], `sample.${format}`, { type: `image/${format}` }));
  return form;
}

test("JPG, PNG and WebP uploads become bounded square WebP images with deterministic versions", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const form = await upload(format);
    const result = await prepareImage(form);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const metadata = await sharp(result.data.imageData!).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(metadata.exif, undefined);
    assert.ok(result.data.imageData!.length <= 262144);
    const again = await prepareImage(form);
    assert.ok(again.ok);
    assert.equal(again.data.imageVersion, result.data.imageVersion);
  }
});

test("no upload preserves the image, removal is explicit, and conflicting input is rejected", async () => {
  assert.deepEqual(await prepareImage(), { ok: true, data: {} });
  assert.deepEqual(await prepareImage(new FormData()), { ok: true, data: {} });
  const form = new FormData(); form.set("removeImage", "true");
  assert.deepEqual(await prepareImage(form), { ok: true, data: { imageData: null, imageVersion: null } });
  const conflict = await upload(); conflict.set("removeImage", "true");
  assert.equal((await prepareImage(conflict)).ok, false);
});

test("oversized, empty, corrupt and disguised document uploads are refused", async () => {
  for (const file of [
    new File([new Uint8Array(IMAGE_MAX_BYTES + 1)], "large.png", { type: "image/png" }),
    new File([], "empty.png", { type: "image/png" }),
    new File(["not a png"], "bad.png", { type: "image/png" }),
    new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>'], "fake.png", { type: "image/png" }),
    new File(["content"], "bad.svg", { type: "image/svg+xml" }),
  ]) {
    const form = new FormData(); form.set("image", file);
    assert.equal((await prepareImage(form)).ok, false, file.name);
  }
  const pixels = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: "white" } }).png().toBuffer();
  const form = new FormData(); form.set("image", new File([new Uint8Array(pixels)], "huge.png", { type: "image/png" }));
  assert.equal((await prepareImage(form)).ok, false);
});

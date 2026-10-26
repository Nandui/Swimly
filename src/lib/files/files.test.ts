import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptFor, fileProblem, readUploadForm, safeFileName, sizeLimit } from "@/lib/files";

/** The platform's one file check: a file is what its first bytes say, refused in one sentence. */
const JPEG = Uint8Array.from([255, 216, 255, 224, 0, 16]);
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const WEBP = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
const PDF = new TextEncoder().encode("%PDF-1.7");
const photos = { kinds: ["photo"] as const, maxBytes: 8 * 1024 * 1024 };
const meta = (name: string, type: string, bytes: Uint8Array) => ({ name, type, size: bytes.length });

test("a real JPEG, PNG or WebP photo passes", () => {
  assert.equal(fileProblem(meta("leak.jpg", "image/jpeg", JPEG), JPEG, photos), null);
  assert.equal(fileProblem(meta("LEAK.JPEG", "image/jpeg", JPEG), JPEG, photos), null);
  assert.equal(fileProblem(meta("door.png", "image/png", PNG), PNG, photos), null);
  assert.equal(fileProblem(meta("tile.webp", "image/webp", WEBP), WEBP, photos), null);
});

test("anything that is not what it claims, or not a kind the app takes, is refused in one sentence", () => {
  const refused = "Use a photo (JPEG, PNG or WebP), up to 8 MB.";
  assert.equal(fileProblem(meta("leak.jpg", "image/jpeg", PNG), PNG, photos), refused, "a PNG named as a JPEG");
  assert.equal(fileProblem(meta("leak.png", "image/jpeg", JPEG), JPEG, photos), refused, "the name disagrees with the type");
  assert.equal(fileProblem(meta("plan.pdf", "application/pdf", PDF), PDF, photos), refused, "a PDF where only photos are taken");
  const svg = new TextEncoder().encode("<svg/>");
  assert.equal(fileProblem(meta("x.svg", "image/svg+xml", svg), svg, photos), refused);
  assert.equal(fileProblem(meta("empty.jpg", "image/jpeg", new Uint8Array()), new Uint8Array(), photos), refused);
  assert.equal(fileProblem({ name: "leak.jpg", type: "image/jpeg", size: 99 }, JPEG, photos), refused, "the size the browser said is not what arrived");
});

test("the size limit is the app's, and both kinds are named when both are taken", () => {
  const big = new Uint8Array(4 * 1024 * 1024 + 1); big.set(JPEG);
  const rule = { kinds: ["photo", "pdf"] as const, maxBytes: 4 * 1024 * 1024 };
  assert.equal(fileProblem(meta("big.jpg", "image/jpeg", big), big, rule), "Use a photo (JPEG, PNG or WebP) or a PDF, up to 4 MB.");
  assert.equal(fileProblem(meta("plan.pdf", "application/pdf", PDF), PDF, rule), null);
  assert.equal(sizeLimit(8 * 1024 * 1024), "8 MB");
  assert.equal(acceptFor(["photo"]), "image/jpeg,image/png,image/webp");
});

test("a stored name has no path or control characters and is never empty", () => {
  assert.equal(safeFileName("../../etc/passwd"), ".._.._etc_passwd");
  assert.equal(safeFileName("bad\nname.jpg"), "bad_name.jpg");
  assert.equal(safeFileName(""), "file");
  assert.equal(safeFileName("a".repeat(300)).length, 200);
});

test("an upload is read only from the staff app's own origin, and cut off past the limit", async () => {
  const upload = async (origin: string | null, size: number) => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(size)], "leak.jpg", { type: "image/jpeg" }));
    const encoded = new Request("http://turnfin.test/upload", { method: "POST", body: form });
    const body = new Uint8Array(await encoded.arrayBuffer());
    return new Request("http://turnfin.test/upload", { method: "POST", body, headers: { host: "turnfin.test", "content-type": encoded.headers.get("content-type")!, ...(origin ? { origin } : {}) } });
  };
  assert.deepEqual(await readUploadForm(await upload("http://elsewhere.test", 10), 1024), { ok: false, status: 403 });
  assert.deepEqual(await readUploadForm(await upload(null, 10), 1024), { ok: false, status: 403 });
  assert.deepEqual(await readUploadForm(await upload("http://turnfin.test", 400 * 1024), 1024), { ok: false, status: 413 });
  const read = await readUploadForm(await upload("http://turnfin.test", 10), 1024);
  assert.ok(read.ok);
  assert.equal((read.form.get("file") as File).size, 10);
});

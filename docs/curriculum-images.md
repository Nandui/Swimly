# Programme and level images

The add/edit programme and level forms accept one optional JPG, PNG or WebP
image, up to 2 MB and 16 megapixels. An image is saved with the form, never as
an independent temporary upload. Cancel keeps the original. Edit supports
replacement, removal and undoing a pending removal.

The server checks the file signature, decodes it with bounded pixels, rejects
animations, and converts it to a 512-pixel square WebP with transparent padding
so badges are not cropped. Metadata is stripped. Stored images are limited to
256 KB. These small curriculum assets live in PostgreSQL with their records;
no object storage credentials or public bucket are needed.

Creation, replacement and removal require `curriculum.manage`, are scoped to
the current club, and share the record's transaction and audit. Programme
copies include programme and level artwork. Ordinary edits preserve images.

Images appear beside programme/level names in the curriculum, class list and
details, and swimmer progress. A level without artwork uses its programme's
image. Neither image means the existing text-only presentation. Names remain
visible. The shared metadata read is memoised per server render; binary data
is not included in page or client component props.

The image route requires a signed-in user and current-club ownership on every
request. It serves only WebP, with private revalidation and a content-hash ETag.
Versioned URLs change after replacement, and image mutations invalidate the
application layout so other screens refresh their artwork.

Deployment needs the additive `20260907010000_curriculum_images` migration.
The production build applies committed migrations before compiling. Local
and preview builds do not apply migrations to the shared database.

Verification uses synthetic files and mocked database boundaries; never upload
test artwork to real programme records merely to test this feature.

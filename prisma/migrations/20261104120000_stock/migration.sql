-- Stock (docs/stock.md): stock taking, ported from Stockly. Additive: four new stock_* tables
-- with no relations to Core tables, and the usual categories for each organisation.

-- CreateTable
CREATE TABLE "stock_categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'gray',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT 'each',
    "sku" TEXT,
    "caseSize" INTEGER,
    "barcode" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_takes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "stockDate" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedById" TEXT,
    "startedByName" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_takes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_take_lines" (
    "id" TEXT NOT NULL,
    "stockTakeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedById" TEXT,
    "countedByName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "stock_take_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_categories_orgId_name_key" ON "stock_categories"("orgId", "name");

-- CreateIndex
CREATE INDEX "stock_products_categoryId_idx" ON "stock_products"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_products_orgId_name_key" ON "stock_products"("orgId", "name");

-- CreateIndex
CREATE INDEX "stock_takes_siteId_submittedAt_idx" ON "stock_takes"("siteId", "submittedAt");

-- CreateIndex
CREATE INDEX "stock_take_lines_productId_idx" ON "stock_take_lines"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_take_lines_stockTakeId_productId_key" ON "stock_take_lines"("stockTakeId", "productId");

-- AddForeignKey
ALTER TABLE "stock_products" ADD CONSTRAINT "stock_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "stock_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_stockTakeId_fkey" FOREIGN KEY ("stockTakeId") REFERENCES "stock_takes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "stock_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The usual categories, as Stockly started with, for every organisation. Manage renames,
-- adds and archives them under Stock > Categories.
INSERT INTO "stock_categories" ("id", "orgId", "name", "tone", "sortOrder", "createdAt", "updatedAt")
SELECT 'stkcat_' || o."id" || '_' || c.slug, o."id", c.name, c.tone, c.sort, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organisation" o
CROSS JOIN (VALUES
  ('drink', 'Drink', 'blue', 0),
  ('snack', 'Snack', 'orange', 1),
  ('confectionery', 'Confectionery', 'purple', 2),
  ('retail', 'Retail', 'green', 3),
  ('cleaning', 'Cleaning', 'blue', 4),
  ('equipment', 'Equipment', 'gray', 5),
  ('other', 'Other', 'gray', 6)
) AS c(slug, name, tone, sort);

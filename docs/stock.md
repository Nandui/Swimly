# Stock

Owner decision, 13 October 2026: Fernando asked for his stock taking app, Stockly
(github.com/Nandui/stockly), to be brought into Turnfin as a module "just like all other modules".
ADR 0010 records the decision. Stockly's own sign-in, users, roles, centres and audit log are
replaced by Turnfin's: people sign in to Turnfin, sites are Turnfin's sites, and access comes from
the role's Stock level.

## The model (`prisma/schema/stock.prisma`)

| Concept | Table | What it is |
| --- | --- | --- |
| Category | `StockCategory` (`stock_categories`) | How products are grouped on the count sheet, in order, with a tag tone (blue, green, orange, purple or grey; red is kept for what needs attention). The migration adds Stockly's seven for every organisation: Drink, Snack, Confectionery, Retail, Cleaning, Equipment and Other. Archived, never deleted; only a category with no products in use can be archived. |
| Product | `StockProduct` (`stock_products`) | One list for every site: name, category, the unit one counted thing is ("can", "pair", "25ml serving"), and optionally SKU, units in a case, barcode and notes. Archived, never deleted, so every old count stays readable. |
| Count | `StockTake` (`stock_takes`) | A count at a site for a stock day, who started it and when, and who submitted it. Open until submitted; a site has one open count at a time. |
| Line | `StockTakeLine` (`stock_take_lines`) | A counted product on a count, the quantity, and who counted it when. |

The tables keep plain ids for the site and the organisation and read Core only through its
functions (`src/lib/directory.ts`), so the module has no relation to any Core table. The
migration `20261104120000_stock` only adds tables and the categories.

## Counted none is not uncounted

Stockly's most important rule, kept whole. No line for a product means nobody counted it; a line
with quantity 0 means counted, none on the shelf. Mixing them turns a skipped shelf into a phantom
loss. So lines are never pre-created, the count sheet gives zero its own **None** button and an
empty box means not counted, and a comparison lists products not counted on either count apart and
leaves them out of the totals.

## Counting

Count starts a count from **Counts**: the site they are standing in and the stock day. The count
sheet lists every live product by category, with a search and a filter (All, Not counted,
Counted). Numbers save as the person types (a moment after they stop, or when they leave the box),
so a phone in a cellar with a weak signal never waits on the page; the search and filter stay on
the page rather than in the address for the same reason. Products archived after they were counted
stay on the sheet.

**Submit** closes the count; after that it can't be changed. A count with nothing counted on it
can be **discarded**. Manage can **delete** any count at their sites. Every number, clear, submit,
discard and delete writes a row to the activity log.

## Comparing

**Compare** puts two submitted counts at the same site side by side, the earlier on the left.
Going down is the normal case (selling), so it stays quiet. **More than before** is red, because it
means a delivery nobody recorded or a miscount. Products not counted on one of the two are listed
apart. The sentence above the list gives the products that changed, the units that left the
shelf, how many went up and how many were left out. Prices and per-site stocking are not in
Stockly yet, so there are no money figures.

## Access

| Level | Permission | What it gives |
| --- | --- | --- |
| View | `stock.read` | The counts at their sites, the product list and comparisons. |
| Count | `stock.count` | Also start, count, submit and discard counts at their sites. |
| Manage | `stock.manage` | Also the product list and categories, and deleting a count. |

Levels apply at the sites the person works at. The product list and categories are the
organisation's, kept by anyone with Manage. Stockly's roles map across as Viewer to View, Stock
manager to Count and Admin to Manage. The module is in the Back office group, beside Purchasing.

## Home

Count holders see **Stock counts to finish** on Home and the Stock starter page while a count is
open at their sites.

## Not carried over from Stockly

- Its sign-in, user accounts, centres and audit page: Turnfin's own replace them.
- Its data. Stockly keeps its own database, which this port does not copy. The one exception is the
  Bishopstown stock sheet's product names (owner decision, 13 October 2026): Manage can add them once
  from Products with **Add the Bishopstown stock sheet**. They go under Other, counted "each"; names
  already on the list are skipped, and the button goes once any of them is on the list
  (`features/products/server/sheet.ts`).
- Its "light only" choice: Turnfin works in both modes.

## Later

Stockly's own notes name what comes next: which sites stock which product and at what price (then
money figures in a comparison), deliveries in cases, and scanning barcodes to count.

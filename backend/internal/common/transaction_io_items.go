package common

// Items sheet of the Transaction export (specs/transaction-line-items BR-15,
// AC-28). Import reads only the first sheet, so this second sheet never
// changes what an exported file imports.
const TransactionExportItemsSheetName = "Items"

// TransactionExportItemColumns: the first three plus Created At identify the
// parent row on the Transactions sheet; Amount is signed (a discount is
// negative) so the column sums to the Transaction amount.
var TransactionExportItemColumns = []string{
	"Date", "Transaction Amount", "Note", "Created At", "Line", "Name", "Quantity", "Unit Price", "Amount",
}

// TransactionExportLineLabels maps a line kind to the `Line` column value.
var TransactionExportLineLabels = map[string]string{
	"item":     "Item",
	"tax":      "Tax",
	"fee":      "Fee",
	"discount": "Discount",
	"other":    "Other",
}

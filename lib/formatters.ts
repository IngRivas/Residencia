// Shared flyweight formatter instances to avoid repeated instantiation
const CurrencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
})

export function formatCurrency(value: number): string {
  return CurrencyFormatter.format(value) + " mxn"
}

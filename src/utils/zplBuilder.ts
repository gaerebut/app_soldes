export function buildSoldeLabel(
  productName: string,
  barcode: string,
  discountPercent: number,
  quantity: number = 1
): string {
  const name = productName.toUpperCase().substring(0, 80);
  const pct = `-${discountPercent}%`;
  const ean = barcode.trim();

  return (
    `^XA\n` +
    `^CI28\n` +
    `^PW480\n` +
    `^LL320\n` +
    `^FO15,15^A0N,24,24^FDA CONSOMMER^FS\n` +
    `^FO15,45^A0N,24,24^FDRAPIDEMENT^FS\n` +
    `^FO300,8^GB170,68,68,B,0^FS\n` +
    `^FO300,18^A0N,46,46^FR^FB170,1,0,C^FD${pct}^FS\n` +
    `^FO15,90^GB460,3,3^FS\n` +
    `^FO15,105^A0N,22,22^FB460,3,5,L^FD${name}^FS\n` +
    (ean ? `^FO80,230^BY2,2.5^BCN,40,N,N,N^FD${ean}^FS\n^FO15,283^A0N,14,14^FB460,1,0,C^FD${ean}^FS\n` : '') +
    `^PQ${quantity}\n` +
    `^XZ`
  );
}

export function buildSoldeLabel(
  productName: string,
  barcode: string,
  discountPercent: number,
  quantity: number = 1,
  storeName: string = ''
): string {
  const name = productName.toUpperCase().substring(0, 80);
  const pct = `-${discountPercent}%`;
  const ean = barcode.trim();
  const store = storeName.trim().toUpperCase().substring(0, 25);
  const hasStore = store.length > 0;

  // Font size and Y positions adapt when store name is shown
  const titleSize = hasStore ? 28 : 34;
  const aY = hasStore ? 26 : 10;
  const rapY = aY + titleSize + 4;
  const lineY = rapY + titleSize + 4;
  const nameY = lineY + 8;

  const lines: string[] = [
    `^XA`,
    `^CI28`,
    `^PW480`,
    `^LL320`,
    // Store name — small text top-left
    ...(hasStore ? [`^FO10,7^A0N,16,16^FD${store}^FS`] : []),
    // "A CONSOMMER" / "RAPIDEMENT" — large bold left
    `^FO10,${aY}^A0N,${titleSize},${titleSize}^FDA CONSOMMER^FS`,
    `^FO10,${rapY}^A0N,${titleSize},${titleSize}^FDRAPIDEMENT^FS`,
    // Underline
    `^FO10,${lineY}^GB295,4,4^FS`,
    // Discount badge — filled dark box right
    `^FO313,4^GB162,92,92,B,4^FS`,
    // Discount text — white on black, centered, very large
    `^FO313,14^A0N,70,64^FR^FB162,1,0,C^FD${pct}^FS`,
    // Product name — multiline, up to 3 lines
    `^FO10,${nameY}^A0N,24,24^FB460,3,5,L^FD${name}^FS`,
    // Barcode — EAN/Code128, full width
    ...(ean ? [
      `^FO25,213^BY2,2.5^BCN,62,N,N,N^FD${ean}^FS`,
      `^FO10,286^A0N,16,16^FB460,1,0,C^FD${ean}^FS`,
    ] : []),
    `^PQ${quantity}`,
    `^XZ`,
  ];

  return lines.join('\n');
}

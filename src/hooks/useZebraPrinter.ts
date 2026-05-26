import { useState, useEffect } from 'react';
import { zebraPrinterService, PrinterState } from '../services/ZebraPrinterService';

export function useZebraPrinter() {
  const [state, setState] = useState<PrinterState>(zebraPrinterService.getState());

  useEffect(() => {
    zebraPrinterService.init();
    const unsubscribe = zebraPrinterService.subscribe(() => {
      setState(zebraPrinterService.getState());
    });
    return unsubscribe;
  }, []);

  return {
    ...state,
    startScan: () => zebraPrinterService.startScan(),
    stopScan: () => zebraPrinterService.stopScan(),
    connect: (id: string, name: string) => zebraPrinterService.connect(id, name),
    disconnect: () => zebraPrinterService.disconnect(),
    print: (zpl: string) => zebraPrinterService.print(zpl),
    incrementDiscount: () => zebraPrinterService.setDiscount(state.discount + 5),
    decrementDiscount: () => zebraPrinterService.setDiscount(state.discount - 5),
  };
}

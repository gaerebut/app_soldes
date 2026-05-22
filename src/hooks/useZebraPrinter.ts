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
    getPairedDevices: () => zebraPrinterService.getPairedDevices(),
    connect: (address: string, name: string) => zebraPrinterService.connect(address, name),
    disconnect: () => zebraPrinterService.disconnect(),
    print: (zpl: string) => zebraPrinterService.print(zpl),
    incrementDiscount: () => zebraPrinterService.setDiscount(state.discount + 5),
    decrementDiscount: () => zebraPrinterService.setDiscount(state.discount - 5),
  };
}

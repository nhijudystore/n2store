// Printer utilities for JSPrintManager integration

export interface PrinterConfig {
  printerName: string;
  paperSize: '80mm' | '58mm';
  silentPrintEnabled: boolean;
}

// Get printer config from localStorage
export const getPrinterConfig = (): PrinterConfig | null => {
  try {
    const config = localStorage.getItem('printer_config');
    return config ? JSON.parse(config) : null;
  } catch (e) {
    console.error('Error reading printer config:', e);
    return null;
  }
};

// Save printer config to localStorage
export const savePrinterConfig = (config: PrinterConfig): void => {
  try {
    localStorage.setItem('printer_config', JSON.stringify(config));
  } catch (e) {
    console.error('Error saving printer config:', e);
  }
};

// Check if JSPrintManager is installed and running
export const isJSPMInstalled = async (): Promise<boolean> => {
  try {
    if (typeof JSPM === 'undefined') return false;
    JSPM.JSPrintManager.auto_reconnect = false;
    await JSPM.JSPrintManager.start();
    return JSPM.JSPrintManager.websocket_status === JSPM.WSStatus.Open;
  } catch (e) {
    return false;
  }
};

// Get list of installed printers
export const getInstalledPrinters = async (): Promise<string[]> => {
  try {
    const printers = await JSPM.JSPrintManager.getPrinters();
    return printers;
  } catch (e) {
    console.error('Error getting printers:', e);
    return [];
  }
};

// Print directly to specified printer
export const printDirectly = async (
  htmlContent: string,
  printerName: string
): Promise<boolean> => {
  try {
    const cpj = new JSPM.ClientPrintJob();
    cpj.clientPrinter = new JSPM.InstalledPrinter(printerName);
    
    const printFile = new JSPM.PrintFile(
      htmlContent,
      JSPM.FileSourceType.HTML,
      'bill.html',
      1
    );
    
    cpj.files = [printFile];
    await cpj.sendToClient();
    return true;
  } catch (e) {
    console.error('Print error:', e);
    return false;
  }
};

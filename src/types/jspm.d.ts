// TypeScript definitions for JSPrintManager
declare namespace JSPM {
  enum WSStatus {
    Open = 0,
    Closed = 1,
    Blocked = 2,
  }

  enum FileSourceType {
    Base64 = 0,
    Text = 1,
    URL = 2,
    BLOB = 3,
    HTML = 4,
  }

  class JSPrintManager {
    static auto_reconnect: boolean;
    static websocket_status: WSStatus;
    static start(): Promise<void>;
    static stop(): Promise<void>;
    static getPrinters(): Promise<string[]>;
  }

  class PrintFile {
    constructor(
      content: string,
      fileSourceType: FileSourceType,
      fileName: string,
      copies: number
    );
  }

  class InstalledPrinter {
    constructor(printerName: string);
  }

  class ClientPrintJob {
    clientPrinter: InstalledPrinter;
    files: PrintFile[];
    sendToClient(): Promise<void>;
  }
}

declare const JSPM: typeof JSPM;

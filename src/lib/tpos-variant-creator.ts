// TPOS Variant Creator - Auto create variants on TPOS after product upload
import { getActiveTPOSToken, getTPOSHeaders, generateRandomId } from "./tpos-config";
import { TPOS_ATTRIBUTE_IDS, TPOS_SIZE_TEXT_MAP, TPOS_SIZE_NUMBER_MAP, TPOS_COLOR_MAP, getVariantType } from "./variant-attributes";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface TPOSAttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId: number;
  AttributeName: string;
  PriceExtra: null;
  NameGet: string;
  DateCreated: null;
}

interface TPOSAttributeLine {
  Attribute: {
    Id: number;
    Name: string;
    Code: string;
    Sequence: number;
    CreateVariant: boolean;
  };
  Values: TPOSAttributeValue[];
  AttributeId: number;
}

interface SelectedAttribute {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId: number;
  AttributeName: string;
}

interface SelectedAttributes {
  sizeText?: SelectedAttribute[];
  sizeNumber?: SelectedAttribute[];
  color?: SelectedAttribute[];
}

// =====================================================
// STEP 1: GET PRODUCT FROM TPOS
// =====================================================

export async function getTPOSProduct(tposProductId: number): Promise<any> {
  const bearerToken = await getActiveTPOSToken();
  if (!bearerToken) {
    throw new Error("No active TPOS token found");
  }

  const url = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;

  const response = await fetch(url, {
    method: "GET",
    headers: getTPOSHeaders(bearerToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to get TPOS product: ${response.statusText}`);
  }

  return await response.json();
}

// =====================================================
// STEP 2: PARSE VARIANT TO SELECTED ATTRIBUTES
// =====================================================

export function parseVariantToAttributes(variant: string): SelectedAttributes {
  const result: SelectedAttributes = {};
  
  // Parse variant string (e.g., "M Đen" → size M + color Đen)
  const parts = variant.trim().split(/\s+/);
  
  for (const part of parts) {
    const type = getVariantType(part);
    
    if (type === 'text-size' && TPOS_SIZE_TEXT_MAP[part]) {
      if (!result.sizeText) result.sizeText = [];
      const sizeData = TPOS_SIZE_TEXT_MAP[part];
      result.sizeText.push({
        Id: sizeData.Id,
        Name: part,
        Code: sizeData.Code,
        Sequence: sizeData.Sequence,
        AttributeId: TPOS_ATTRIBUTE_IDS.SIZE_TEXT,
        AttributeName: "Size Chữ"
      });
    } else if (type === 'number-size' && TPOS_SIZE_NUMBER_MAP[part]) {
      if (!result.sizeNumber) result.sizeNumber = [];
      const sizeData = TPOS_SIZE_NUMBER_MAP[part];
      result.sizeNumber.push({
        Id: sizeData.Id,
        Name: part,
        Code: sizeData.Code,
        Sequence: null,
        AttributeId: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER,
        AttributeName: "Size Số"
      });
    } else if (type === 'color' && TPOS_COLOR_MAP[part]) {
      if (!result.color) result.color = [];
      const colorData = TPOS_COLOR_MAP[part];
      result.color.push({
        Id: colorData.Id,
        Name: part,
        Code: colorData.Code,
        Sequence: null,
        AttributeId: TPOS_ATTRIBUTE_IDS.COLOR,
        AttributeName: "Màu"
      });
    }
  }
  
  return result;
}

// =====================================================
// STEP 3: CREATE ATTRIBUTE LINES
// =====================================================

export function createAttributeLines(selectedAttributes: SelectedAttributes): TPOSAttributeLine[] {
  const attributeLines: TPOSAttributeLine[] = [];
  
  // Size Chữ (AttributeId = 1)
  if (selectedAttributes.sizeText && selectedAttributes.sizeText.length > 0) {
    attributeLines.push({
      Attribute: {
        Id: 1,
        Name: "Size Chữ",
        Code: "SZCh",
        Sequence: 1,
        CreateVariant: true
      },
      Values: selectedAttributes.sizeText.map(attr => ({
        Id: attr.Id,
        Name: attr.Name,
        Code: attr.Code,
        Sequence: attr.Sequence,
        AttributeId: 1,
        AttributeName: "Size Chữ",
        PriceExtra: null,
        NameGet: `Size Chữ: ${attr.Name}`,
        DateCreated: null
      })),
      AttributeId: 1
    });
  }
  
  // Size Số (AttributeId = 4)
  if (selectedAttributes.sizeNumber && selectedAttributes.sizeNumber.length > 0) {
    attributeLines.push({
      Attribute: {
        Id: 4,
        Name: "Size Số",
        Code: "SZS",
        Sequence: 2,
        CreateVariant: true
      },
      Values: selectedAttributes.sizeNumber.map(attr => ({
        Id: attr.Id,
        Name: attr.Name,
        Code: attr.Code,
        Sequence: null,
        AttributeId: 4,
        AttributeName: "Size Số",
        PriceExtra: null,
        NameGet: `Size Số: ${attr.Name}`,
        DateCreated: null
      })),
      AttributeId: 4
    });
  }
  
  // Màu (AttributeId = 3)
  if (selectedAttributes.color && selectedAttributes.color.length > 0) {
    attributeLines.push({
      Attribute: {
        Id: 3,
        Name: "Màu",
        Code: "mau",
        Sequence: 3,
        CreateVariant: true
      },
      Values: selectedAttributes.color.map(attr => ({
        Id: attr.Id,
        Name: attr.Name,
        Code: attr.Code,
        Sequence: null,
        AttributeId: 3,
        AttributeName: "Màu",
        PriceExtra: null,
        NameGet: `Màu: ${attr.Name}`,
        DateCreated: null
      })),
      AttributeId: 3
    });
  }
  
  return attributeLines;
}

// =====================================================
// STEP 4: CARTESIAN PRODUCT FOR VARIANTS
// =====================================================

function cartesianProduct(...arrays: any[][]): any[][] {
  return arrays.reduce((acc, array) => {
    return acc.flatMap((x: any) => array.map((y: any) => [x, y].flat()));
  }, [[]] as any[][]);
}

export function generateVariants(originalProduct: any, attributeLines: TPOSAttributeLine[]): any[] {
  // Get all values from attributeLines
  const allValues = attributeLines.map(line => line.Values);
  
  // Create all combinations
  const combinations = cartesianProduct(...allValues);
  
  // Create variant for each combination
  const newVariants = combinations.map(combo => {
    const attrArray = Array.isArray(combo) ? combo : [combo];
    const names = attrArray.map(a => a.Name).join(', ');
    
    return {
      Id: 0, // 0 = new variant
      EAN13: null,
      DefaultCode: null,
      NameTemplate: originalProduct.Name,
      NameNoSign: null,
      ProductTmplId: originalProduct.Id,
      UOMId: 0,
      UOMName: null,
      UOMPOId: 0,
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: null,
      IncomingQty: null,
      NameGet: `${originalProduct.Name} (${names})`,
      POSCategId: null,
      Price: null,
      Barcode: null,
      Image: null,
      ImageUrl: null,
      Thumbnails: [],
      PriceVariant: originalProduct.ListPrice,
      SaleOK: true,
      PurchaseOK: true,
      DisplayAttributeValues: null,
      LstPrice: 0,
      Active: true,
      ListPrice: 0,
      PurchasePrice: null,
      DiscountSale: null,
      DiscountPurchase: null,
      StandardPrice: 0,
      Weight: 0,
      Volume: null,
      OldPrice: null,
      IsDiscount: false,
      ProductTmplEnableAll: false,
      Version: 0,
      Description: null,
      LastUpdated: null,
      Type: "product",
      CategId: 0,
      CostMethod: null,
      InvoicePolicy: "order",
      Variant_TeamId: 0,
      Name: `${originalProduct.Name} (${names})`,
      PropertyCostMethod: null,
      PropertyValuation: null,
      PurchaseMethod: "receive",
      SaleDelay: 0,
      Tracking: null,
      Valuation: null,
      AvailableInPOS: true,
      CompanyId: null,
      IsCombo: null,
      NameTemplateNoSign: originalProduct.NameNoSign,
      TaxesIds: [],
      StockValue: null,
      SaleValue: null,
      PosSalesCount: null,
      Factor: null,
      CategName: null,
      AmountTotal: null,
      NameCombos: [],
      RewardName: null,
      Product_UOMId: null,
      Tags: null,
      DateCreated: null,
      InitInventory: 0,
      OrderTag: null,
      StringExtraProperties: null,
      CreatedById: null,
      Error: null,
      AttributeValues: attrArray.map(a => ({
        Id: a.Id,
        Name: a.Name,
        Code: null,
        Sequence: null,
        AttributeId: a.AttributeId,
        AttributeName: a.AttributeName,
        PriceExtra: null,
        NameGet: `${a.AttributeName}: ${a.Name}`,
        DateCreated: null
      }))
    };
  });
  
  // Mark old variants as inactive
  const oldVariants = originalProduct.ProductVariants
    .filter((v: any) => v.Id > 0)
    .map((oldVariant: any) => {
      const inactiveVariant = JSON.parse(JSON.stringify(oldVariant));
      // Remove nested objects
      delete inactiveVariant.UOM;
      delete inactiveVariant.Categ;
      delete inactiveVariant.UOMPO;
      delete inactiveVariant.POSCateg;
      // Mark inactive
      inactiveVariant.Active = false;
      return inactiveVariant;
    });
  
  return [...newVariants, ...oldVariants];
}

// =====================================================
// STEP 5: CREATE PAYLOAD
// =====================================================

export function createPayload(originalProduct: any, attributeLines: TPOSAttributeLine[], variants: any[]): any {
  // Clone originalProduct
  const payload = JSON.parse(JSON.stringify(originalProduct));
  
  // 1. Remove @odata.context
  delete payload['@odata.context'];
  
  // 2. Set Version = 0
  payload.Version = 0;
  
  // 3. Add AttributeLines
  payload.AttributeLines = attributeLines;
  
  // 4. Replace ProductVariants
  payload.ProductVariants = variants;
  
  // 5. Add required arrays
  payload.Items = [];
  
  payload.UOMLines = [{
    Id: payload.Id,
    ProductTmplId: payload.Id,
    ProductTmplListPrice: null,
    UOMId: payload.UOM?.Id || 1,
    TemplateUOMFactor: 0,
    ListPrice: payload.ListPrice,
    Barcode: "",
    Price: null,
    ProductId: 0,
    UOMName: null,
    NameGet: null,
    Factor: 0,
    UOM: payload.UOM
  }];
  
  payload.ComboProducts = [];
  payload.ProductSupplierInfos = [];
  
  return payload;
}

// =====================================================
// STEP 6: POST PAYLOAD
// =====================================================

export async function postTPOSVariantPayload(payload: any): Promise<any> {
  const bearerToken = await getActiveTPOSToken();
  if (!bearerToken) {
    throw new Error("No active TPOS token found");
  }

  const url = 'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: getTPOSHeaders(bearerToken),
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post TPOS variant: ${response.statusText} - ${errorText}`);
  }
  
  return await response.json();
}

// =====================================================
// MAIN FLOW
// =====================================================

export async function createTPOSVariants(
  tposProductId: number, 
  variant: string,
  onProgress?: (message: string) => void
): Promise<any> {
  try {
    onProgress?.(`Đang lấy thông tin sản phẩm ${tposProductId}...`);
    const originalProduct = await getTPOSProduct(tposProductId);
    
    onProgress?.(`Đang phân tích variant "${variant}"...`);
    const selectedAttributes = parseVariantToAttributes(variant);
    
    if (!selectedAttributes.sizeText && !selectedAttributes.sizeNumber && !selectedAttributes.color) {
      throw new Error(`Không thể phân tích variant: ${variant}`);
    }
    
    onProgress?.(`Đang tạo attribute lines...`);
    const attributeLines = createAttributeLines(selectedAttributes);
    
    onProgress?.(`Đang tạo variants...`);
    const variants = generateVariants(originalProduct, attributeLines);
    
    onProgress?.(`Đang tạo payload...`);
    const payload = createPayload(originalProduct, attributeLines, variants);
    
    onProgress?.(`Đang upload lên TPOS...`);
    const result = await postTPOSVariantPayload(payload);
    
    onProgress?.(`✅ Tạo variant thành công`);
    return result;
    
  } catch (error) {
    console.error('Error creating TPOS variants:', error);
    throw error;
  }
}

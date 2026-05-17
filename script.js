function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('BUSINESS PERFORMANCE DASHBOARD')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// LOGIN SYSTEM
function checkLogin(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PW");
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toString().trim() === username.toString().trim() && data[i][1].toString() === password.toString()) {
      return { success: true, user: username };
    }
  }
  return { success: false };
}

function updatePassword(username, newPassword) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("PW");
    const data = sheet.getRange("A1:A" + sheet.getLastRow()).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0].toString().trim() === username.toString().trim()) {
        sheet.getRange(i + 1, 2).setValue(newPassword);
        SpreadsheetApp.flush();
        return "Success: Password updated for " + username;
      }
    }
    return "Error: User not found.";
  } catch (e) { return "Error: " + e.toString(); }
}

function getSystemData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName("Inventory Details");
  const salesSheet = ss.getSheetByName("Raw Data Sales");
  const dataSheet = ss.getSheetByName("Data");
  const salesRaw = salesSheet.getRange(2, 1, Math.max(salesSheet.getLastRow() - 1, 1), 12).getDisplayValues();
  const invRaw = invSheet.getRange(2, 1, Math.max(invSheet.getLastRow() - 1, 1), 8).getDisplayValues();
  return {
    invData: invRaw,
    salesData: salesRaw,
    categories: [...new Set(invRaw.slice(1).map(r => r[2]))].filter(String).sort(),
    customerTypes: dataSheet.getRange("E2:E" + dataSheet.getLastRow()).getValues().flat().filter(String),
    channels: dataSheet.getRange("F2:F" + dataSheet.getLastRow()).getValues().flat().filter(String)
  };
}

function checkStatus(id, type) {
  if (!id || id.length < 2) return "WAITING";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName((type === 'PO') ? "ST" : "SO");
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return "PENDING";
  const colIndex = (type === 'PO') ? 13 : 15;
  const data = sheet.getRange(4, colIndex, lastRow - 3, 1).getValues().flat().map(String);
  return data.indexOf(id.toString().trim()) !== -1 ? "POSTED" : "PENDING";
}

function getProductBySKU(sku) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Inventory Details");
  const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toString() === sku.toString()) return { sku: data[i][0], name: data[i][1] };
  }
  return null;
}

function saveStockIn(items, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stSheet = ss.getSheetByName("ST");
  const lastRow = stSheet.getLastRow();
  if (lastRow >= 4) {
    const existingPOs = stSheet.getRange(4, 13, lastRow - 3, 1).getValues().flat().map(String);
    if (existingPOs.includes(header.po.toString().trim())) throw new Error("DUPLICATE PO #: " + header.po);
  }
  const date = new Date();
  const txnId = "TXN-" + Utilities.formatDate(date, "GMT+8", "yyyyMMdd") + "-" + Math.floor(100 + Math.random() * 900);
  items.forEach(item => { stSheet.appendRow([txnId, item.sku, item.name, item.qty, date, header.po, header.user]); });
  return { msg: "Success! ID: " + txnId, ref: header.po, type: 'PO' };
}

function saveStockOut(items, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const soSheet = ss.getSheetByName("SO");
  const invSheet = ss.getSheetByName("Inventory Details");
  const invData = invSheet.getRange(3, 1, invSheet.getLastRow() - 2, 8).getValues();
  for (let item of items) {
    let stockInfo = invData.find(r => r[0].toString() === item.sku.toString());
    if (stockInfo && parseInt(stockInfo[7]) < item.qty) throw new Error("Insufficient stock for: " + item.name);
  }
  const lastRow = soSheet.getLastRow();
  if (lastRow >= 4) {
    const existingORs = soSheet.getRange(4, 15, lastRow - 3, 1).getValues().flat().map(String);
    if (existingORs.includes(header.orderId.toString().trim())) throw new Error("DUPLICATE OR #: " + header.orderId);
  }
  const date = new Date();
  const trnId = "TRN-" + Utilities.formatDate(date, "GMT+8", "yyyyMMdd") + "-" + Math.floor(100 + Math.random() * 900);
  items.forEach(item => { soSheet.appendRow([trnId, item.sku, item.name, item.qty, date, header.orderId, header.user, header.custType, header.channel]); });
  return { msg: "Success! ID: " + trnId, ref: header.orderId, type: 'OR' };
}

function getTransactionList(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(type === 'PO' ? "ST" : "SO");
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];
  const range = type === 'PO' ? "H4:N" + lastRow : "J4:P" + lastRow;
  const data = sheet.getRange(range).getDisplayValues();
  let uniqueMap = new Map();
  data.forEach(row => { if (row[5]) uniqueMap.set(row[5], { ref: row[5], txnId: row[0], user: row[6] }); });
  return Array.from(uniqueMap.values());
}

function getTransactionDetails(ref, type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(type === 'PO' ? "ST" : "SO");
  const data = sheet.getRange(type === 'PO' ? "H3:N" + sheet.getLastRow() : "J3:R" + sheet.getLastRow()).getDisplayValues();
  return { header: data[0], rows: data.slice(1).filter(row => row[5].toString().trim() === ref.toString().trim()) };
}
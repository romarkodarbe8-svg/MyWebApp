// LINK NG IYONG GOOGLE APPS SCRIPT WEB APP BACKEND
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxXhI5iF2Iw-NLmL0ZBaz5Hh7ExXHcwRtfRf52uVvSHirG9R8W4U3pdvKX2n8x0divo/exec";

let currentUser = "";
let scanInList = []; let scanOutList = []; 
let fullSalesData = []; let fullInvData = [];
let charts = {};

function showLoading(v) { document.getElementById('loading').style.visibility = v ? 'visible' : 'hidden'; }

function showSection(sectionId) {
  document.querySelectorAll('.working-area').forEach(el => el.classList.remove('active-area'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active-area');
}

// 1. BRIDGE CONTROLLER PARA SA LOGIN
function handleLogin() {
  const u = document.getElementById('user_input').value;
  const p = document.getElementById('pass_input').value;
  if (!u || !p) return;
  showLoading(true);
  document.getElementById("login-error").innerText = "";

  if (typeof google === 'undefined' || !google.script) {
    fetch(`${WEB_APP_URL}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`)
      .then(res => res.json())
      .then(data => {
        showLoading(false);
        if (data.success) {
          executeLoginSuccess(data.user);
        } else {
          document.getElementById("login-error").innerText = "Maling Username o Password!";
        }
      })
      .catch(() => { showLoading(false); document.getElementById("login-error").innerText = "Network Error."; });
  } else {
    google.script.run
      .withSuccessHandler(function(data) {
        showLoading(false);
        if (data.success) executeLoginSuccess(data.user);
        else document.getElementById("login-error").innerText = "Maling Username o Password!";
      })
      .withFailureHandler(function() { showLoading(false); })
      .checkLogin(u, p);
  }
}

function executeLoginSuccess(user) {
  currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  document.getElementById('userDisplay').innerText = "Hi, " + currentUser;
  document.getElementById('si_display_user').innerText = currentUser;
  document.getElementById('so_display_user').innerText = currentUser;
  refreshData();
}

function handleLogout() {
  currentUser = "";
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('user_input').value = '';
  document.getElementById('pass_input').value = '';
}

function openPassModal() { document.getElementById('new_pass').value = ''; new bootstrap.Modal(document.getElementById('passModal')).show(); }
function saveNewPass() {
  const np = document.getElementById('new_pass').value; if(!np) return alert("Enter password.");
  google.script.run.withSuccessHandler(res => { alert(res); bootstrap.Modal.getInstance(document.getElementById('passModal')).hide(); }).updatePassword(currentUser, np);
}

function showSection(id) {
  document.querySelectorAll('.working-area').forEach(a => a.classList.remove('active-area'));
  document.getElementById(id).classList.add('active-area');
  if(id === 'transactions') loadTransList();
}

// 2. BRIDGE CONTROLLER PARA SA INITIAL SYSTEM DATA
function refreshData() {
  showLoading(true);
  if (typeof google === 'undefined' || !google.script) {
    fetch(`${WEB_APP_URL}?action=getSystemData`)
      .then(res => res.json())
      .then(data => { showLoading(false); handleSystemDataSetup(data); })
      .catch(() => showLoading(false));
  } else {
    google.script.run
      .withSuccessHandler(function(data) { showLoading(false); handleSystemDataSetup(data); })
      .withFailureHandler(function() { showLoading(false); })
      .getSystemData();
  }
}

function handleSystemDataSetup(data) {
  fullInvData = data.invData;
  fullSalesData = data.salesData;
  
  renderTable(data.invData, 'inv-container', 'invTable');
  renderTable(data.salesData, 'sales-container', 'salesTable');
  fillSelect('so_cust', data.customerTypes); 
  fillSelect('so_chan', data.channels);
  fillSelect('dash_cat', data.categories, true);
  filterDashboard();
}

function filterDashboard() {
  if (!fullSalesData || fullSalesData.length < 2) return;
  const start = document.getElementById('dash_start').value, end = document.getElementById('dash_end').value, cat = document.getElementById('dash_cat').value;
  const rows = fullSalesData.slice(1);
  const sT = start ? new Date(start).getTime() : null, eT = end ? new Date(end).getTime() : null;
  let rev = 0, prof = 0, sold = 0, count = 0;
  let dMap = {}, wMap = {}, mMap = {}, yMap = {};
  rows.forEach(r => {
    const rDate = new Date(r[0]); if(isNaN(rDate.getTime())) return;
    const rT = rDate.getTime();
    if((!sT || rT >= sT) && (!eT || rT <= eT) && (cat === 'ALL' || r[4] === cat)) {
      count++;
      let rRev = parseFloat(String(r[8] || "0").replace(/[^\d.-]/g, '')) || 0;
      let rProf = parseFloat(String(r[9] || "0").replace(/[^\d.-]/g, '')) || 0;
      rev += rRev; prof += rProf; sold += (parseInt(r[5]) || 0);
      const dK = r[0], wK = "Wk" + getWeek(rDate), mK = rDate.toLocaleString('default', { month: 'short' }), yK = rDate.getFullYear().toString();
      dMap[dK] = (dMap[dK] || 0) + rRev; wMap[wK] = (wMap[wK] || 0) + rRev; mMap[mK] = (mMap[mK] || 0) + rRev; yMap[yK] = (yMap[yK] || 0) + rRev;
    }
  });
  document.getElementById('rev').innerText = "$" + Math.round(rev).toLocaleString();
  document.getElementById('cost').innerText = "$" + Math.round(rev - prof).toLocaleString();
  document.getElementById('prof').innerText = "$" + Math.round(prof).toLocaleString();
  document.getElementById('orders').innerText = count;
  document.getElementById('sold').innerText = sold;
  initChart('dailyChart', 'bar', dMap, 'Daily Revenue', '#00ff88');
  initChart('weeklyChart', 'line', wMap, 'Weekly Trend', '#00e5ff');
  initChart('monthlyChart', 'line', mMap, 'Monthly Growth', '#ffaa00', true);
  initChart('yearlyChart', 'doughnut', yMap, 'Yearly Share', ['#00ff88','#00e5ff','#ffaa00','#ff4d4d']);
}

function initChart(id, type, map, label, color, fill = false) {
  const ctx = document.getElementById(id).getContext('2d');
  if(charts[id]) charts[id].destroy();
  const keys = Object.keys(map).sort();
  charts[id] = new Chart(ctx, {
    type: type,
    data: { labels: keys, datasets: [{ label: label, data: keys.map(k => map[k]), backgroundColor: color, borderColor: color, borderWidth: 2, fill: fill, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

function renderTable(data, containerId, tableId) {
  if (!data || data.length === 0) return;
  let html = `<table class="table-custom" id="${tableId}"><thead><tr>${data[0].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  data.slice(1).forEach(r => {
    if (!r[0] || r[0].toString().trim() === "") return;
    html += `<tr>${r.map((c, i) => {
      let content = c; if(tableId === 'invTable' && i === 7) { let v = parseInt(c) || 0; content = (v === 0) ? `<span class="badge bg-danger">0 OUT</span>` : (v <= 5) ? `<span class="badge bg-warning text-dark">${v} LOW</span>` : v; }
      return `<td>${content}</td>`;
    }).join('')}</tr>`;
  });
  document.getElementById(containerId).innerHTML = html + `</tbody></table>`;
}

// 3. BRIDGE CONTROLLER PARA SA TRANSACTION ACTIONS (STOCK IN / STOCK OUT)
function postAction(mode) {
  const items = (mode === 'IN' ? scanInList : scanOutList); if (items.length === 0) return alert("Scan first!");
  if(mode === 'OUT') { for(let item of items) { let invRow = fullInvData.find(r => r[0].toString() === item.sku.toString()); if(invRow && parseInt(invRow[7]) < item.qty) { alert("Insufficient stock: " + item.name); return; } } }
  showLoading(true);
  const h = mode === 'IN' ? { po: document.getElementById('si_po').value, user: currentUser } : { orderId: document.getElementById('so_order').value, user: currentUser, custType: document.getElementById('so_cust').value, channel: document.getElementById('so_chan').value };
  
  if (typeof google === 'undefined' || !google.script) {
    const endpoint = mode === 'IN' ? 'saveStockIn' : 'saveStockOut';
    fetch(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: endpoint, items: items, header: h })
    })
    .then(res => res.json())
    .then(res => { handlePostSuccess(mode, res); })
    .catch(() => showLoading(false));
  } else {
    google.script.run.withSuccessHandler(res => { handlePostSuccess(mode, res); }).withFailureHandler(() => showLoading(false))[mode === 'IN' ? 'saveStockIn' : 'saveStockOut'](items, h);
  }
}

function handlePostSuccess(mode, res) {
  if (mode === 'IN') { scanInList = []; document.getElementById('si_po').value = ''; document.getElementById('si_badge').innerText = 'WAITING'; document.getElementById('si_badge').className = 'status-badge bg-waiting mt-1'; } 
  else { scanOutList = []; document.getElementById('so_order').value = ''; document.getElementById('so_badge').innerText = 'WAITING'; document.getElementById('so_badge').className = 'status-badge bg-waiting mt-1'; }
  updateSummary(mode); refreshData(); alert(res.msg); viewDetails(res.ref, res.type);
}

// 4. BRIDGE CONTROLLER PARA SA LIVE STATUS AT LOGS
function liveCheck(val, type, badgeId) {
  const badge = document.getElementById(badgeId);
  if (!val || val.length < 2) { badge.className = "status-badge bg-waiting"; badge.innerText = "WAITING"; return; }
  
  if (typeof google === 'undefined' || !google.script) {
    fetch(`${WEB_APP_URL}?action=checkStatus&id=${encodeURIComponent(val)}&type=${type}`)
      .then(res => res.json())
      .then(data => { badge.innerText = data.status; badge.className = 'status-badge ' + (data.status === 'POSTED' ? 'bg-posted' : 'bg-pending'); })
      .catch(() => {});
  } else {
    google.script.run.withSuccessHandler(res => { badge.innerText = res; badge.className = 'status-badge ' + (res === 'POSTED' ? 'bg-posted' : 'bg-pending'); }).checkStatus(val, type);
  }
}

function loadTransList() {
  const type = document.getElementById('trans_type').value;
  if (typeof google === 'undefined' || !google.script) {
    fetch(`${WEB_APP_URL}?action=getTransactionList&type=${type}`)
      .then(res => res.json())
      .then(data => { buildTransListUI(data, type); })
      .catch(() => {});
  } else {
    google.script.run.withSuccessHandler(data => { buildTransListUI(data, type); }).getTransactionList(type);
  }
}

function buildTransListUI(data, type) {
  document.getElementById('trans_list_body').innerHTML = data.map(i => `<tr><td>${i.ref}</td><td>${i.txnId}</td><td>${i.user}</td><td><button class="btn btn-warning btn-sm fw-bold" onclick="viewDetails('${i.ref}', '${type}')">VIEW</button></td></tr>`).join('');
}

function viewDetails(ref, type) {
  showLoading(true);
  if (typeof google === 'undefined' || !google.script) {
    fetch(`${WEB_APP_URL}?action=getTransactionDetails&ref=${encodeURIComponent(ref)}&type=${type}`)
      .then(res => res.json())
      .then(data => { renderDetailsUI(data, type, ref); })
      .catch(() => showLoading(false));
  } else {
    google.script.run.withSuccessHandler(data => { renderDetailsUI(data, type, ref); }).getTransactionDetails(ref, type);
  }
}

function renderDetailsUI(data, type, ref) {
  document.getElementById('viewTitle').innerText = (type === 'PO' ? 'PURCHASE ORDER' : 'ORDER RECEIPT');
  document.getElementById('viewRef').innerText = type + ": " + ref;
  document.getElementById('viewMeta').innerText = "By: " + (data.rows[0][6] || 'N/A') + " | Date: " + (data.rows[0][4] || '');
  document.getElementById('detailHeader').innerHTML = data.header.map(h => `<th>${h}</th>`).join('');
  document.getElementById('detailBody').innerHTML = data.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  showLoading(false); new bootstrap.Modal(document.getElementById('viewModal')).show();
}

function handleScan(e, mode) {
  if (e.key === 'Enter') {
    let sku = e.target.value;
    if (typeof google === 'undefined' || !google.script) {
      fetch(`${WEB_APP_URL}?action=getProductBySKU&sku=${encodeURIComponent(sku)}`)
        .then(res => res.json())
        .then(prod => { executeScanSuccess(prod, mode, e); })
        .catch(() => {});
    } else {
      google.script.run.withSuccessHandler(prod => { executeScanSuccess(prod, mode, e); }).getProductBySKU(sku);
    }
  }
}

function executeScanSuccess(prod, mode, e) {
  if (prod) {
    let list = (mode === 'IN' ? scanInList : scanOutList);
    let exist = list.find(i => i.sku === prod.sku);
    if (exist) { exist.qty++; } else { list.push({ sku: prod.sku, name: prod.name, qty: 1 }); }
    updateSummary(mode);
    e.target.value = '';
  } else { alert("SKU Not Found!"); }
}

function updateSummary(mode) { let list = (mode === 'IN' ? scanInList : scanOutList); document.getElementById(mode === 'IN' ? 'si_summary' : 'so_summary').innerHTML = list.map((item, idx) => `<tr><td>${item.sku}</td><td>${item.name}</td><td>${item.qty}</td><td><button class="btn btn-outline-danger btn-sm" onclick="removeItem(${idx},'${mode}')">REMOVE</button></td></tr>`).join(''); }
function removeItem(idx, mode) { if (mode === 'IN') scanInList.splice(idx, 1); else scanOutList.splice(idx, 1); updateSummary(mode); }
function fillSelect(id, list, addAll = false) { let el = document.getElementById(id); el.innerHTML = (addAll ? `<option value="ALL">All Categories</option>` : '') + list.map(i => `<option value="${i}">${i}</option>`).join(''); }
function exportExcel() { let table = document.getElementById("detailTable"); let wb = XLSX.utils.table_to_book(table, {sheet: "Transaction"}); XLSX.writeFile(wb, "Transaction_Log.xlsx"); }
function filterTable(tId, iId) { let f = document.getElementById(iId).value.toUpperCase(); document.getElementById(tId).querySelectorAll("tbody tr").forEach(r => r.style.display = r.innerText.toUpperCase().includes(f) ? "" : "none"); }
function getWeek(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(),0,1))) / 86400000) + 1)/7); }

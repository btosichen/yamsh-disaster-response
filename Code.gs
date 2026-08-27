const CONFIG = {
  mainSheet: '應變小組主表',
  annexes: [
    { sheet: '附表一_高中專任', group: '搶救組', fireGroup: '滅火班' },
    { sheet: '附表二_國高中導師', group: '避難引導組', fireGroup: '避難引導班' },
    { sheet: '附表三_國中專任', group: '安全防護組', fireGroup: '安全防護班' }
  ],
  placeholders: ['高中專任（含外師）', '國高中導師', '國中專任'],
  extraRecords: [
    {
      name: '張安莛',
      title: '秘書',
      group: '緊急救護組',
      fireGroup: '救護班',
      role: '組長',
      detail: '設立急救站。\n針對傷患進行檢傷分類。\n緊急基本急救、重傷患就醫護送。\n情緒支持、安撫及心理輔導。\n登記傷患姓名、班級，建立傷患名冊。',
      source: '補充資料'
    }
  ]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚨 防災特攻隊')
    .addItem('🔍 查詢我的應變任務', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('陽明高中防災任務查詢');
  SpreadsheetApp.getUi().showSidebar(html);
}

function clean_(value, fallback) {
  const output = String(value == null ? '' : value).trim();
  return output || (fallback || '-');
}

function annexRole_(value) {
  const assignment = clean_(value, '組員');
  if (assignment.indexOf('組長') !== -1) return '組長';
  if (assignment.indexOf('組員') !== -1) return '組員';
  return assignment;
}

function searchTeacherTask(searchName) {
  const query = clean_(searchName, '').replace(/\s+/g, '');
  if (query.length < 2) return [];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];
  const main = spreadsheet.getSheetByName(CONFIG.mainSheet);

  if (!main) {
    throw new Error('找不到「' + CONFIG.mainSheet + '」工作表。');
  }

  const mainData = main.getDataRange().getDisplayValues();
  for (let i = 2; i < mainData.length; i += 1) {
    const row = mainData[i];
    const name = clean_(row[4], '');
    if (!name || CONFIG.placeholders.indexOf(name) !== -1) continue;
    if (name.replace(/\s+/g, '').indexOf(query) === -1) continue;
    results.push({
      group: clean_(row[1]),
      fireGroup: clean_(row[2]),
      role: clean_(row[3]),
      name: name,
      title: clean_(row[5]),
      detail: clean_(row[6]),
      source: CONFIG.mainSheet
    });
  }

  CONFIG.annexes.forEach(function (config) {
    const sheet = spreadsheet.getSheetByName(config.sheet);
    if (!sheet) return;
    const data = sheet.getDataRange().getDisplayValues();
    for (let i = 3; i < data.length; i += 1) {
      const row = data[i];
      const name = clean_(row[1], '');
      if (!name || name.replace(/\s+/g, '').indexOf(query) === -1) continue;
      results.push({
        group: config.group,
        fireGroup: config.fireGroup,
        role: annexRole_(row[3]),
        name: name,
        title: clean_(row[2]),
        detail: clean_(row[4]),
        source: config.sheet
      });
    }
  });

  CONFIG.extraRecords.forEach(function (record) {
    if (record.name.replace(/\s+/g, '').indexOf(query) === -1) return;
    const duplicate = results.some(function (item) {
      return item.name === record.name && item.group === record.group &&
        item.fireGroup === record.fireGroup && item.role === record.role;
    });
    if (!duplicate) results.push(record);
  });

  return results;
}

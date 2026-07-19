const SHEET_ROSTER = 'Roster';
const SHEET_RESPONSES = 'Responses';

function doGet(e) {
  const action = String(e.parameter.action || 'health');
  if (action === 'verify') return json_(verifyStudent_(e.parameter.classId, e.parameter.code));
  if (action === 'responses') return json_(listResponses_(e.parameter.classId, e.parameter.secret));
  return json_({ ok: true, service: '우리반 이음', version: '1.0' });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    if (payload.action === 'submit') return json_(saveResponse_(payload));
    if (payload.action === 'syncRoster') return json_(syncRoster_(payload));
    throw new Error('지원하지 않는 요청입니다.');
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function verifyStudent_(classId, accessCode) {
  const roster = rosterRows_().filter(row => String(row.class_id) === String(classId));
  const student = roster.find(row => String(row.access_code) === String(accessCode));
  if (!student) return { ok: false, message: '개인 코드를 다시 확인해 주세요.' };
  return {
    ok: true,
    student: { number: Number(student.number), name: student.name },
    students: roster.map(row => ({ number: Number(row.number), name: row.name }))
  };
}

function saveResponse_(payload) {
  const verified = verifyStudent_(payload.classId, payload.accessCode);
  if (!verified.ok || Number(verified.student.number) !== Number(payload.studentNumber)) throw new Error('학생 확인에 실패했습니다.');
  const sheet = sheet_(SHEET_RESPONSES, ['response_id','class_id','student_number','student_name','submitted_at','help_now','payload_json']);
  const existing = sheet.getDataRange().getValues().slice(1).findIndex(row => String(row[1]) === String(payload.classId) && Number(row[2]) === Number(payload.studentNumber));
  const values = [Utilities.getUuid(), payload.classId, payload.studentNumber, verified.student.name, new Date(), payload.helpNow, JSON.stringify(payload)];
  if (existing >= 0) sheet.getRange(existing + 2, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
  return { ok: true, submittedAt: new Date().toISOString() };
}

function listResponses_(classId, secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('TEACHER_SECRET');
  if (!expected || String(secret) !== expected) return { ok: false, message: '교사 인증에 실패했습니다.' };
  const sheet = sheet_(SHEET_RESPONSES, ['response_id','class_id','student_number','student_name','submitted_at','help_now','payload_json']);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const items = values.filter(row => String(row[1]) === String(classId)).map(row => Object.fromEntries(headers.map((header,index)=>[header,row[index]])));
  return { ok: true, responses: items };
}

function syncRoster_(payload) {
  const expected = PropertiesService.getScriptProperties().getProperty('TEACHER_SECRET');
  if (!expected || String(payload.secret) !== expected) throw new Error('교사 인증에 실패했습니다.');
  const sheet = sheet_(SHEET_ROSTER, ['class_id','number','name','access_code','active']);
  const values = sheet.getDataRange().getValues();
  for (let row = values.length; row >= 2; row--) if (String(values[row - 1][0]) === String(payload.classId)) sheet.deleteRow(row);
  const rows = (payload.students || []).map(student => [payload.classId, student.number, student.name, student.accessCode, true]);
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { ok: true, count: rows.length };
}

function rosterRows_() {
  const sheet = sheet_(SHEET_ROSTER, ['class_id','number','name','access_code','active']);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.filter(row => row[4] !== false).map(row => Object.fromEntries(headers.map((header,index)=>[header,row[index]])));
}

function sheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) { sheet = spreadsheet.insertSheet(name); sheet.appendRow(headers); sheet.setFrozenRows(1); }
  return sheet;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function setupClass() {
  sheet_(SHEET_ROSTER, ['class_id','number','name','access_code','active']);
  sheet_(SHEET_RESPONSES, ['response_id','class_id','student_number','student_name','submitted_at','help_now','payload_json']);
  if (!PropertiesService.getScriptProperties().getProperty('TEACHER_SECRET')) {
    PropertiesService.getScriptProperties().setProperty('TEACHER_SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  Logger.log('TEACHER_SECRET=' + PropertiesService.getScriptProperties().getProperty('TEACHER_SECRET'));
}

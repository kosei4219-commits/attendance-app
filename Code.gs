/**
 * 出退勤打刻アプリ - Google Apps Script
 * 
 * このスクリプトは以下の機能を提供します：
 * 1. 出勤・退勤打刻データのスプレッドシート記録
 * 2. LINE Messaging APIを使った通知送信
 * 3. 課題完了報告の記録
 */

// ========================================
// 設定（スクリプトプロパティで管理することを推奨）
// ========================================

// スプレッドシートID（あなたのスプレッドシートIDに置き換えてください）
const SPREADSHEET_ID = '17MzRBjnkw0I5RSwWnzUvCNgvKT_Tz8pEVujjpIHW1EA';

// LINE Messaging API
const LINE_CHANNEL_ACCESS_TOKEN = 'kFDcBNy1VgyT36AKluVcv3VBDpmhEMyIJ/7+LUHs7j1zofaBU29R3+voAVMQKJMKxYH2MaNEpimblEME5MwY1hQPTWgptBSbmJ+BiFnBDIvqu/gNf3Ny7AZYxpxHp8L43T7HzFI+oqLnOYzdDCzByAdB04t89/1O/w1cDnyilFU=';
const LINE_GROUP_ID = 'C5a5b36e27a78ed6cfbb74839a8a9d04e';

// シート名
const SHEET_NAMES = {
  MASTER: '研修生マスタ',
  ATTENDANCE: '打刻記録',
  TASK_COMPLETION: '課題完了記録'
};

// ========================================
// メイン処理
// ========================================

/**
 * GETリクエストを処理（動作確認用）
 */
function doGet(e) {
  Logger.log('GETリクエスト受信');
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>出退勤打刻API</title>
      </head>
      <body>
        <h1>✅ 出退勤打刻APIは正常に動作しています</h1>
        <p>このエンドポイントはPOSTリクエストを待機しています。</p>
        <p>時刻: ${new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}</p>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

/**
 * OPTIONSリクエストを処理（CORSプリフライト）
 */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * POSTリクエストを処理
 */
function doPost(e) {
  try {
    // デバッグ: eオブジェクトの内容をログ
    Logger.log('受信したeオブジェクト: ' + JSON.stringify(e));
    
    // eまたはpostDataが存在しない場合のエラーハンドリング
    if (!e) {
      Logger.log('警告: リクエストオブジェクトが存在しません（プリフライトリクエストの可能性）');
      // プリフライトリクエストの場合は単純に成功レスポンスを返す
      return createResponse(true, 'プリフライトリクエスト受信');
    }
    
    if (!e.postData) {
      Logger.log('警告: postDataが存在しません（OPTIONSリクエストまたはGETリクエストの可能性）');
      // OPTIONSリクエストの場合は許可レスポンスを返す
      return createResponse(true, 'OPTIONSリクエスト受信');
    }
    
    if (!e.postData.contents) {
      Logger.log('警告: postData.contentsが存在しません');
      return createResponse(false, 'リクエストボディが空です');
    }
    
    // リクエストボディをパース
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    Logger.log('✅ 正常なPOSTリクエスト受信 - アクション: ' + action);
    Logger.log('受信データ: ' + JSON.stringify(requestData));
    
    let result;
    
    // アクションに応じて処理を分岐
    switch(action) {
      case 'clockIn':
        result = handleClockIn(requestData);
        break;
      case 'clockOut':
        result = handleClockOut(requestData);
        break;
      case 'submitTask':
        result = handleTaskSubmission(requestData);
        break;
      default:
        throw new Error('不明なアクション: ' + action);
    }
    
    // 成功レスポンス
    return createResponse(true, result.message);
    
  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    return createResponse(false, error.toString());
  }
}

/**
 * 出勤打刻処理
 */
function handleClockIn(data) {
  const { userId, userName, timestamp } = data;
  const date = new Date(timestamp);
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm');
  
  // スプレッドシートに記録
  const sheet = getSheet(SHEET_NAMES.ATTENDANCE);
  
  // 既存の記録をチェック（同じ日付のレコードがあるか）
  const lastRow = sheet.getLastRow();
  let rowToUpdate = null;
  
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
    const values = dataRange.getValues();
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === dateStr && values[i][1] === userId) {
        rowToUpdate = i + 2; // ヘッダー行を考慮
        break;
      }
    }
  }
  
  if (rowToUpdate) {
    // 既存レコードを更新
    sheet.getRange(rowToUpdate, 4).setValue(timeStr); // 出勤時刻列
  } else {
    // 新規レコードを追加
    sheet.appendRow([
      dateStr,      // 日付
      userId,       // 研修生ID
      userName,     // 氏名
      timeStr,      // 出勤時刻
      '',           // 退勤時刻（空）
      ''            // 勤務時間（空）
    ]);
  }
  
  // LINE通知
  const message = `【出勤】\n氏名: ${userName}\n時刻: ${dateStr} ${timeStr}`;
  sendLineMessage(message);
  
  return { message: '出勤を記録しました' };
}

/**
 * 退勤打刻処理
 */
function handleClockOut(data) {
  const { userId, userName, timestamp, workHours } = data;
  const date = new Date(timestamp);
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm');
  
  // 勤務時間をフォーマット
  const hours = Math.floor(workHours);
  const minutes = Math.round((workHours - hours) * 60);
  const workTimeStr = `${hours}時間${minutes}分`;
  
  // スプレッドシートを更新
  const sheet = getSheet(SHEET_NAMES.ATTENDANCE);
  const lastRow = sheet.getLastRow();
  
  Logger.log('退勤処理開始 - 日付: ' + dateStr + ', ユーザーID: ' + userId);
  Logger.log('スプレッドシートの最終行: ' + lastRow);
  
  if (lastRow < 2) {
    Logger.log('エラー: スプレッドシートにデータがありません');
    throw new Error('出勤記録が見つかりません');
  }
  
  // 該当する行を検索（逆順で最新の記録を優先）
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
  const values = dataRange.getValues();
  let rowToUpdate = null;
  
  Logger.log('検索開始 - 全' + values.length + '行をチェック');
  
  // 最新の行から逆順で検索
  for (let i = values.length - 1; i >= 0; i--) {
    const rowNum = i + 2;
    const cellDate = values[i][0];
    const cellUserId = values[i][1];
    const cellClockOut = values[i][4]; // 退勤時刻列
    
    Logger.log('行' + rowNum + 'をチェック: 日付タイプ=' + typeof cellDate + ', ユーザーID=' + cellUserId + ', 退勤時刻=' + cellClockOut);
    
    // すでに退勤済みの行はスキップ
    if (cellClockOut && cellClockOut !== '') {
      Logger.log('  → スキップ（既に退勤済み）');
      continue;
    }
    
    // ユーザーIDをチェック
    if (cellUserId !== userId) {
      Logger.log('  → スキップ（ユーザーID不一致: ' + cellUserId + ' !== ' + userId + ')');
      continue;
    }
    
    // 日付を文字列に正規化して比較
    let normalizedCellDate = cellDate;
    
    // objectタイプの場合はDateとして扱う
    if (typeof cellDate === 'object' && cellDate !== null) {
      try {
        normalizedCellDate = Utilities.formatDate(new Date(cellDate), 'Asia/Tokyo', 'yyyy-MM-dd');
        Logger.log('  → Object→Date変換: ' + normalizedCellDate);
      } catch (e) {
        Logger.log('  → Date変換エラー: ' + e.toString());
        normalizedCellDate = String(cellDate).substring(0, 10);
      }
    } else if (typeof cellDate === 'string') {
      // 文字列の場合は最初の10文字（yyyy-MM-dd部分）を取得
      normalizedCellDate = cellDate.substring(0, 10);
      Logger.log('  → String抽出: ' + normalizedCellDate);
    }
    
    Logger.log('  比較: "' + normalizedCellDate + '" === "' + dateStr + '"');
    
    if (normalizedCellDate === dateStr) {
      rowToUpdate = rowNum;
      Logger.log('✅ 一致する行を発見: 行' + rowToUpdate);
      break;
    }
  }
  
  if (!rowToUpdate) {
    Logger.log('❌ 該当する出勤記録が見つかりませんでした');
    Logger.log('検索条件: 日付=' + dateStr + ', ユーザーID=' + userId);
    throw new Error('該当する出勤記録が見つかりません（日付: ' + dateStr + ', ユーザー: ' + userId + '）');
  }
  
  // 退勤時刻と勤務時間を更新
  sheet.getRange(rowToUpdate, 5).setValue(timeStr);        // 退勤時刻
  sheet.getRange(rowToUpdate, 6).setValue(workHours);      // 勤務時間（数値）
  
  // LINE通知
  const message = `【退勤】\n氏名: ${userName}\n時刻: ${dateStr} ${timeStr}\n勤務時間: ${workTimeStr}`;
  sendLineMessage(message);
  
  return { message: '退勤を記録しました' };
}

/**
 * 課題完了報告処理
 */
function handleTaskSubmission(data) {
  const { userId, userName, appUrl, timestamp } = data;
  const date = new Date(timestamp);
  const dateTimeStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  
  // スプレッドシートに記録
  const sheet = getSheet(SHEET_NAMES.TASK_COMPLETION);
  sheet.appendRow([
    dateTimeStr,  // 完了日時
    userId,       // 研修生ID
    userName,     // 氏名
    appUrl,       // アプリURL
    ''            // 判定（空、管理者が後で入力）
  ]);
  
  // LINE通知
  const message = `【🎉課題完了報告🎉】\n研修生：${userName}（${userId}）\n完了：${dateTimeStr}\n\nアプリURL:\n${appUrl}`;
  sendLineMessage(message);
  
  return { message: '課題完了を報告しました' };
}

// ========================================
// ユーティリティ関数
// ========================================

/**
 * スプレッドシートのシートを取得
 */
function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    initializeSheet(sheet, sheetName);
  }
  
  return sheet;
}

/**
 * シートを初期化（ヘッダー行を設定）
 */
function initializeSheet(sheet, sheetName) {
  let headers;
  
  switch(sheetName) {
    case SHEET_NAMES.MASTER:
      headers = ['研修生ID', '氏名', 'ステータス'];
      break;
    case SHEET_NAMES.ATTENDANCE:
      headers = ['日付', '研修生ID', '氏名', '出勤時刻', '退勤時刻', '勤務時間'];
      break;
    case SHEET_NAMES.TASK_COMPLETION:
      headers = ['完了日時', '研修生ID', '氏名', 'アプリURL', '判定'];
      break;
    default:
      headers = [];
  }
  
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/**
 * LINE通知を送信
 */
function sendLineMessage(messageText) {
  const url = 'https://api.line.me/v2/bot/message/push';

  
  const payload = {
    to: LINE_GROUP_ID,
    messages: [
      {
        type: 'text',
        text: messageText
      }
    ]
  };
  
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('LINE通知成功: ' + response.getContentText());
  } catch (error) {
    Logger.log('LINE通知エラー: ' + error.toString());
    // エラーでも処理は継続（スプレッドシート記録は成功）
  }
}

/**
 * レスポンスを作成（MIMEタイプ指定）
 */
function createResponse(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: success,
      message: message
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// テスト用関数（開発時のみ使用）
// ========================================

/**
 * 出勤打刻のテスト
 */
function testClockIn() {
  const testData = {
    action: 'clockIn',
    userId: 'user01',
    userName: 'テストユーザー',
    timestamp: new Date().toISOString()
  };
  
  const result = handleClockIn(testData);
  Logger.log(result);
}

/**
 * 退勤打刻のテスト
 */
function testClockOut() {
  const testData = {
    action: 'clockOut',
    userId: 'user01',
    userName: 'テストユーザー',
    timestamp: new Date().toISOString(),
    workHours: 8.5
  };
  
  const result = handleClockOut(testData);
  Logger.log(result);
}

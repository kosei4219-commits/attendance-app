// Google Apps Script API URL（デプロイ後に設定してください）
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwbAeXNJyV_gyGALS4BDcU8uuh_Q1B634s0mcbgJAC9rFzWggd1a9w3w5FpbMNy3pmRaQ/exec';

// デフォルトユーザー情報
const DEFAULT_USER = {
    userId: 'user01',
    userName: 'あなたの名前'
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadUserInfo();
    loadTodayAttendance();

    // イベントリスナー設定
    document.getElementById('clock-in-btn').addEventListener('click', handleClockIn);
    document.getElementById('clock-out-btn').addEventListener('click', handleClockOut);
    document.getElementById('task-btn').addEventListener('click', openTaskModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeTaskModal);
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);

    // モーダルオーバーレイクリックで閉じる
    document.querySelector('.modal-overlay').addEventListener('click', closeTaskModal);
});

/**
 * アプリ初期化
 */
function initializeApp() {
    console.log('アプリケーション初期化完了');
    updateStatus('準備完了', 'info');
}

/**
 * ユーザー情報を読み込み
 */
function loadUserInfo() {
    // localStorageからユーザー情報を取得（なければデフォルト使用）
    const userInfo = getUserInfo();
    document.getElementById('user-display').textContent = `${userInfo.userId} / ${userInfo.userName}`;
}

/**
 * ユーザー情報を取得
 */
function getUserInfo() {
    const stored = localStorage.getItem('userInfo');
    if (stored) {
        return JSON.parse(stored);
    }
    // 初回アクセス時はデフォルト情報を保存
    localStorage.setItem('userInfo', JSON.stringify(DEFAULT_USER));
    return DEFAULT_USER;
}

/**
 * 今日の打刻情報を読み込み
 */
function loadTodayAttendance() {
    const today = getTodayDateString();
    const attendanceKey = `attendance_${today}`;
    const attendance = localStorage.getItem(attendanceKey);

    if (attendance) {
        const data = JSON.parse(attendance);

        // 出勤時刻を表示
        if (data.clockIn) {
            const clockInTime = formatTime(new Date(data.clockIn));
            document.getElementById('clock-in-time').textContent = clockInTime;
        }

        // 退勤時刻を表示（将来実装）
        if (data.clockOut) {
            const clockOutTime = formatTime(new Date(data.clockOut));
            document.getElementById('clock-out-time').textContent = clockOutTime;
        }

        // 勤務時間を表示（将来実装）
        if (data.workHours !== undefined) {
            document.getElementById('work-hours').textContent = formatWorkHours(data.workHours);
        }
    }
}

/**
 * 出勤打刻処理
 */
function handleClockIn() {
    updateStatus('出勤を記録中...', 'processing');

    const now = new Date();
    const userInfo = getUserInfo();
    const today = getTodayDateString();
    const attendanceKey = `attendance_${today}`;

    // 既存の打刻データを取得（なければ新規作成）
    let attendance = {};
    const stored = localStorage.getItem(attendanceKey);
    if (stored) {
        attendance = JSON.parse(stored);
    }

    // 出勤時刻を記録
    attendance.date = today;
    attendance.clockIn = now.toISOString();
    attendance.userId = userInfo.userId;
    attendance.userName = userInfo.userName;

    // localStorageに保存
    localStorage.setItem(attendanceKey, JSON.stringify(attendance));

    // 画面に表示
    const clockInTime = formatTime(now);
    document.getElementById('clock-in-time').textContent = clockInTime;

    // スプレッドシートに送信（GAS API）
    sendToGAS({
        action: 'clockIn',
        userId: userInfo.userId,
        userName: userInfo.userName,
        timestamp: now.toISOString()
    }).then(() => {
        updateStatus(`出勤を記録しました (${clockInTime})`, 'success');
        console.log('GAS送信成功');
    }).catch(error => {
        updateStatus(`出勤を記録しました (${clockInTime}) ※オンライン送信待機中`, 'success');
        console.warn('GAS API送信エラー:', error);
    });

    console.log('出勤打刻完了:', attendance);
}

/**
 * 退勤打刻処理
 */
function handleClockOut() {
    updateStatus('退勤を記録中...', 'processing');

    const now = new Date();
    const userInfo = getUserInfo();
    const today = getTodayDateString();
    const attendanceKey = `attendance_${today}`;

    // 既存の打刻データを取得
    const stored = localStorage.getItem(attendanceKey);
    if (!stored) {
        updateStatus('エラー: 出勤打刻が記録されていません', 'error');
        return;
    }

    let attendance = JSON.parse(stored);

    // 出勤時刻がない場合はエラー
    if (!attendance.clockIn) {
        updateStatus('エラー: 出勤打刻が記録されていません', 'error');
        return;
    }

    // 退勤時刻を記録
    attendance.clockOut = now.toISOString();

    // 勤務時間を計算（時間単位、小数）
    const clockInTime = new Date(attendance.clockIn);
    const workDurationMs = now - clockInTime;
    const workHours = workDurationMs / (1000 * 60 * 60); // ミリ秒→時間
    attendance.workHours = workHours;

    // localStorageに保存
    localStorage.setItem(attendanceKey, JSON.stringify(attendance));

    // 画面に表示
    const clockOutTime = formatTime(now);
    document.getElementById('clock-out-time').textContent = clockOutTime;
    document.getElementById('work-hours').textContent = formatWorkHours(workHours);

    // スプレッドシートに送信（GAS API）
    sendToGAS({
        action: 'clockOut',
        userId: userInfo.userId,
        userName: userInfo.userName,
        timestamp: now.toISOString(),
        workHours: workHours
    }).then(() => {
        updateStatus(`退勤を記録しました (${clockOutTime}) - 勤務時間: ${formatWorkHours(workHours)}`, 'success');
        console.log('GAS送信成功');
    }).catch(error => {
        updateStatus(`退勤を記録しました (${clockOutTime}) - 勤務時間: ${formatWorkHours(workHours)} ※オンライン送信待機中`, 'success');
        console.warn('GAS API送信エラー:', error);
    });

    console.log('退勤打刻完了:', attendance);
}

/**
 * ステータスメッセージを更新
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ (info/success/error/processing)
 */
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-text');

    // アイコンを選択
    let icon = '💬';
    switch (type) {
        case 'success':
            icon = '✅';
            break;
        case 'error':
            icon = '❌';
            break;
        case 'processing':
            icon = '⏳';
            break;
        default:
            icon = '💬';
    }

    statusElement.textContent = `${icon} ${message}`;
}

/**
 * 今日の日付文字列を取得 (YYYY-MM-DD形式)
 */
function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 時刻をフォーマット (HH:mm形式)
 * @param {Date} date - フォーマットする日時
 */
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * 勤務時間をフォーマット
 * @param {number} hours - 勤務時間（小数）
 */
function formatWorkHours(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}時間${m}分`;
}

/**
 * Google Apps ScriptにデータTを送信
 * @param {object} data - 送信するデータ
 * @returns {Promise}
 */
function sendToGAS(data) {
    // GAS URLが設定されていない場合はスキップ
    if (!GAS_API_URL || GAS_API_URL === 'YOUR_DEPLOYED_WEB_APP_URL_HERE') {
        console.log('GAS URL未設定 - ローカルのみで動作');
        return Promise.resolve();
    }

    return fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'no-cors', // CORS回避（レスポンスは読めない）
        body: JSON.stringify(data)
    })
        .then(() => {
            // no-corsモードではレスポンスの中身が読めないため、
            // 送信が完了したことだけを確認
            console.log('GAS送信完了:', data.action);
            return { success: true };
        })
        .catch(error => {
            console.error('GAS送信エラー:', error);
            throw error;
        });
}

// =======================================
// 課題完了報告機能
// =======================================

/**
 * 課題完了報告モーダルを開く
 */
function openTaskModal() {
    const modal = document.getElementById('task-modal');
    modal.classList.add('active');
    // フォームをリセット
    document.getElementById('app-url').value = '';
    document.getElementById('app-url').focus();
}

/**
 * 課題完了報告モーダルを閉じる
 */
function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    modal.classList.remove('active');
}

/**
 * 課題完了報告フォーム送信
 */
async function handleTaskSubmit(event) {
    event.preventDefault();

    const appUrl = document.getElementById('app-url').value.trim();
    if (!appUrl) {
        updateStatus('URLを入力してください', 'error');
        return;
    }

    updateStatus('課題完了を報告中...', 'info');

    const userInfo = getUserInfo();
    const timestamp = new Date().toISOString();

    const data = {
        action: 'submitTask',
        userId: userInfo.userId,
        userName: userInfo.userName,
        appUrl: appUrl,
        timestamp: timestamp
    };

    console.log('課題完了報告:', data);

    try {
        await sendToGAS(data);
        updateStatus('課題完了を報告しました 🎉', 'success');
        closeTaskModal();
    } catch (error) {
        updateStatus('報告に失敗しました ※ローカルには保存されません', 'error');
        console.error('課題完了報告エラー:', error);
    }
}

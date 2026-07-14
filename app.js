// 全局状态
let currentDate = '';
let allData = {};
let isLoading = false;
let monthlyChart = null;

// 检查是否在 Electron 环境中
function isElectron() {
    return typeof window.timeTrackerAPI !== 'undefined';
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 设置今天日期
    const today = new Date();
    currentDate = formatDate(today);
    document.getElementById('datePicker').value = currentDate;
    // 加载数据
    await loadData();
    renderTable();
    updateStats();
});

// 格式化日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 加载数据
async function loadData() {
    isLoading = true;
    try {
        if (isElectron()) {
            allData = await window.timeTrackerAPI.loadData();
        } else {
            // 降级到 localStorage（用于浏览器预览）
            const stored = localStorage.getItem('timeTrackerData');
            if (stored) {
                allData = JSON.parse(stored);
            }
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('加载数据失败');
    }
    // 确保当前日期有数据结构
    if (!allData) {
        allData = {};
    }
    if (!allData[currentDate]) {
        allData[currentDate] = {
            startTime: '08:00',
            events: []
        };
    }
    document.getElementById('startTime').value = allData[currentDate].startTime;
    isLoading = false;
}

// 保存数据
async function saveData() {
    if (isLoading) return; // 加载过程中不保存
    try {
        if (isElectron()) {
            await window.timeTrackerAPI.saveData(allData);
        } else {
            // 降级到 localStorage
            localStorage.setItem('timeTrackerData', JSON.stringify(allData));
        }
    } catch (error) {
        console.error('保存数据失败:', error);
        showError('保存数据失败');
    }
}

// 保存开始时间
async function saveStartTime() {
    // 确保当前日期数据存在
    if (!allData[currentDate]) {
        allData[currentDate] = { startTime: '08:00', events: [] };
    }
    const startTime = document.getElementById('startTime').value;
    allData[currentDate].startTime = startTime;
    await saveData();
    updateStats();
}

// 切换日期
async function changeDate() {
    currentDate = document.getElementById('datePicker').value;
    await loadData();
    renderTable();
    updateStats();
}

// 前一天
async function goToPrevDay() {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    currentDate = formatDate(date);
    document.getElementById('datePicker').value = currentDate;
    await loadData();
    renderTable();
    updateStats();
}

// 后一天
async function goToNextDay() {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    currentDate = formatDate(date);
    document.getElementById('datePicker').value = currentDate;
    await loadData();
    renderTable();
    updateStats();
}

// 回到今天
async function goToToday() {
    const today = new Date();
    currentDate = formatDate(today);
    document.getElementById('datePicker').value = currentDate;
    await loadData();
    renderTable();
    updateStats();
}

// 添加事件
async function addEvent() {
    // 确保当前日期数据存在
    if (!allData[currentDate]) {
        allData[currentDate] = { startTime: '08:00', events: [] };
    }
    const events = allData[currentDate].events;
    const newEvent = {
        id: Date.now(),
        important: false,
        description: '',
        time: ''
    };
    events.push(newEvent);
    await saveData();
    renderTable();
    // 聚焦到新行的描述输入框
    setTimeout(() => {
        const lastRow = document.querySelector('#eventBody tr:last-child');
        if (lastRow) {
            const descInput = lastRow.querySelector('textarea[data-field="description"]');
            if (descInput) descInput.focus();
        }
    }, 50);
}

// 删除事件
async function deleteEvent(id) {
    const events = allData[currentDate].events;
    const index = events.findIndex(e => e.id === id);
    if (index > -1) {
        events.splice(index, 1);
        await saveData();
        renderTable();
        updateStats();
    }
}

// 切换重要标记
async function toggleImportant(id) {
    const events = allData[currentDate].events;
    const event = events.find(e => e.id === id);
    if (event) {
        event.important = !event.important;
        await saveData();
        renderTable();
        updateStats();
    }
}

// 更新事件字段
async function updateEvent(id, field, value) {
    const events = allData[currentDate].events;
    const event = events.find(e => e.id === id);
    if (event) {
        event[field] = value;
        await saveData();
        // 如果更新的是时间，需要验证并重新计算
        if (field === 'time') {
            if (!validateTimeOrder()) {
                showError('时间顺序错误，请按完成时间顺序输入');
                return;
            }
        }
        renderTable();
        updateStats();
    }
}

// 验证时间顺序
function validateTimeOrder() {
    const events = allData[currentDate].events;
    const startTime = document.getElementById('startTime').value;
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (!event.time) continue;
        // 第一个事件不能早于开始时间
        if (i === 0) {
            if (event.time < startTime) {
                return false;
            }
        } else {
            // 后续事件不能早于前一个事件
            const prevEvent = events[i - 1];
            if (prevEvent.time && event.time < prevEvent.time) {
                return false;
            }
        }
    }
    return true;
}

// 计算时间差（分钟）
function getTimeDiff(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
}

// 描述输入框自适应高度：内容变多时自动增高，确保所有文字可见且自动换行
function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// 窗口尺寸变化（如最大化/还原）时重新换行，保持高度匹配
window.addEventListener('resize', () => {
    document.querySelectorAll('textarea[data-field="description"]').forEach(autoGrow);
});

// 渲染表格
function renderTable() {
    // 确保当前日期数据存在
    if (!allData[currentDate] || !allData[currentDate].events) {
        return;
    }
    const events = allData[currentDate].events;
    const tbody = document.getElementById('eventBody');
    const emptyState = document.getElementById('emptyState');
    if (events.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';
    const startTime = document.getElementById('startTime').value;
    let prevTime = startTime;
    tbody.innerHTML = events.map((event, index) => {
        const duration = event.time ? getTimeDiff(prevTime, event.time) : 0;
        const isValidDuration = duration > 0;
        // 更新 prevTime 用于下一个事件
        if (event.time) {
            prevTime = event.time;
        }
        return `
            <tr class="${event.important ? 'important-row' : ''} animate-slide-in" style="animation-delay: ${index * 0.05}s">
                <td>
                    <div class="checkbox-custom ${event.important ? 'checked' : ''}"
                         onclick="toggleImportant(${event.id})"
                         role="checkbox"
                         aria-checked="${event.important}"
                         tabindex="0"
                         onkeydown="if(event.key==='Enter'||event.key===' ')toggleImportant(${event.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </td>
                <td>
                    <textarea class="input-clean"
                           placeholder="输入事件描述..."
                           data-field="description"
                           rows="1"
                           oninput="autoGrow(this)"
                           onchange="updateEvent(${event.id}, 'description', this.value)"
                           aria-label="事件描述">${escapeHtml(event.description)}</textarea>
                </td>
                <td>
                    <input type="time"
                           class="input-clean time-input"
                           value="${event.time}"
                           data-field="time"
                           onchange="updateEvent(${event.id}, 'time', this.value)"
                           aria-label="完成时间">
                </td>
                <td>
                    ${event.time && isValidDuration ?
            `<span class="duration-badge ${event.important ? 'important' : ''}">
                            ${duration} 分钟
                        </span>` :
            event.time ?
                '<span class="text-xs text-[var(--danger)]">时间错误</span>' :
                '<span class="text-xs text-[var(--fg-muted)]">-</span>'
        }
                </td>
                <td>
                    <button class="btn-icon danger" onclick="deleteEvent(${event.id})" aria-label="删除事件">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    // 描述输入框初始化高度，完整显示多行内容
    tbody.querySelectorAll('textarea[data-field="description"]').forEach(autoGrow);
}

// 更新统计
function updateStats() {
    // 确保当前日期数据存在
    if (!allData[currentDate] || !allData[currentDate].events) {
        return;
    }
    const events = allData[currentDate].events;
    const startTime = document.getElementById('startTime').value;
    // 事件统计
    const totalEvents = events.length;
    const importantCount = events.filter(e => e.important).length;
    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('importantCount').textContent = importantCount;
    // 时间计算
    let totalSpan = 0;
    let importantTime = 0;
    if (events.length > 0 && events[events.length - 1].time) {
        const lastTime = events[events.length - 1].time;
        totalSpan = getTimeDiff(startTime, lastTime);
        // 计算重要事件时间
        let prevTime = startTime;
        for (const event of events) {
            if (event.time) {
                const duration = getTimeDiff(prevTime, event.time);
                if (duration > 0 && event.important) {
                    importantTime += duration;
                }
                prevTime = event.time;
            }
        }
    }
    // 更新显示
    document.getElementById('totalSpan').textContent = `${totalSpan} 分钟`;
    document.getElementById('totalSpanHours').textContent = totalSpan > 0 ?
        `约 ${(totalSpan / 60).toFixed(1)} 小时` : '';
    document.getElementById('importantTime').textContent = `${importantTime} 分钟`;
    document.getElementById('importantTimeHours').textContent = importantTime > 0 ?
        `约 ${(importantTime / 60).toFixed(1)} 小时` : '';
    // 计算占比
    let ratio = 0;
    if (totalSpan > 0) {
        ratio = (importantTime / totalSpan * 100).toFixed(1);
    }
    document.getElementById('importantRatio').textContent = `${ratio}%`;
    document.getElementById('ratioProgress').style.width = `${Math.min(ratio, 100)}%`;
    // 更新月度趋势图
    renderChart();
}

// 显示提示
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 显示错误
function showError(message) {
    showToast(message, 'error');
}

// 显示成功
function showSuccess(message) {
    showToast(message, 'success');
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 导出数据
async function exportData() {
    if (!isElectron()) {
        // 浏览器环境：下载 JSON 文件
        const dataStr = JSON.stringify(allData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timetracker-backup-${formatDate(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }
    try {
        const result = await window.timeTrackerAPI.exportData(`timetracker-backup-${formatDate(new Date())}.json`);
        if (result.success) {
            showSuccess('导出成功: ' + result.path);
        } else if (!result.canceled) {
            showError('导出失败: ' + result.error);
        }
    } catch (error) {
        console.error('导出失败:', error);
        showError('导出失败');
    }
}

// 导入数据
async function importData() {
    if (!isElectron()) {
        // 浏览器环境：使用文件选择器
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        allData = JSON.parse(event.target.result);
                        await saveData();
                        renderTable();
                        updateStats();
                        showSuccess('导入成功');
                    } catch (error) {
                        showError('导入失败: 文件格式错误');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
        return;
    }
    try {
        const result = await window.timeTrackerAPI.importData();
        if (result.success) {
            allData = result.data;
            // 确保当前日期有数据结构
            if (!allData[currentDate]) {
                allData[currentDate] = {
                    startTime: '08:00',
                    events: []
                };
            }
            document.getElementById('startTime').value = allData[currentDate].startTime;
            renderTable();
            updateStats();
            showSuccess('导入成功');
        } else if (!result.canceled) {
            showError('导入失败: ' + result.error);
        }
    } catch (error) {
        console.error('导入失败:', error);
        showError('导入失败');
    }
}

// 窗口控制
function minimizeWindow() {
    if (isElectron()) {
        window.timeTrackerAPI.minimizeWindow();
    }
}

function maximizeWindow() {
    if (isElectron()) {
        window.timeTrackerAPI.maximizeWindow();
    }
}

function closeWindow() {
    if (isElectron()) {
        window.timeTrackerAPI.closeWindow();
    }
}

// 计算过去30天的统计数据
function computeMonthlyStats() {
    const stats = [];
    const endDate = new Date(currentDate);
    for (let i = 29; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayData = allData[dateStr];
        let totalSpan = 0;
        let importantTime = 0;
        let ratio = 0;
        if (dayData && dayData.events && dayData.events.length > 0) {
            const events = dayData.events;
            const startTime = dayData.startTime || '08:00';
            const lastEvent = events[events.length - 1];
            if (lastEvent.time) {
                totalSpan = getTimeDiff(startTime, lastEvent.time);
                let prevTime = startTime;
                for (const event of events) {
                    if (event.time) {
                        const duration = getTimeDiff(prevTime, event.time);
                        if (duration > 0 && event.important) {
                            importantTime += duration;
                        }
                        prevTime = event.time;
                    }
                }
                if (totalSpan > 0) {
                    ratio = parseFloat((importantTime / totalSpan * 100).toFixed(1));
                }
            }
        }
        stats.push({
            label,
            totalHours: parseFloat((totalSpan / 60).toFixed(2)),
            importantHours: parseFloat((importantTime / 60).toFixed(2)),
            ratio
        });
    }
    return stats;
}

// 渲染月度趋势图
function renderChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const stats = computeMonthlyStats();
    const labels = stats.map(s => s.label);
    const totalData = stats.map(s => s.totalHours);
    const importantData = stats.map(s => s.importantHours);
    const ratioData = stats.map(s => s.ratio);

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '总时间 (小时)',
                    data: totalData,
                    borderColor: '#6b7280',
                    backgroundColor: 'rgba(107, 114, 128, 0.08)',
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: '有效时间 (小时)',
                    data: importantData,
                    borderColor: '#d97706',
                    backgroundColor: 'rgba(217, 119, 6, 0.12)',
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: '有效时间率 (%)',
                    data: ratioData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 16,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 29, 35, 0.9)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            if (label.includes('%')) {
                                return `${label}: ${value}%`;
                            }
                            return `${label}: ${value}h`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11 },
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                },
                y: {
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '小时',
                        font: { size: 12 }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { size: 11 } }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: '有效率 %',
                        font: { size: 12 }
                    },
                    grid: { drawOnChartArea: false },
                    ticks: {
                        font: { size: 11 },
                        callback: function(value) { return value + '%'; }
                    }
                }
            }
        }
    });
}

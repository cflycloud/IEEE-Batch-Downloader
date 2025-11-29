(function() {
    // 状态变量
    let allCheckboxes = [];
    let currentBatchIndex = 0;
    let batchSize = 10;
    let totalPapers = 0;

    // --- UI 创建部分 (保持不变) ---
    function createUI() {
        if (document.getElementById('ieee-batch-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'ieee-batch-panel';
        panel.innerHTML = `
            <h3>IEEE 批量下载助手 (V3)</h3>
            <div id="status-msg" class="status-text">准备就绪。点击“开始”以初始化。</div>
            <button id="btn-start" class="btn-primary">开始 (Start)</button>
            <button id="btn-download" class="btn-primary btn-disabled">下载当前批次 (Download)</button>
            <button id="btn-next" class="btn-secondary btn-disabled">下一批 (Next Batch)</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('btn-start').addEventListener('click', initProcess);
        document.getElementById('btn-download').addEventListener('click', triggerIEEEDownload);
        document.getElementById('btn-next').addEventListener('click', nextBatch);
    }

    function updateStatus(msg) {
        const el = document.getElementById('status-msg');
        if(el) el.innerText = msg;
    }

    function toggleBtn(id, enable) {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.classList.toggle('btn-disabled', !enable);
    }

    // --- 核心逻辑 ---

    // 1. 初始化：全局搜索 + 智能过滤
    function initProcess() {
        // 步骤A: 获取页面所有复选框
        const rawCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));

        // 步骤B: 智能过滤
        allCheckboxes = rawCheckboxes.filter(cb => {
            // 1. 排除侧边栏 (Sidebar)
            // IEEE 侧边栏通常包含在 class 为 'facets-container', 'left-column' 或 ID 为 'action-bar' 的元素中
            if (cb.closest('.facets-container') || cb.closest('.facet-bar') || cb.closest('.left-column')) {
                return false;
            }

            // 2. 排除全选框 (Select All)
            // 检查 ID 或旁边的文字
            if (cb.id && cb.id.toLowerCase().includes('selectall')) return false;

            // 3. 核心特征匹配：论文复选框的 value 必须是纯数字 (Article ID)
            // 这是区分论文和侧边栏（通常是字符串）最强的特征
            const value = cb.value ? cb.value.trim() : '';
            const isNumericId = /^\d+$/.test(value);

            if (isNumericId) {
                return true;
            }

            // 备用判断：如果 value 为空，检查是否位于结果列表中
            // 某些特殊页面可能 value 未绑定，检查父级类名
            const inResultItem = cb.closest('.List-results-item') || cb.closest('.result-item') || cb.closest('.xpl-results-item');
            if (inResultItem && !cb.closest('.global-select-all')) {
                return true;
            }

            return false;
        });

        // 去重 (防止同一个 ID 被选取两次，虽然少见)
        allCheckboxes = [...new Set(allCheckboxes)];

        totalPapers = allCheckboxes.length;

        // 结果校验
        if (totalPapers === 0) {
            updateStatus("错误：未识别到论文复选框。\n请确认页面已加载完毕，且包含论文列表。");
            return;
        }

        // 如果识别数量过少（比如只有1个），可能是规则太严，给用户提示
        if (totalPapers < 2) {
             console.warn("警告：只识别到少于2个复选框，可能存在识别问题。");
        }

        // 清空所有已选
        rawCheckboxes.forEach(cb => {
            if(cb.checked) cb.click(); 
        });

        currentBatchIndex = 0;
        updateStatus(`识别成功！\n共找到 ${totalPapers} 篇论文 (已过滤侧边栏)。\n点击【下一批】开始勾选前 10 篇。`);
        
        toggleBtn('btn-start', false);
        toggleBtn('btn-next', true); 
        // 这里改变逻辑：初始化后不自动勾选，让用户点一次 Next 明确开始
    }

    // 2. 批次处理
    function nextBatch() {
        // 取消上一批
        if (currentBatchIndex > 0) {
            const prevStart = (currentBatchIndex - 1) * batchSize;
            const prevEnd = prevStart + batchSize;
             for (let i = prevStart; i < prevEnd && i < totalPapers; i++) {
                if (allCheckboxes[i] && allCheckboxes[i].checked) {
                    allCheckboxes[i].click();
                }
            }
        }

        const start = currentBatchIndex * batchSize;
        const end = Math.min(start + batchSize, totalPapers);

        // 检查是否结束
        if (start >= totalPapers) {
            updateStatus(`所有论文 (${totalPapers}篇) 已处理完毕！`);
            toggleBtn('btn-download', false);
            toggleBtn('btn-next', false);
            toggleBtn('btn-start', true);
            return;
        }

        // 勾选当前批次
        let checkedCount = 0;
        for (let i = start; i < end; i++) {
            if (allCheckboxes[i] && !allCheckboxes[i].checked) {
                allCheckboxes[i].click(); // 模拟点击，触发Angular/React事件
                checkedCount++;
            }
        }

        currentBatchIndex++;
        
        updateStatus(`第 ${currentBatchIndex} 批 (第 ${start+1}-${end} 篇)\n已勾选 ${checkedCount} 个。\n\n确认无误后，点击【下载当前批次】。`);
        
        toggleBtn('btn-download', true);
        toggleBtn('btn-next', false);
    }

    // 3. 触发下载
    function triggerIEEEDownload() {
        // 模糊匹配下载按钮
        const candidates = Array.from(document.querySelectorAll('button, a, span'));
        const ieeeDownloadBtn = candidates.find(el => {
            if (!el.innerText) return false;
            const txt = el.innerText.trim().toLowerCase();
            // 匹配 "Download PDFs" 或者 "Download Selected"
            return txt.includes('download pdfs') || txt.includes('download selected');
        });

        if (ieeeDownloadBtn && ieeeDownloadBtn.offsetParent !== null) {
            ieeeDownloadBtn.click();
            updateStatus(`正在请求下载...\n(第 ${currentBatchIndex} 批)\n\n等待浏览器响应后，点击【下一批】。`);
            toggleBtn('btn-download', false);
            toggleBtn('btn-next', true);
        } else {
            updateStatus("⚠️ 未找到 'Download PDFs' 按钮。\n请手动点击页面上的蓝色下载按钮，\n然后点击插件面板的【下一批】。");
            toggleBtn('btn-next', true);
        }
    }

    createUI();

})();
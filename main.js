/**
 * MyFinance Engine v3.0
 * Structured Workflow: Import -> Confer -> Consolidate
 */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- STATE ---
    let state = {
        currentDate: new Date(),
        draft: [],           // Transactions imported/added in current session
        consolidated: {}     // Key: 'YYYY-MM', Value: { transactions: [] }
    };

    // --- DOM ELEMENTS ---
    const el = {
        monthDisplay: document.getElementById('current-month-display'),
        prevMonth: document.getElementById('prev-month'),
        nextMonth: document.getElementById('next-month'),
        
        // Tables
        cardTable: document.getElementById('card-transactions-body'),
        manualTable: document.getElementById('manual-transactions-body'),
        cardCount: document.getElementById('card-count-badge'),
        manualCount: document.getElementById('manual-count-badge'),
        
        // Stats
        totalCard: document.getElementById('total-card'),
        totalManual: document.getElementById('total-manual'),
        totalIncome: document.getElementById('total-income'),
        totalBalance: document.getElementById('total-balance'),
        
        // Actions
        csvUpload: document.getElementById('csv-upload'),
        btnManual: document.getElementById('btn-add-manual'),
        btnEditIncome: document.getElementById('btn-edit-income'),
        btnSave: document.getElementById('btn-save-month'),
        btnBackup: document.getElementById('btn-backup'),
        
        // Navigation / Tabs
        navItems: document.querySelectorAll('.nav-item'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Modals
        modalManual: document.getElementById('modal-manual'),
        formManual: document.getElementById('form-manual'),
        modalIncome: document.getElementById('modal-income'),
        formIncome: document.getElementById('form-income'),
        modalReplicate: document.getElementById('modal-replicate'),
        btnConfirmReplicate: document.getElementById('btn-confirm-replicate'),
        replicateInput: document.getElementById('replicate-months'),
        closeModal: document.querySelectorAll('.close-modal')
    };

    let catChart = null;
    let histChart = null;

    // --- PERSISTENCE ---
    const loadData = () => {
        const saved = localStorage.getItem('finance_v3_data');
        if (saved) {
            state.consolidated = JSON.parse(saved);
        }
        updateUI();
    };

    const saveToDisk = () => {
        localStorage.setItem('finance_v3_data', JSON.stringify(state.consolidated));
    };

    // --- UI LOGIC ---
    const updateUI = () => {
        const mKey = getMonthKey(state.currentDate);
        el.monthDisplay.textContent = formatMonthDisplay(state.currentDate);

        // Filter Drafts for this month (if we want to filter draft by date)
        // Actually, draft is global for the "current session"
        // But let's filter by the selected month to be precise
        const currentDraft = state.draft.filter(t => getMonthKey(new Date(t.date + 'T12:00:00')) === mKey);
        const savedMonth = state.consolidated[mKey] || { transactions: [], income: { salary: 0, extra: 0 } };
        
        // Combined view for the specific month
        const allTransactions = [...savedMonth.transactions, ...currentDraft];

        const cardTxs = allTransactions.filter(t => t.origin === 'Cartão');
        const manualTxs = allTransactions.filter(t => t.origin === 'Manual');

        // Stats
        const cardSum = cardTxs.reduce((a, b) => a + b.amount, 0);
        const manualSum = manualTxs.reduce((a, b) => a + b.amount, 0);
        const expensesTotal = cardSum + manualSum;

        const income = savedMonth.income || { salary: 0, extra: 0 };
        const incomeTotal = (parseFloat(income.salary) || 0) + (parseFloat(income.extra) || 0);
        const finalBalance = incomeTotal - expensesTotal;
        
        el.totalCard.textContent = formatBRL(cardSum);
        el.totalManual.textContent = formatBRL(manualSum);
        el.totalIncome.textContent = formatBRL(incomeTotal);
        el.totalBalance.textContent = formatBRL(finalBalance);

        // Styling Balance
        const balanceCard = el.totalBalance.closest('.stat-card');
        balanceCard.classList.remove('positive', 'negative');
        if (finalBalance >= 0) {
            balanceCard.classList.add('positive');
        } else {
            balanceCard.classList.add('negative');
        }

        // Table Renderings
        renderTable(el.cardTable, cardTxs, el.cardCount);
        renderTable(el.manualTable, manualTxs, el.manualCount);

        // Charts (Only show consolidated data in charts? Or both? User said "depois aparece em resumo")
        // I'll show only consolidated in the summary, and maybe a "Draft" indicator?
        // Actually, user said: "depois eu salvo ai depois aparece em resumo o quanto que eu gastei no gráfico do mês"
        // So charts = Consolidated only.
        updateCharts(savedMonth.transactions);
        
        lucide.createIcons();
    };

    const categoriesList = ['Alimentação', 'Mercado', 'Transporte', 'Educação', 'Saúde', 'Lazer & Hobby', 'Vestuário', 'Casa & Decor', 'Compras Online', 'Assinaturas & Ti', 'Serviços', 'Beleza', 'Pet', 'Outros'];

    const renderTable = (tbody, txs, badge) => {
        tbody.innerHTML = '';
        badge.textContent = `${txs.length} itens`;

        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Sem transações para este mês.</td></tr>';
            return;
        }

        // Sort by date desc
        const sorted = [...txs].sort((a, b) => new Date(b.date + 'T12:00:00') - new Date(a.date + 'T12:00:00'));

        sorted.forEach(t => {
            const isDraft = state.draft.find(d => d.id === t.id);
            const row = document.createElement('tr');
            
            const options = categoriesList.map(cat => 
                `<option value="${cat}" ${t.category === cat ? 'selected' : ''}>${cat}</option>`
            ).join('');

            row.innerHTML = `
                <td>${formatPtDate(t.date)}</td>
                <td>${t.title} ${isDraft ? '<span class="badge">Novo</span>' : ''}</td>
                <td>
                    <select class="category-select" data-id="${t.id}">
                        ${options}
                    </select>
                </td>
                <td>${formatBRL(t.amount)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-action btn-move" data-id="${t.id}" title="Mover Mês">
                            <i data-lucide="calendar-days"></i>
                        </button>
                        <button class="btn-action btn-delete" data-id="${t.id}" title="Excluir">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Event Listeners
        tbody.querySelectorAll('.category-select').forEach(select => {
            select.onchange = (e) => updateTxCategory(select.dataset.id, e.target.value);
        });

        tbody.querySelectorAll('.btn-move').forEach(btn => {
            btn.onclick = () => openReplicateModal(btn.dataset.id);
        });

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => removeTx(btn.dataset.id);
        });
    };

    let txToReplicate = null;

    const openReplicateModal = (id) => {
        txToReplicate = id;
        el.replicateInput.value = 2;
        el.modalReplicate.style.display = 'block';
    };

    el.btnConfirmReplicate.onclick = () => {
        const numMonths = parseInt(el.replicateInput.value); 
        if (!numMonths || !txToReplicate) return;

        // Find transaction
        const mKeyOrigin = getMonthKey(state.currentDate);
        let originTx = state.draft.find(t => t.id === txToReplicate);
        if (!originTx && state.consolidated[mKeyOrigin]) {
            originTx = state.consolidated[mKeyOrigin].transactions.find(t => t.id === txToReplicate);
        }

        if (originTx) {
            // Update original title with sufix if not present
            if (!originTx.title.includes('(1/')) {
                originTx.title += ` (1/${numMonths})`;
            }

            // Create future installments (starting from month 2)
            const [y, m, d] = originTx.date.split('-').map(Number);
            
            for (let i = 1; i < numMonths; i++) {
                let nextYear = y;
                let nextMonth = (m - 1) + i; // 0-indexed
                
                // Adjust Year/Month
                while (nextMonth > 11) {
                    nextMonth -= 12;
                    nextYear++;
                }

                // Protect day overflow (Day 31 in 30-day month)
                const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
                const targetDay = Math.min(d, lastDay);
                
                const targetMonthKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
                const targetDateStr = `${targetMonthKey}-${String(targetDay).padStart(2, '0')}`;
                
                const newTx = {
                    ...originTx,
                    id: Math.random().toString(36).substr(2, 9),
                    date: targetDateStr,
                    title: originTx.title.split(' (1/')[0] + ` (${i + 1}/${numMonths})`
                };

                if (!state.consolidated[targetMonthKey]) {
                    state.consolidated[targetMonthKey] = { transactions: [], income: { salary: 0, extra: 0 } };
                }
                state.consolidated[targetMonthKey].transactions.push(newTx);
            }
            
            saveToDisk();
            updateUI();
            el.modalReplicate.style.display = 'none';
            alert(`${numMonths - 1} parcelas futuras geradas com sucesso!`);
        }
    };

    const updateTxCategory = (id, newCat) => {
        const draftIdx = state.draft.findIndex(t => t.id === id);
        if (draftIdx !== -1) {
            state.draft[draftIdx].category = newCat;
        } else {
            const mKey = getMonthKey(state.currentDate);
            if (state.consolidated[mKey]) {
                const txIdx = state.consolidated[mKey].transactions.findIndex(t => t.id === id);
                if (txIdx !== -1) {
                    state.consolidated[mKey].transactions[txIdx].category = newCat;
                }
            }
        }
        saveToDisk();
        updateUI();
    };

    const removeTx = (id) => {
        // Remove from draft
        state.draft = state.draft.filter(t => t.id !== id);
        // Remove from consolidated
        const mKey = getMonthKey(state.currentDate);
        if (state.consolidated[mKey]) {
            state.consolidated[mKey].transactions = state.consolidated[mKey].transactions.filter(t => t.id !== id);
        }
        saveToDisk();
        updateUI();
    };

    // --- TAB SYSTEM ---
    el.navItems.forEach(item => {
        item.onclick = () => {
            el.navItems.forEach(i => i.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(item.dataset.tab).classList.add('active');
        };
    });

    // --- CONSOLIDATION ---
    el.btnSave.onclick = () => {
        if (state.draft.length === 0) {
            alert("Não há novos dados para consolidar.");
            return;
        }

        state.draft.forEach(t => {
            const mKey = getMonthKey(new Date(t.date + 'T12:00:00'));
            if (!state.consolidated[mKey]) state.consolidated[mKey] = { transactions: [] };
            state.consolidated[mKey].transactions.push(t);
        });

        state.draft = [];
        saveToDisk();
        updateUI();
        alert("Todas as alterações foram salvas com sucesso em todo o seu histórico!");
    };

    // --- IMPORTING ---
    el.csvUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (r) => {
                const results = r.data;
                const headers = r.meta.fields.map(h => h.trim().toLowerCase());
                let parsed = [];

                // IMPORTANTE: Forçar todos os gastos para o mês atualmente selecionado
                const targetKey = getMonthKey(state.currentDate);

                if (headers.includes('lancamento') || headers.includes('lançamento')) {
                    parsed = results.map(i => {
                        const val = cleanVal(i['Valor']);
                        const title = cleanTitle(i['Lançamento'] || i['Lancamento']);
                        if (val === 0 || title.includes('PAGAMENTO')) return null;
                        
                        // Manter o dia original, mas forçar mês/ano do contexto atual
                        const originalDay = (i['Data'] || "").split('/')[0] || "01";
                        const forcedDate = `${targetKey}-${originalDay.padStart(2, '0')}`;
                        
                        return { id: Math.random().toString(36).substr(2, 9), date: forcedDate, title, amount: val, origin: 'Cartão', category: categorize(title) };
                    });
                } else {
                    parsed = results.map(i => {
                        const val = parseFloat(i['amount']);
                        const title = cleanTitle(i['title']);
                        if (val === 0 || title.includes('PAGAMENTO')) return null;
                        
                        const originalDay = (i['date'] || "").split('-')[2] || "01";
                        const forcedDate = `${targetKey}-${originalDay.padStart(2, '0')}`;
                        
                        return { id: Math.random().toString(36).substr(2, 9), date: forcedDate, title, amount: val, origin: 'Cartão', category: categorize(title) };
                    });
                }

                state.draft.push(...parsed.filter(x => x));
                updateUI();
            }
        });
    };

    el.formManual.onsubmit = (e) => {
        e.preventDefault();
        
        const totalAmount = parseFloat(document.getElementById('manual-value').value);
        const installments = parseInt(document.getElementById('manual-installments').value) || 1;
        const startDate = new Date(document.getElementById('manual-date').value + 'T12:00:00');
        const desc = document.getElementById('manual-desc').value.toUpperCase();
        const category = document.getElementById('manual-category').value;
        const installmentValue = totalAmount / installments;

        const newEntries = [];
        const [y, m, d] = document.getElementById('manual-date').value.split('-').map(Number);

        for (let i = 0; i < installments; i++) {
            let nextYear = y;
            let nextMonth = (m - 1) + i;
            
            while (nextMonth > 11) {
                nextMonth -= 12;
                nextYear++;
            }

            const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
            const targetDay = Math.min(d, lastDay);
            const targetDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
            
            const monthLabel = installments > 1 ? ` (${i + 1}/${installments})` : "";
            
            newEntries.push({
                id: Math.random().toString(36).substr(2, 9),
                date: targetDateStr,
                title: desc + monthLabel,
                amount: installmentValue,
                origin: 'Manual',
                category: category
            });
        }

        state.draft.push(...newEntries);
        el.modalManual.style.display = 'none';
        el.formManual.reset();
        updateUI();
    };

    // --- CHARTS ---
    const updateCharts = (txs) => {
        // Category Chart
        const categories = {};
        txs.forEach(t => categories[t.category] = (categories[t.category] || 0) + t.amount);

        const catCtx = document.getElementById('categoryChart').getContext('2d');
        if (catChart) catChart.destroy();
        catChart = new Chart(catCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{ 
                    data: Object.values(categories), 
                    backgroundColor: [
                        '#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', 
                        '#06b6d4', '#8b5cf6', '#10b981', '#f43f5e', '#fb923c',
                        '#6d28d9', '#be185d', '#15803d', '#b91c1c', '#a16207'
                    ], 
                    borderWidth: 0 
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, cutout: '75%' }
        });

        // History Chart - Full Year (Jan to Dec)
        const currentYear = state.currentDate.getFullYear();
        const months = [];
        for (let i = 0; i < 12; i++) {
            const m = String(i + 1).padStart(2, '0');
            months.push(`${currentYear}-${m}`);
        }

        const histTotals = months.map(m => (state.consolidated[m]?.transactions || []).reduce((a, b) => a + b.amount, 0));
        const histIncome = months.map(m => {
            const inc = state.consolidated[m]?.income || { salary: 0, extra: 0 };
            return (parseFloat(inc.salary) || 0) + (parseFloat(inc.extra) || 0);
        });

        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const histCtx = document.getElementById('historyChart').getContext('2d');
        if (histChart) histChart.destroy();
        histChart = new Chart(histCtx, {
            data: { 
                labels: monthNames, 
                datasets: [
                    { 
                        type: 'line',
                        label: 'Renda Total',
                        data: histIncome, 
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        pointRadius: 4,
                        fill: false
                    },
                    { 
                        type: 'bar',
                        label: 'Gastos',
                        data: histTotals, 
                        backgroundColor: '#6366f1', 
                        borderRadius: 8 
                    }
                ] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, 
                    x: { ticks: { color: '#94a3b8' } } 
                }, 
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { color: '#94a3b8', boxWidth: 12 } 
                    } 
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const [y, m] = months[index].split('-');
                        state.currentDate = new Date(y, m - 1, 1);
                        updateUI();
                    }
                },
                onHover: (evt, elements) => {
                    evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                }
            }
        });
    };

    // --- UTILS ---
    const getMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const formatMonthDisplay = (d) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    const formatPtDate = (s) => { if(!s) return ''; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
    const parseInterDate = (s) => { const [d,m,y] = s.split('/'); return `${y}-${m}-${d}`; };
    const cleanVal = (s) => parseFloat((s || "0").replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    const cleanTitle = (s) => (s || "").toUpperCase().replace(/PARCELA \d+\/\d+/g, '').replace(/^(MP \*|EC \*|DM \*|IP \*|PP \*)/g, '').trim();
    const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const categorize = (t) => {
        const title = (t || "").toUpperCase();
        const map = {
            'Alimentação': ['IFOOD', 'MC DONALDS', 'RESTAURANTE', 'PADARIA', 'ASSAI', 'ATACADAO', 'CARREFOUR', 'LANCHONETE', 'ZE DELIVERY', 'PIZZA', 'CHURRASCARIA', 'RECHEIO', 'GIRAFFAS', 'SUBWAY', 'OUTBACK', 'BURGER KING', 'HIROTA', 'PURA VIDA', 'NATURAL', 'CONFEITARIA', 'COFFEE', 'CAFE', 'HAMBURGUER', 'HABBIB', 'SPOLETO', 'MADERO'],
            'Mercado': ['MERCADO', 'SUPERMERCADO', 'HIPERMERCADO', 'PAO DE ACUCAR', 'EXTRA', 'BIG', 'SAM S CLUB', 'ZONA SUL', 'MUFFATO', 'ANGELONI', 'ZAFFARI', 'CONDOR', 'FRIGO', 'HORTIFRUTI', 'SACOLÃO'],
            'Transporte': ['UBER', '99APP', 'POSTO', 'COMBUSTIVEL', 'SHELL', 'IPIRANGA', 'PETROBRAS', 'PEDAGIO', 'ESTACIONAMENTO', 'AUTO PECAS', 'OFICINA', 'REVYRO', 'VELOE', 'PARKING', 'CABIFY', 'METRO', 'TREM', 'ONIBUS', 'RODOVIARIA', 'CONCORDE', 'BR GAS'],
            'Educação': ['CURSO', 'FACULDADE', 'UDEMY', 'LIVRARIA', 'ESCOLA', 'ALURA', 'COLEGIO', 'SARAIVA', 'CULTURA', 'IDIOMA', 'INGLES', 'ESTRELA', 'CUPULA'],
            'Saúde': ['FARMACIA', 'DROGARIA', 'PAGUE MENOS', 'DROGASIL', 'RAIA', 'HOSPITAL', 'CLINICA', 'EXAME', 'ODONTO', 'MEDICO', 'LABORATORIO', 'SAO PAULO', 'BIOLAB', 'DENTAL'],
            'Lazer & Hobby': ['NETFLIX', 'SPOTIFY', 'CINEMA', 'SHOW', 'EVENTO', 'STEAM', 'PLAYSTATION', 'XBOX', 'INGRESSO', 'GAME', 'TEATRO', 'MUSEU', 'LIVRARIA', 'HOBBY', 'ARTES'],
            'Vestuário': ['ZARA', 'RENNER', 'RIACHUELO', 'C&A', 'HERING', 'CENTAURO', 'SHOPEE', 'AREZZO', 'SCHUTZ', 'HAVAIANAS', 'MARISA', 'RESERVA', 'NIKE', 'ADIDAS', 'PUMA'],
            'Casa & Decor': ['FERREIRA COSTA', 'LEROY MERLIN', 'CAMICADO', 'UTILIDADES', 'TELHANORTE', 'MOVEIS', 'CASAS BAHIA', 'MAGAZU', 'MAGALU', 'PONTO FRIO', 'TOK STOK', 'ETNA', 'DREAMS'],
            'Compras Online': ['MERCADOLIVRE', 'AMAZON', 'ALIEXPRESS', 'SHEIN', 'MAGAZINE', 'AMERICANAS', 'SUBMARINO', 'KABUM', 'PICPAY', 'PAGSEGURO'],
            'Assinaturas & Ti': ['GOOGLE', 'APPLE', 'MICROSOFT', 'HOSTINGER', 'CANVA', 'ADOBE', 'NUVEM', 'STREAMING', 'DISNEY', 'HBO', 'GLOBO', 'UOL', 'TERRA', 'VIMEO', 'CLOUDFLARE', 'DROPBOX'],
            'Serviços': ['CELULAR', 'INTERNET', 'CLARO', 'VIVO', 'TIM', 'OI', 'CONDOMINIO', 'COELBA', 'EMBASA', 'LUZ', 'AGUA', 'GAS', 'CARTORIO', 'CORREIOS', 'DESPACHANTE'],
            'Beleza': ['SALÃO', 'BARBEARIA', 'COSMETICO', 'BOTICARIO', 'NATURA', 'AVON', 'SEPHORA', 'PERFUMARIA', 'ESTETICA', 'MANICURE', 'CABELO', 'JEQUITI'],
            'Pet': ['PETSHOP', 'VETERINARIO', 'COBASI', 'PETZ', 'RAÇÃO', 'AGRO', 'ANIMAL'],
            'Outros': []
        };
        for (const [c, k] of Object.entries(map)) {
            if (k.some(x => title.includes(x))) return c;
        }
        return 'Outros';
    };

    // --- HANDLERS ---
    el.prevMonth.onclick = () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); updateUI(); };
    el.nextMonth.onclick = () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); updateUI(); };
    
    el.btnManual.onclick = () => { document.getElementById('manual-date').value = state.currentDate.toISOString().split('T')[0]; el.modalManual.style.display = 'block'; };
    
    el.btnEditIncome.onclick = () => {
        const mKey = getMonthKey(state.currentDate);
        const savedMonth = state.consolidated[mKey] || { income: { salary: 0, extra: 0 } };
        const inc = savedMonth.income || { salary: 0, extra: 0 };
        
        document.getElementById('income-salary').value = inc.salary || 0;
        document.getElementById('income-extra').value = inc.extra || 0;
        el.modalIncome.style.display = 'block';
    };

    el.closeModal.forEach(btn => {
        btn.onclick = () => {
            el.modalManual.style.display = 'none';
            el.modalIncome.style.display = 'none';
            if (el.modalReplicate) el.modalReplicate.style.display = 'none';
        };
    });

    el.formIncome.onsubmit = (e) => {
        e.preventDefault();
        const mKey = getMonthKey(state.currentDate);
        if (!state.consolidated[mKey]) state.consolidated[mKey] = { transactions: [] };
        
        state.consolidated[mKey].income = {
            salary: parseFloat(document.getElementById('income-salary').value),
            extra: parseFloat(document.getElementById('income-extra').value)
        };
        
        saveToDisk();
        updateUI();
        el.modalIncome.style.display = 'none';
    };
    
    el.btnBackup.onclick = () => {
        try {
            const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert("Erro ao gerar arquivo de backup.");
        }
    };

    document.getElementById('restore-backup').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm("Isso substituirá todos os seus dados atuais pelos dados do backup. Deseja continuar?")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                const importedState = JSON.parse(content);
                
                if (importedState && typeof importedState === 'object' && importedState.consolidated) {
                    state = importedState;
                    saveToDisk();
                    updateUI();
                    alert("Backup restaurado com sucesso!");
                } else {
                    alert("Arquivo de backup inválido: Estrutura não reconhecida.");
                }
            } catch (err) {
                console.error("Erro no Parse do Backup:", err);
                alert("Erro ao ler o arquivo de backup. Verifique se o arquivo está corrompido.");
            }
        };
        reader.onerror = () => alert("Erro ao carregar o arquivo.");
        reader.readAsText(file);
        e.target.value = '';
    };

    loadData();
    lucide.createIcons();
});

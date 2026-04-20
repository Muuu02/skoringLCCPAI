// ==========================================
// GANTI DENGAN URL DEPLOY APPS SCRIPT ANDA
const API_URL = "ISI_DENGAN_URL_WEB_APP_ANDA";
// ==========================================

// ==========================================
// PENGATURAN NAMA FILE SUARA (Pastikan letaknya se-folder)
// ==========================================
const audioTick = new Audio('tick.mp3');
const audioBuzzer = new Audio('buzzer.mp3');
audioTick.load(); 
audioBuzzer.load();
// ==========================================

const app = {
    role: '', user: '',
    allSessions: [],
    activeBabakName: '',
    sesi: null, scores: [], historyText: [], historyActions: [],
    isLocked: false,
    timerValue: 0, timerInterval: null,
    
    syncInterval: null,  // Tambahan untuk kontrol siklus refresh
    lastPushTime: 0,     // Tambahan fitur ANTI-GHOSTING

    async login() {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        const btn = document.getElementById('btn-login');
        if(!u || !p) return alert("Isi Username dan Password!");

        btn.innerText = "VERIFIKASI...";
        try {
            const req = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', user: u, pass: p })});
            const res = await req.json();
            if(res.success) {
                this.role = res.role; this.user = res.name;
                this.showDashboard();
            } else { alert('Gagal! Akun tidak valid.'); btn.innerText = "MASUK SISTEM"; }
        } catch (e) { alert('ERROR! Cek koneksi & URL Apps Script.'); btn.innerText = "MASUK SISTEM"; }
    },

    logout() {
        if(confirm("Yakin ingin keluar?")) {
            this.role = ''; this.user = '';
            document.getElementById('view-dashboard').classList.add('hidden');
            document.getElementById('view-scoring').classList.add('hidden');
            document.getElementById('view-login').classList.remove('hidden');
            document.getElementById('pass').value = '';
            document.getElementById('btn-login').innerText = "MASUK SISTEM";
        }
    },

    showDashboard() {
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('info-user').innerText = this.user || 'GUEST VIEWER';
        document.getElementById('info-role').innerText = this.role || 'MODE DISPLAY';
        this.loadSessions();
    },

    async loadSessions() {
        const list = document.getElementById('session-list');
        list.innerHTML = `<div class="col-span-full text-center py-12"><div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4 mx-auto"></div><p class="text-slate-500 font-bold text-xs uppercase tracking-widest">Sinkronisasi Database...</p></div>`;
        try {
            const req = await fetch(API_URL, { method:'POST', body: JSON.stringify({action:'getSessions'})});
            const res = await req.json();
            this.allSessions = res.sessions;
            this.renderDashboard();
        } catch (e) { list.innerHTML = `<p class="text-red-500 col-span-full text-center font-bold">Koneksi Database Terputus.</p>`; }
    },

    renderDashboard() {
        const availableBabaks = [...new Set(this.allSessions.map(s => s.babak.toUpperCase()))];
        const order = ["PENYISIHAN", "SEMIFINAL", "FINAL"];
        availableBabaks.sort((a, b) => {
            let idxA = order.indexOf(a); let idxB = order.indexOf(b);
            if(idxA === -1) idxA = 99; if(idxB === -1) idxB = 99;
            return idxA - idxB;
        });

        if (!availableBabaks.includes(this.activeBabakName)) {
            this.activeBabakName = availableBabaks[0] || '';
        }

        let tabsHtml = "";
        availableBabaks.forEach((babak) => {
            const activeClass = (this.activeBabakName === babak) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700';
            tabsHtml += `<button onclick="app.switchBabak('${babak}')" class="px-6 py-3 rounded-xl font-bold text-[10px] transition uppercase tracking-widest border ${activeClass}">${babak}</button>`;
        });
        document.getElementById('babak-tabs').innerHTML = tabsHtml;
        this.renderSessionCards(this.activeBabakName);
    },

    switchBabak(babakName) {
        this.activeBabakName = babakName;
        this.renderDashboard();
    },

    renderSessionCards(babak) {
        let html = "";
        const sesi = this.allSessions.filter(s => s.babak.toUpperCase() === babak);
        
        if (sesi.length === 0) {
            html = `<p class="col-span-full text-center text-slate-500 py-10 text-sm font-bold">Belum ada jadwal turnamen di babak ini.</p>`;
        } else {
            sesi.forEach(s => {
                let badge = s.isSelesai ? `<span class="bg-red-500/20 text-red-400 px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase">Terkunci</span>` : `<span class="bg-green-500/20 text-green-400 px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase">Terbuka</span>`;
                html += `
                <div onclick="app.showModalSesi('${encodeURIComponent(JSON.stringify(s))}')" class="bg-slate-800/60 p-6 rounded-3xl border border-white/5 cursor-pointer hover:bg-slate-800 hover:-translate-y-1 transition-all shadow-xl group relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full ${s.isSelesai ? 'bg-slate-600' : 'bg-blue-500'}"></div>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${s.babak}</span>
                        ${badge}
                    </div>
                    <h3 class="text-xl font-black text-white group-hover:text-blue-400 transition">${s.nama}</h3>
                    <p class="text-slate-500 text-[10px] mt-4 font-bold uppercase tracking-widest">${s.teams.length} REGU BERTANDING</p>
                </div>`;
            });
        }
        document.getElementById('session-list').innerHTML = html;
    },

    showModalSesi(encoded) {
        const s = JSON.parse(decodeURIComponent(encoded));
        document.getElementById('modal-title').innerText = s.nama;
        document.getElementById('modal-babak').innerText = s.babak;
        
        let tHtml = "";
        s.teams.forEach((t) => { 
            let infoSkor = "";
            if (s.isSelesai && t.skor !== undefined) {
                let warnaJuara = t.peringkat === 1 ? "text-yellow-400" : "text-slate-400";
                infoSkor = `<td class="py-2 text-right"><span class="text-xl font-black text-white block">${t.skor}</span><span class="text-[10px] font-bold ${warnaJuara} uppercase tracking-widest block">Juara ${t.peringkat}</span></td>`;
            } else { infoSkor = `<td class="py-2 text-right"></td>`; }

            tHtml += `<tr class="border-b border-slate-700/50"><td class="py-3 font-bold text-blue-400 text-xs w-20">REGU ${t.no}</td><td class="py-3 font-bold text-white text-sm">${t.nama}</td>${infoSkor}</tr>`; 
        });
        
        document.getElementById('modal-team-list').innerHTML = tHtml;
        
        const btnMulai = document.getElementById('btn-start-sesi');
        if (s.isSelesai) {
            btnMulai.innerText = "LIHAT SKOR";
            btnMulai.className = "flex-1 bg-slate-700 hover:bg-slate-600 font-bold py-3.5 rounded-xl transition text-slate-300";
        } else {
            btnMulai.innerText = "BUKA SESI";
            btnMulai.className = "flex-1 bg-blue-600 hover:bg-blue-500 font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition text-white";
        }

        btnMulai.onclick = () => { document.getElementById('modal-verify').classList.add('hidden'); app.openSesi(encoded); };
        document.getElementById('modal-verify').classList.remove('hidden');
    },

    async openSesi(encoded) {
        this.sesi = JSON.parse(decodeURIComponent(encoded));
        const local = localStorage.getItem(`lcc_v4_${this.sesi.id}`);
        let isCacheValid = false;

        if(local) {
            const d = JSON.parse(local);
            if(d.scores && d.scores.length === this.sesi.teams.length) {
                this.scores = d.scores; 
                this.historyText = d.historyText || [];
                this.isLocked = this.sesi.isSelesai ? d.isLocked : false; 
                isCacheValid = true;
            }
        }

        if(!isCacheValid) {
            this.scores = new Array(this.sesi.teams.length).fill(0);
            this.historyText = [`Sesi ${this.sesi.nama} dibuka.`];
            this.historyActions = []; 
            this.isLocked = this.sesi.isSelesai;
            localStorage.removeItem(`lcc_v4_${this.sesi.id}`); 
        }

        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-scoring').classList.remove('hidden');
        document.getElementById('sc-judul').innerText = this.sesi.nama;
        document.getElementById('sc-babak').innerText = this.sesi.babak;
        this.setTimer(0);
        
        if(this.role === 'VIEWER' || this.isLocked) { 
            document.getElementById('timer-controls').classList.add('hidden'); 
            document.getElementById('admin-controls').classList.add('hidden'); 
        } else {
            document.getElementById('timer-controls').classList.remove('hidden'); 
            document.getElementById('admin-controls').classList.remove('hidden'); 
        }

        this.renderGrid(); this.renderHistory();
        
        // Panggil data awal dari cloud
        await this.pullCloud();

        // Mulai interval tarik data berkala
        if(this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => this.pullCloud(), 3000);
    },

    renderGrid() {
        const grid = document.getElementById('team-grid');
        grid.className = "flex-1 p-4 flex flex-wrap justify-center content-start items-stretch gap-5 overflow-y-auto w-full max-w-7xl mx-auto";
        
        let html = `<style>
            #team-grid::-webkit-scrollbar { display: none; } 
            #team-grid { -ms-overflow-style: none; scrollbar-width: none; }
        </style>`;
        
        this.sesi.teams.forEach((t, i) => {
            const regu = t.no;
            html += `
            <div class="glass p-5 rounded-[28px] flex flex-col justify-between shadow-2xl relative overflow-hidden border-t border-white/10 w-full sm:w-[260px] lg:w-[280px] shrink-0 min-h-[310px]">
                <div class="text-center mb-4">
                    <span class="inline-block bg-slate-800 text-blue-400 font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-widest mb-3 border border-slate-700">REGU ${regu}</span>
                    <h4 class="text-sm font-black text-white leading-tight">${t.nama}</h4>
                </div>
                
                <div class="my-4 text-center">
                    <div class="text-7xl font-black text-white tracking-tighter drop-shadow-md">${this.scores[i]}</div>
                </div>

                ${this.role !== 'VIEWER' && !this.isLocked ? `
                <div class="mt-auto">
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <button onclick="app.updateScore(${i}, 100)" class="bg-[#16a34a] hover:bg-[#15803d] py-2.5 rounded-xl font-black text-sm text-white transition shadow-sm">+100</button>
                        <button onclick="app.updateScore(${i}, 50)" class="bg-[#2563eb] hover:bg-[#1d4ed8] py-2.5 rounded-xl font-black text-sm text-white transition shadow-sm">+50</button>
                        <button onclick="app.updateScore(${i}, -50)" class="bg-[#ea580c] hover:bg-[#c2410c] py-2.5 rounded-xl font-black text-sm text-white transition shadow-sm">-50</button>
                        <button onclick="app.updateScore(${i}, -100)" class="bg-[#dc2626] hover:bg-[#b91c1c] py-2.5 rounded-xl font-black text-sm text-white transition shadow-sm">-100</button>
                    </div>
                    <button onclick="app.setManualScore(${i})" class="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white transition border border-slate-600">📝 Set Manual</button>
                </div>` : ''}
            </div>`;
        });
        grid.innerHTML = html;
    },

    updateScore(idx, val) {
        if(this.isLocked) return;
        this.historyActions.push({idx, val}); this.scores[idx] += val;
        this.addHistory(`Regu ${this.sesi.teams[idx].no}: ${val > 0 ? '+' : ''}${val}`);
        this.renderGrid(); this.pushCloud();
    },

    setManualScore(idx) {
        if(this.isLocked) return;
        const current = this.scores[idx];
        const input = prompt(`Skor Baru Regu ${this.sesi.teams[idx].no}:`, current);
        if (input !== null && !isNaN(parseInt(input))) {
            const newScore = parseInt(input);
            this.historyActions.push({idx, val: newScore - current}); this.scores[idx] = newScore;
            this.addHistory(`Regu ${this.sesi.teams[idx].no}: Diubah Manual ke ${newScore}`);
            this.renderGrid(); this.pushCloud();
        }
    },

    undo() {
        if(this.historyActions.length === 0 || this.isLocked) return;
        const last = this.historyActions.pop(); this.scores[last.idx] -= last.val;
        this.addHistory(`Undo Aksi Regu ${this.sesi.teams[last.idx].no}`);
        this.renderGrid(); this.pushCloud();
    },

    resetSesi() {
        if(this.isLocked) return alert("Sesi sudah terkunci, tidak bisa di-reset!");
        if(confirm("⚠️ YAKIN INGIN MERESET? Semua skor akan kembali jadi 0 dan riwayat akan dibersihkan. Aksi ini tidak bisa dikembalikan!")) {
            this.scores = new Array(this.sesi.teams.length).fill(0);
            this.historyText = [`Sesi ${this.sesi.nama} di-reset ke 0.`];
            this.historyActions = [];
            this.renderGrid(); 
            this.renderHistory();
            this.pushCloud();
        }
    },

    playTick() {
        try {
            audioTick.currentTime = 0; 
            audioTick.play().catch(e => console.log("Menunggu interaksi pengguna"));
        } catch(e) {}
    },

    playBuzzer() {
        try {
            audioBuzzer.currentTime = 0; 
            audioBuzzer.play().catch(e => console.log("Menunggu interaksi pengguna"));
        } catch(e) {}
    },

    setTimer(sec) { this.stopTimer(); this.timerValue = parseInt(sec) || 0; this.updateTimerDisplay(); },
    
    updateTimerDisplay() { 
        const display = document.getElementById('time');
        display.innerText = this.timerValue.toString().padStart(2, '0');
        display.className = `text-5xl font-mono font-black tracking-tighter w-16 text-center transition-colors ${this.timerValue <= 3 && this.timerValue > 0 ? 'text-red-500' : 'text-blue-500'}`;
    },
    
    startTimer() {
        if(this.timerValue <= 0) return;
        this.stopTimer();
        
        this.playTick();

        this.timerInterval = setInterval(() => {
            this.timerValue--; 
            this.updateTimerDisplay();
            
            if(this.timerValue > 0) {
                this.playTick(); 
            }

            if(this.timerValue <= 0) { 
                this.stopTimer(); 
                this.playBuzzer(); 
                setTimeout(() => alert('WAKTU HABIS!'), 500); 
            }
        }, 1000);
    },
    
    stopTimer() { 
        clearInterval(this.timerInterval); 
        try {
            audioTick.pause();       
            audioTick.currentTime = 0; 
        } catch(e) {}
    },

    addHistory(txt) {
        const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        this.historyText.unshift(`<span class="text-blue-400 font-mono">[${now}]</span> ${txt}`);
        this.renderHistory();
    },
    
    renderHistory() { 
        const historyContainer = document.getElementById('history-log');
        historyContainer.innerHTML = this.historyText.map(t => `<div class="bg-slate-800/40 p-3 rounded-xl border border-white/5 text-[10px] font-bold text-slate-300 shadow-sm leading-tight inline-block whitespace-nowrap">${t}</div>`).join(''); 
    },

    // --- LOGIKA ANTI-GHOSTING ADA DI SINI ---
    async pushCloud() {
        this.lastPushTime = Date.now(); // Catat detiknya saat nge-klik skor
        const data = { scores: this.scores, historyText: this.historyText, isLocked: this.isLocked };
        localStorage.setItem(`lcc_v4_${this.sesi.id}`, JSON.stringify(data));
        
        // Kirim diam-diam tanpa nunggu balasan (Fire and forget)
        if(this.role !== 'VIEWER') fetch(API_URL, { method:'POST', body: JSON.stringify({action:'pushScore', id: this.sesi.id, ...data})});
    },

    async pullCloud() {
        // JIKA PANITIA BARU SAJA NGE-KLIK SKOR (KURANG DARI 5 DETIK YANG LALU), JANGAN TARIK DATA (Blokir ghosting)
        if (this.role !== 'VIEWER' && (Date.now() - this.lastPushTime < 5000)) return;

        try {
            const req = await fetch(API_URL, { method:'POST', body: JSON.stringify({action:'getScore', id: this.sesi.id})});
            const res = await req.json();
            
            // Cek lagi untuk menghindari tabrakan saat internet lambat
            if (this.role !== 'VIEWER' && (Date.now() - this.lastPushTime < 5000)) return;

            if(res.data && res.data.scores && res.data.scores.length === this.sesi.teams.length) { 
                this.scores = res.data.scores; 
                this.historyText = res.data.historyText; 
                this.isLocked = this.sesi.isSelesai ? res.data.isLocked : false; 
                this.renderGrid(); this.renderHistory(); 
            }
        } catch(e) {}
    },

    async lockSesi() {
        if(this.role === 'VIEWER') return;
        if(confirm("AKHIRI SESI? Skor final akan dikirim ke Spreadsheet dan Sesi dikunci!")) {
            this.isLocked = true;
            this.addHistory("🔒 SESI DIKUNCI PERMANEN");
            await this.pushCloud();
            alert("Sesi Berhasil Disimpan & Dikunci!");
            this.backToDashboard();
        }
    },

    backToDashboard() {
        this.stopTimer();
        if(this.syncInterval) clearInterval(this.syncInterval); // Matikan auto-refresh saat kembali
        document.getElementById('view-scoring').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        this.loadSessions(); 
    }
};

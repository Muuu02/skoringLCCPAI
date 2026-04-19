// GANTI URL INI DENGAN LINK DEPLOY APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbzMTcjr2-y7i_T6AccfIdfGjPYjB0I_7waWa6Xh_8pb8iGe4DozRlz9VZUdOL5D-6Akkg/exec";

const app = {
    role: '',
    user: '',
    allSessions: [],
    babakList: [],
    activeBabakIndex: 0,
    sesi: null,
    scores: [],
    historyText: [],
    historyActions: [],
    isLocked: false,
    timerValue: 0,
    timerInterval: null,

    async login() {
        const userInput = document.getElementById('user').value;
        const passInput = document.getElementById('pass').value;
        const btn = document.getElementById('btn-login');
        if(!userInput || !passInput) return alert("Isi Username dan Password!");

        btn.innerText = "MENYAMBUNGKAN...";
        try {
            const req = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', user: userInput, pass: passInput })});
            const res = await req.json();
            if(res.success) {
                this.role = res.role;
                this.user = res.name;
                this.showDashboard();
            } else {
                alert('Login Gagal! Akun tidak ditemukan.');
                btn.innerText = "MASUK SISTEM";
            }
        } catch (e) {
            alert('KONEKSI ERROR! Cek API_URL atau Akses Deployment.');
            btn.innerText = "MASUK SISTEM";
        }
    },

    logout() {
        if(confirm("Apakah Anda yakin ingin keluar?")) {
            this.role = ''; this.user = '';
            document.getElementById('view-dashboard').classList.add('hidden');
            document.getElementById('view-login').classList.remove('hidden');
            document.getElementById('pass').value = '';
        }
    },

    showDashboard() {
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('info-user').innerText = this.user || 'Guest Viewer';
        document.getElementById('info-role').innerText = this.role || 'VIEWER';
        
        // Tampilkan tombol tambah sesi hanya jika ADMIN/OPERATOR
        if(this.role !== 'VIEWER') {
            document.getElementById('admin-panel').classList.remove('hidden');
        } else {
            document.getElementById('admin-panel').classList.add('hidden');
        }

        this.loadSessions();
    },

    async loadSessions() {
        const list = document.getElementById('session-list');
        list.innerHTML = `<div class="col-span-full text-center p-10"><div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4 mx-auto"></div><p class="text-slate-500 font-bold italic text-sm">Menyinkronkan Excel...</p></div>`;
        try {
            const req = await fetch(API_URL, { method:'POST', body: JSON.stringify({action:'getSessions'})});
            const res = await req.json();
            this.allSessions = res.sessions;
            this.babakList = [...new Set(res.sessions.map(s => s.babak))];
            this.renderDashboard();
        } catch (e) { list.innerHTML = `<p class="text-red-500 col-span-full text-center font-bold">Koneksi Database Terputus.</p>`; }
    },

    renderDashboard() {
        let tabsHtml = "";
        let isPreviousBabakDone = true;
        this.babakList.forEach((babak, index) => {
            let sesiDiBabakIni = this.allSessions.filter(s => s.babak === babak);
            let isThisBabakDone = sesiDiBabakIni.every(s => s.isSelesai);
            let isLocked = !isPreviousBabakDone && this.role === 'VIEWER';
            let activeClass = (this.activeBabakIndex === index) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700';
            tabsHtml += `<button onclick="app.switchBabak(${index}, ${isLocked})" class="px-6 py-3 rounded-t-2xl font-bold text-[10px] transition uppercase tracking-widest ${activeClass}">${isLocked ? '🔒 ' : ''}${babak}</button>`;
            isPreviousBabakDone = isThisBabakDone;
        });
        document.getElementById('babak-tabs').innerHTML = tabsHtml;

        let html = "";
        this.allSessions.filter(s => s.babak === this.babakList[this.activeBabakIndex]).forEach(s => {
            let statusBadge = s.isSelesai ? `<span class="text-[9px] font-black text-red-100 bg-red-600 px-2 py-0.5 rounded-md ml-2">SELESAI</span>` : '';
            let border = s.isSelesai ? 'border-slate-700 opacity-60' : 'border-blue-500';
            html += `
            <div onclick="app.showModalSesi('${encodeURIComponent(JSON.stringify(s))}')" class="glass p-6 rounded-[32px] border-l-4 ${border} cursor-pointer hover:bg-slate-800 transition-all shadow-xl group">
                <div class="flex justify-between items-start"><span class="text-[9px] font-bold text-blue-400 bg-blue-900/30 px-3 py-1 rounded-full uppercase">${s.babak}</span>${statusBadge}</div>
                <h3 class="text-lg font-black mt-4 group-hover:text-blue-400 transition leading-tight">${s.nama}</h3>
            </div>`;
        });
        document.getElementById('session-list').innerHTML = html || `<p class="col-span-full text-center text-slate-500 py-10">Belum ada sesi.</p>`;
    },

    switchBabak(index, isLocked) {
        if(isLocked) alert("Babak ini belum dibuka.");
        else { this.activeBabakIndex = index; this.renderDashboard(); }
    },

    showModalSesi(encoded) {
        const s = JSON.parse(decodeURIComponent(encoded));
        document.getElementById('modal-title').innerText = s.nama;
        document.getElementById('modal-babak').innerText = s.babak;
        let teamHtml = "";
        s.teams.forEach((t, i) => { teamHtml += `<tr class="border-b border-slate-700/50"><td class="py-3 font-bold text-blue-400">Regu ${['A','B','C','D','E','F'][i]}</td><td class="py-3 font-bold">${t.nama} <span class="text-[10px] text-slate-500 block font-normal">${t.no}</span></td></tr>`; });
        document.getElementById('modal-team-list').innerHTML = teamHtml;
        const btnMulai = document.getElementById('btn-start-sesi');
        btnMulai.onclick = () => { document.getElementById('modal-verify').classList.add('hidden'); app.openSesi(encoded); };
        document.getElementById('modal-verify').classList.remove('hidden');
    },

    async openSesi(encoded) {
        this.sesi = JSON.parse(decodeURIComponent(encoded));
        const localData = localStorage.getItem(`lcc_v4_${this.sesi.id}`);
        if(localData) {
            const d = JSON.parse(localData);
            this.scores = d.scores; this.historyText = d.historyText; this.isLocked = d.isLocked;
        } else {
            this.scores = new Array(this.sesi.teams.length).fill(0);
            this.historyText = [`Sesi ${this.sesi.nama} dimulai.`];
            this.historyActions = []; this.isLocked = false;
        }
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-scoring').classList.remove('hidden');
        document.getElementById('sc-judul').innerText = this.sesi.nama;
        document.getElementById('sc-babak').innerText = this.sesi.babak;
        this.setTimer(0);
        if(this.role === 'VIEWER') { document.getElementById('timer-controls').classList.add('hidden'); document.getElementById('admin-controls').classList.add('hidden'); }
        this.renderGrid(); this.renderHistory();
        await this.pullCloud();
        if (this.role === 'VIEWER') setInterval(() => this.pullCloud(), 3000);
    },

    renderGrid() {
        const grid = document.getElementById('team-grid');
        const cols = this.sesi.teams.length > 4 ? 'md:grid-cols-5' : 'md:grid-cols-4';
        grid.className = `flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 ${cols} gap-4 overflow-y-auto content-start`;
        let html = "";
        this.sesi.teams.forEach((t, i) => {
            const regu = ['A','B','C','D','E','F'][i];
            html += `
            <div class="glass p-5 rounded-3xl flex flex-col justify-between shadow-xl">
                <div class="text-center mb-2"><span class="text-slate-500 font-bold text-[9px] uppercase tracking-widest">REGU ${regu}</span><h4 class="text-xs font-black text-white mt-1 leading-tight h-8 overflow-hidden">${t.nama}</h4></div>
                <div class="my-4 text-center"><div class="text-5xl font-black text-white tracking-tighter">${this.scores[i]}</div></div>
                ${this.role !== 'VIEWER' && !this.isLocked ? `
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <button onclick="app.updateScore(${i}, 100)" class="bg-green-600 hover:bg-green-500 py-2 rounded-xl font-black text-xs text-white">+100</button>
                    <button onclick="app.updateScore(${i}, 50)" class="bg-blue-600 hover:bg-blue-500 py-2 rounded-xl font-black text-xs text-white">+50</button>
                    <button onclick="app.updateScore(${i}, -50)" class="bg-orange-600 hover:bg-orange-500 py-2 rounded-xl font-black text-xs text-white">-50</button>
                    <button onclick="app.updateScore(${i}, -100)" class="bg-red-600 hover:bg-red-500 py-2 rounded-xl font-black text-xs text-white">-100</button>
                    <button onclick="app.setManualScore(${i})" class="col-span-2 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl font-bold text-[9px] uppercase text-white">Manual</button>
                </div>` : ''}
            </div>`;
        });
        grid.innerHTML = html;
    },

    updateScore(idx, val) {
        if(this.isLocked) return;
        this.historyActions.push({idx, val});
        this.scores[idx] += val;
        this.addHistory(`Regu ${['A','B','C','D','E','F'][idx]}: ${val > 0 ? '+' : ''}${val}`);
        this.renderGrid(); this.pushCloud();
    },

    setManualScore(idx) {
        if(this.isLocked) return;
        const current = this.scores[idx];
        const input = prompt(`Skor Baru Regu ${['A','B','C','D','E','F'][idx]}:`, current);
        if (input !== null && !isNaN(parseInt(input))) {
            const newScore = parseInt(input);
            this.historyActions.push({idx, val: newScore - current});
            this.scores[idx] = newScore;
            this.addHistory(`Regu ${['A','B','C','D','E','F'][idx]}: Manual ${newScore}`);
            this.renderGrid(); this.pushCloud();
        }
    },

    undo() {
        if(this.historyActions.length === 0 || this.isLocked) return;
        const last = this.historyActions.pop();
        this.scores[last.idx] -= last.val;
        this.addHistory(`Undo Aksi Regu ${['A','B','C','D','E','F'][last.idx]}`);
        this.renderGrid(); this.pushCloud();
    },

    setTimer(sec) { this.stopTimer(); this.timerValue = parseInt(sec) || 0; this.updateTimerDisplay(); },
    updateTimerDisplay() { 
        const display = document.getElementById('time');
        display.innerText = this.timerValue.toString().padStart(2, '0');
        display.classList.toggle('text-red-500', this.timerValue <= 3 && this.timerValue > 0);
    },
    startTimer() {
        if(this.timerValue <= 0) return;
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.timerValue--; this.updateTimerDisplay();
            if(this.timerValue <= 0) { this.stopTimer(); alert('WAKTU HABIS!'); }
        }, 1000);
    },
    stopTimer() { clearInterval(this.timerInterval); },

    addHistory(txt) {
        const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
        this.historyText.unshift(`[${now}] ${txt}`);
        this.renderHistory();
    },

    renderHistory() { document.getElementById('history-log').innerHTML = this.historyText.map(t => `<div class="bg-slate-800/50 p-2 rounded-lg border-l-2 border-blue-500 text-[10px]">${t}</div>`).join(''); },

    async pushCloud() {
        const data = { scores: this.scores, historyText: this.historyText, isLocked: this.isLocked };
        localStorage.setItem(`lcc_v4_${this.sesi.id}`, JSON.stringify(data));
        if(this.role !== 'VIEWER') fetch(API_URL, { method:'POST', body: JSON.stringify({action:'pushScore', id: this.sesi.id, ...data})});
    },

    async pullCloud() {
        try {
            const res = await (await fetch(API_URL, { method:'POST', body: JSON.stringify({action:'getScore', id: this.sesi.id})})).json();
            if(res.data) { this.scores = res.data.scores; this.historyText = res.data.historyText; this.isLocked = res.data.isLocked; this.renderGrid(); this.renderHistory(); }
        } catch(e) {}
    },

    async lockSesi() {
        if(this.role === 'VIEWER') return;
        if(confirm("TUTUP SESI? Skor akan dikunci dan Anda kembali ke Dashboard.")) {
            this.isLocked = true;
            this.addHistory("🔒 SESI SELESAI");
            await this.pushCloud();
            alert("Data Berhasil Dikunci!");
            this.backToDashboard(); // FITUR AUTO KEMBALI
        }
    },

    backToDashboard() {
        this.stopTimer();
        document.getElementById('view-scoring').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        this.loadSessions();
    }
};

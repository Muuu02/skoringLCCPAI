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
    timer: null,

    async login() {
        const userInput = document.getElementById('user').value;
        const passInput = document.getElementById('pass').value;
        const btn = document.getElementById('btn-login');
        
        btn.innerText = "MEMPROSES...";
        
        try {
            // Meminta validasi ke Google Apps Script
            const req = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: 'login', user: userInput, pass: passInput })
            });
            const res = await req.json();
            
            if(res.success) {
                this.role = res.role;
                this.user = res.name;
                this.showDashboard();
            } else {
                alert('Login Gagal! Password salah atau tidak ditemukan di Database.');
                btn.innerText = "MASUK SISTEM";
            }
        } catch (e) {
            alert('KONEKSI ERROR! \nPastikan API_URL benar dan Akses Google Script sudah di-set ke "Anyone".');
            btn.innerText = "MASUK SISTEM";
            console.error(e);
        }
    },

    showDashboard() {
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('info-user').innerText = this.user || 'Guest Viewer';
        document.getElementById('info-role').innerText = this.role || 'VIEWER';
        this.loadSessions();
    },

    async loadSessions() {
        const list = document.getElementById('session-list');
        list.innerHTML = `<div class="col-span-full text-center p-10"><div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4 mx-auto"></div><p class="text-slate-500 font-bold italic">Menghubungkan ke Excel...</p></div>`;
        
        try {
            const req = await fetch(API_URL, { method:'POST', body: JSON.stringify({action:'getSessions'})});
            const res = await req.json();
            this.allSessions = res.sessions;
            this.babakList = [...new Set(res.sessions.map(s => s.babak))];
            this.renderDashboard();
        } catch (e) { 
            list.innerHTML = `<p class="text-red-500 col-span-full text-center font-bold">Gagal memuat data dari Excel. <br> Cek koneksi internet dan API_URL.</p>`; 
        }
    },

    renderDashboard() {
        let tabsHtml = "";
        let isPreviousBabakDone = true;

        this.babakList.forEach((babak, index) => {
            let sesiDiBabakIni = this.allSessions.filter(s => s.babak === babak);
            let isThisBabakDone = sesiDiBabakIni.every(s => s.isSelesai);
            let isLocked = !isPreviousBabakDone && this.role !== 'VIEWER';
            let activeClass = (this.activeBabakIndex === index) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700';
            
            tabsHtml += `<button onclick="app.switchBabak(${index}, ${isLocked})" class="px-6 py-3 rounded-t-2xl font-bold text-xs transition uppercase tracking-widest ${activeClass}">
                ${isLocked ? '🔒 ' : ''}${babak}
            </button>`;
            isPreviousBabakDone = isThisBabakDone;
        });
        document.getElementById('babak-tabs').innerHTML = tabsHtml;

        let html = "";
        let sesiToRender = this.allSessions.filter(s => s.babak === this.babakList[this.activeBabakIndex]);
        
        sesiToRender.forEach(s => {
            let statusBadge = s.isSelesai ? `<span class="text-[9px] font-black text-red-100 bg-red-600 px-2 py-0.5 rounded-md ml-2">DONE</span>` : '';
            let border = s.isSelesai ? 'border-slate-700 opacity-60' : 'border-blue-500';

            html += `
            <div onclick="app.showModalSesi('${encodeURIComponent(JSON.stringify(s))}')" class="glass p-6 rounded-[32px] border-l-4 ${border} cursor-pointer hover:bg-slate-800 transition-all hover:-translate-y-1 shadow-xl group">
                <div class="flex justify-between items-start">
                    <span class="text-[10px] font-bold text-blue-400 bg-blue-900/30 px-3 py-1 rounded-full uppercase">${s.babak}</span>
                    ${statusBadge}
                </div>
                <h3 class="text-xl font-black mt-4 group-hover:text-blue-400 transition">${s.nama}</h3>
                <p class="mt-2 text-slate-500 text-xs font-bold">${s.teams.length} Grup Terdaftar</p>
            </div>`;
        });
        document.getElementById('session-list').innerHTML = html || `<p class="col-span-full text-center text-slate-500 py-10">Belum ada sesi di babak ini.</p>`;
    },

    switchBabak(index, isLocked) {
        if(isLocked) {
            if(confirm("Babak sebelumnya belum selesai semua. Buka paksa babak ini?")) {
                this.activeBabakIndex = index; this.renderDashboard();
            }
        } else { this.activeBabakIndex = index; this.renderDashboard(); }
    },

    showModalSesi(encoded) {
        const s = JSON.parse(decodeURIComponent(encoded));
        document.getElementById('modal-title').innerText = s.nama;
        document.getElementById('modal-babak').innerText = s.babak;
        
        let teamHtml = "";
        s.teams.forEach((t, i) => {
            teamHtml += `<tr class="border-b border-slate-700/50 text-xs">
                <td class="py-3 font-bold text-blue-400">Regu ${['A','B','C','D','E','F'][i]}</td>
                <td class="py-3">${t.no}</td>
                <td class="py-3 font-bold">${t.nama} <br><span class="text-[10px] text-slate-500 font-normal">Kec. ${t.kec}</span></td>
            </tr>`;
        });
        document.getElementById('modal-team-list').innerHTML = teamHtml;
        
        const btnMulai = document.getElementById('btn-start-sesi');
        btnMulai.onclick = () => {
            document.getElementById('modal-verify').classList.add('hidden');
            app.openSesi(encoded);
        };
        document.getElementById('modal-verify').classList.remove('hidden');
    },

    async openSesi(encoded) {
        this.sesi = JSON.parse(decodeURIComponent(encoded));
        
        const localData = localStorage.getItem(`lcc_v4_${this.sesi.id}`);
        if(localData) {
            const d = JSON.parse(localData);
            this.scores = d.scores || new Array(this.sesi.teams.length).fill(0);
            this.historyText = d.historyText || ["Sesi dilanjutkan..."];
            this.historyActions = d.historyActions || [];
            this.isLocked = d.isLocked || false;
        } else {
            this.scores = new Array(this.sesi.teams.length).fill(0);
            this.historyText = ["Sesi siap dimulai."];
            this.historyActions = []; this.isLocked = false;
        }
        
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-scoring').classList.remove('hidden');
        document.getElementById('sc-judul').innerText = this.sesi.nama;
        document.getElementById('sc-babak').innerText = this.sesi.babak;

        if(this.role === 'VIEWER') {
            document.getElementById('timer-controls').classList.add('hidden');
            document.getElementById('admin-controls').classList.add('hidden');
        }

        this.renderGrid();
        this.renderHistory();
        await this.pullCloud();

        if (this.role === 'VIEWER') {
            setInterval(() => this.pullCloud(), 3000);
        }
    },

    renderGrid() {
        const grid = document.getElementById('team-grid');
        const cols = this.sesi.teams.length > 4 ? 'md:grid-cols-3' : 'md:grid-cols-2';
        grid.className = `flex-1 p-6 grid grid-cols-1 ${cols} gap-4 overflow-y-auto content-start`;

        let html = "";
        this.sesi.teams.forEach((t, i) => {
            const regu = ['A','B','C','D','E','F'][i];
            const color = ['blue','yellow','green','red','purple','pink'][i];
            
            html += `
            <div class="glass p-6 rounded-[32px] border-b-4 border-${color}-500 flex flex-col justify-between shadow-xl">
                <div class="flex justify-between items-start">
                    <span class="bg-${color}-600 text-white text-[10px] font-black px-3 py-1 rounded-full">REGU ${regu}</span>
                    <span class="text-slate-500 font-bold text-[10px]">${t.no}</span>
                </div>
                <h4 class="text-lg font-black mt-3 leading-tight h-12 overflow-hidden">${t.nama}</h4>
                
                <div class="my-6 text-center">
                    <div id="score-${i}" class="text-6xl font-black text-white tracking-tighter">${this.scores[i]}</div>
                </div>

                ${this.role === 'ADMIN' && !this.isLocked ? `
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="app.updateScore(${i}, 100)" class="bg-green-600 hover:bg-green-500 py-3 rounded-xl font-black text-sm">+100</button>
                    <button onclick="app.updateScore(${i}, -100)" class="bg-red-600 hover:bg-red-500 py-3 rounded-xl font-black text-sm">-100</button>
                    <button onclick="app.updateScore(${i}, 50)" class="bg-green-900/50 hover:bg-green-800 py-2 rounded-xl font-bold text-xs">+50</button>
                    <button onclick="app.updateScore(${i}, -50)" class="bg-red-900/50 hover:bg-red-800 py-2 rounded-xl font-bold text-xs">-50</button>
                </div>` : ''}
            </div>`;
        });
        grid.innerHTML = html;
    },

    updateScore(idx, val) {
        if(this.isLocked) return;
        const regu = ['A','B','C','D','E','F'][idx];
        this.historyActions.push({idx, val});
        this.scores[idx] += val;
        this.addHistory(`Regu ${regu}: ${val > 0 ? '+' : ''}${val} poin`);
        this.renderGrid();
        this.pushCloud();
    },

    undo() {
        if(this.historyActions.length === 0 || this.isLocked) return;
        const last = this.historyActions.pop();
        this.scores[last.idx] -= last.val;
        this.addHistory(`Undo: Nilai Regu ${['A','B','C','D','E','F'][last.idx]} dikembalikan`);
        this.renderGrid();
        this.pushCloud();
    },

    startTimer(sec) {
        clearInterval(this.timer);
        let current = sec;
        const display = document.getElementById('time');
        display.classList.remove('text-red-500');
        display.innerText = current.toString().padStart(2, '0');
        
        this.timer = setInterval(() => {
            current--;
            display.innerText = current.toString().padStart(2, '0');
            if(current <= 3) display.classList.add('text-red-500');
            if(current <= 0) { clearInterval(this.timer); alert('WAKTU HABIS!'); }
        }, 1000);
    },

    addHistory(txt) {
        const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        this.historyText.unshift(`[${now}] ${txt}`);
        this.renderHistory();
    },

    renderHistory() {
        document.getElementById('history-log').innerHTML = this.historyText.map(t => `<div class="bg-slate-800/50 p-2 rounded-lg border-l-2 border-blue-500">${t}</div>`).join('');
    },

    async pushCloud() {
        const data = { scores: this.scores, historyText: this.historyText, isLocked: this.isLocked };
        localStorage.setItem(`lcc_v4_${this.sesi.id}`, JSON.stringify(data));
        if(this.role === 'ADMIN') {
            fetch(API_URL, { method:'POST', body: JSON.stringify({action:'pushScore', id: this.sesi.id, ...data})});
        }
    },

    async pullCloud() {
        try {
            const res = await (await fetch(API_URL, { method:'POST', body: JSON.stringify({action:'getScore', id: this.sesi.id})})).json();
            if(res.data) {
                this.scores = res.data.scores;
                this.historyText = res.data.historyText;
                this.isLocked = res.data.isLocked;
                this.renderGrid(); this.renderHistory();
            }
        } catch(e) {}
    },

    async lockSesi() {
        if(confirm("Akhiri sesi ini? Data akan dikunci dan dikirim ke Excel.")) {
            this.isLocked = true;
            this.addHistory("SESI BERAKHIR & DIKUNCI");
            await this.pushCloud();
            this.renderGrid();
        }
    },

    backToDashboard() {
        if(this.timer) clearInterval(this.timer);
        document.getElementById('view-scoring').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        this.loadSessions();
    }
};

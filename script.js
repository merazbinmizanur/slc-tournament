// ==========================================================
// SLC BOUNTY HUNTER - TOURNAMENT OPERATING SYSTEM (PRO)
// Developer: Meraz Bin Mizanur
// Version: 3.0.1 (Stable Build - Data Integrity & Footer Patch)
// ==========================================================

// --- 1. CONFIGURATION & INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBgsxm8JyD0n_e72OvVuqpVzclH54SehIo",
    authDomain: "slc-tournament.firebaseapp.com",
    projectId: "slc-tournament",
    storageBucket: "slc-tournament.firebasestorage.app",
    messagingSenderId: "796061303147",
    appId: "1:796061303147:web:8829bb997bcc1800b2cc2e",
    measurementId: "G-CP6ZS55Y05"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- CONSTANTS ---
const ADMIN_KEY = "SLCADMIN2026";
const P2_LIMIT_HIGH = 3;
const P2_LIMIT_STD = 2;
const STARTING_BOUNTY = 500;
// --- SHOP CONFIGURATION ---
const SHOP_ITEMS = {
    insurance: { 
        name: "INSURANCE", 
        price: 15, 
        icon: "shield", 
        desc: "Reduces point loss by 50% if you are defeated.",
        restriction: "Valid for 1 Match. Consumed on result.",
        color: "text-blue-400",
        border: "moving-border-blue"
    },
    decline_pass: { 
        name: "DECLINE PASS", 
        price: 30, 
        icon: "x-circle", 
        desc: "Allows you to decline a Phase 2 challenge without paying the 5% penalty.",
        restriction: "1 Time Use.",
        color: "text-rose-400",
        border: "moving-border-blue"
    },
    privacy: { 
        name: "PRIVACY", 
        price: 15, 
        icon: "eye-off", 
        desc: "Hides your Win/Loss history (dots) from rivals on the dashboard.",
        restriction: "Active for 1 Match duration.",
        color: "text-slate-400",
        border: "moving-border-emerald"
    },
    scout: { 
        name: "SCOUT", 
        price: 10, 
        icon: "search", 
        desc: "Reveal an opponent's hidden history before accepting a match.",
        restriction: "1 Time Use.",
        color: "text-emerald-400",
        border: "moving-border-emerald"
    },
    multiplier: { 
        name: "MULTIPLIER", 
        price: 40, 
        icon: "zap", 
        desc: "Doubles your BP gain (2x) if you win the next match.",
        restriction: "1 Match Only. High Risk.",
        color: "text-gold-500",
        border: "moving-border-gold"
    },
    vault_access: { 
        name: "THE VAULT", 
        price: 20, 
        icon: "lock", 
        desc: "Secure storage facility. Lock up to 25% of your BP safely.",
        restriction: "Funds locked for 4 Days.",
        color: "text-gold-500",
        border: "moving-border-gold"
    }
};


// --- STATE MANAGEMENT ---
let state = { 
    players: [], 
    matches: [], 
    activePhase: 1, 
    isAdmin: false, 
    viewingDate: "",
    activeMatchId: null,
    brokerSubTab: 'hunts',
    bulkMode: false,
    selectedMatches: new Set()
};
let confirmCallback = null;

// --- 2. CORE UTILITY ENGINES ---

/**
 * Avatar Generator Engine
 * Returns HTML for Image if available, otherwise Initials
 */
function getAvatarUI(p, w="w-8", h="h-8", text="text-xs") {
    // Safety check: If player data is missing, return empty circle
    if (!p) return `<div class="${w} ${h} rounded-full bg-slate-800 border border-white/5"></div>`;
    
    // Get first letter of name
    const initial = (p.name || "U").charAt(0).toUpperCase();
    
    // 1. If avatar link exists, return Image with Error Fallback
    if (p.avatar) {
        return `
        <div class="${w} ${h} relative flex-shrink-0">
            <img src="${p.avatar}" class="w-full h-full rounded-full object-cover border border-white/10 bg-slate-800" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="${w} ${h} rounded-full bg-slate-800 flex items-center justify-center ${text} font-black text-white border border-white/10 hidden absolute inset-0">${initial}</div>
        </div>`;
    }
    
    // 2. If no link, return Initials Circle
    return `<div class="${w} ${h} rounded-full bg-slate-800 flex items-center justify-center ${text} font-black text-white border border-white/10 flex-shrink-0">${initial}</div>`;
}

/**
 * Custom Notification Toast
 */
function notify(message, iconName = 'info') {
    const toast = document.getElementById('custom-toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    
    msgEl.innerText = message;
    if (typeof lucide !== 'undefined') {
        iconEl.setAttribute('data-lucide', iconName);
        lucide.createIcons();
    }
    
    toast.classList.remove('hidden');
    toast.classList.add('animate-pop-in');
    
    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('animate-pop-in');
    }, 3500);
}

/**
 * Custom Confirmation Modal
 */
function askConfirm(message, callback) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-message').innerText = message;
    modal.classList.remove('hidden');
    confirmCallback = callback;
}

document.getElementById('confirm-ok').onclick = () => {
    document.getElementById('modal-confirm').classList.add('hidden');
    if (confirmCallback) confirmCallback();
};

document.getElementById('confirm-cancel').onclick = () => {
    document.getElementById('modal-confirm').classList.add('hidden');
    confirmCallback = null;
};

/**
 * Dynamic Ranking Engine
 */
function getRankInfo(bounty) {
    if (bounty >= 1001) return { name: 'LEGEND', color: 'text-gold-500', bg: 'bg-gold-500/10' };
    if (bounty >= 801)  return { name: 'ELITE', color: 'text-blue-400', bg: 'bg-blue-400/10' };
    if (bounty >= 700)  return { name: 'APEX', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    if (bounty >= 500)  return { name: 'RECRUIT', color: 'text-slate-400', bg: 'bg-slate-400/10' };
    return { name: 'NOVICE', color: 'text-rose-500', bg: 'bg-rose-500/10' };
}
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        notify("ID Copied to Clipboard!", "copy");
    }).catch(err => {
        console.error('Async: Could not copy text: ', err);
        notify("Copy Failed", "x-circle");
    });
}
// --- 3. AUTHENTICATION & SESSIONS ---

function switchAuthTab(type) {
    const regForm = document.getElementById('reg-form');
    const loginForm = document.getElementById('login-form');
    const btnReg = document.getElementById('btn-tab-reg');
    const btnLogin = document.getElementById('btn-tab-login');
    if (type === 'reg') {
        regForm.classList.remove('hidden'); 
        loginForm.classList.add('hidden');
        btnReg.className = "flex-1 py-2 text-[10px] font-black uppercase rounded-lg bg-emerald-600 text-white transition-all";
        btnLogin.className = "flex-1 py-2 text-[10px] font-black uppercase rounded-lg text-slate-500 transition-all";
    } else {
        regForm.classList.add('hidden'); 
        loginForm.classList.remove('hidden');
        btnLogin.className = "flex-1 py-2 text-[10px] font-black uppercase rounded-lg bg-blue-600 text-white transition-all";
        btnReg.className = "flex-1 py-2 text-[10px] font-black uppercase rounded-lg text-slate-500 transition-all";
    }
}

async function registerPlayerOnline() {
    // --- START UPDATE: CHECK LOCK STATUS ---
    try {
        const settingsDoc = await db.collection("settings").doc("global").get();
        // If the document exists and registrationLocked is true, stop here.
        if (settingsDoc.exists && settingsDoc.data().registrationLocked) {
            return notify("REGISTRATION CLOSED: SEASON ACTIVE", "lock");
        }
    } catch (e) {
        console.error("Error checking tournament lock:", e);
    }
    // --- END UPDATE ---

    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    // NEW: Get the Avatar Link
    const avatar = document.getElementById('reg-avatar').value.trim();

    if (!name || !phone) return notify("Name & Phone required", "alert-circle");
    
    const r = () => Math.floor(Math.random() * 90 + 10);
    const uniqueID = `S${r()}L${r()}C${r()}`;
    
    const newP = { 
        id: uniqueID, 
        name: name, 
        phone: phone, 
        avatar: avatar, // SAVE TO DATABASE
        bounty: STARTING_BOUNTY, 
        mp: 0, wins: 0, draws: 0, losses: 0, 
        p2High: 0, p2Std: 0 
    };

    try {
        await db.collection("players").doc(uniqueID).set(newP);
        localStorage.setItem('slc_user_id', uniqueID);
        notify(`ID: ${uniqueID} Registered!`, "check-circle");
        setTimeout(() => location.reload(), 2000);
    } catch (e) {
        notify("Database error", "x-circle");
    }
}



async function loginWithID() {
    const id = document.getElementById('login-id').value.trim().toUpperCase();
    if (!id) return notify("Enter SLC-ID", "alert-triangle");
    
    try {
        const doc = await db.collection("players").doc(id).get();
        if (doc.exists) {
            localStorage.setItem('slc_user_id', id);
            notify("Identity Verified!", "unlock");
            setTimeout(() => location.reload(), 1000);
        } else {
            notify("ID not found in system!", "x-octagon");
        }
    } catch (e) {
        notify("Connection Error", "wifi-off");
    }
}

function loginAsAdmin() {
    const input = document.getElementById('admin-secret-input').value;
    if (input === ADMIN_KEY) {
        localStorage.setItem('slc_admin', 'true');
        notify("Command Center Unlocked!", "shield-check");
        setTimeout(() => location.reload(), 1000);
    } else {
        notify("Access Denied: Invalid Key", "lock");
    }
}

function checkSession() {
    const id = localStorage.getItem('slc_user_id');
    const adm = localStorage.getItem('slc_admin');
    
    if (adm === 'true') {
        state.isAdmin = true;
        enterApp('Admin');
    } else if (id) {
        enterApp(id);
    }
}

function enterApp(identity) {
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-container');
    
    // Hide Auth
    if(auth) auth.classList.add('hidden');
    
    // Show App (Block is fine since we are using fixed internals)
    if(app) {
        app.classList.remove('hidden');
        // We remove 'flex' just in case, to let the fixed positioning take over
        app.classList.remove('flex', 'flex-col'); 
        app.classList.add('block');
    }

    const badge = document.getElementById('user-id-badge');
    if(badge) {
        const idText = identity ? identity.toString() : "UNKNOWN";
        badge.innerText = state.isAdmin ? "MASTER ADMIN" : `SLC-ID: ${idText}`;
    }
    
    document.querySelectorAll('.admin-tool').forEach(el => {
        el.classList.toggle('hidden', !state.isAdmin);
    });
    
    listenToCloud();
}



// --- 4. REAL-TIME DATA SYNC ---

function listenToCloud() {
    db.collection("players").onSnapshot(snapshot => {
        state.players = snapshot.docs.map(doc => doc.data());
        refreshUI();
    });
    db.collection("matches").onSnapshot(snapshot => {
        state.matches = snapshot.docs.map(doc => doc.data());
        refreshUI();
    });
    db.collection("settings").doc("global").onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            state.viewingDate = data.activeDate;
            state.phase3UnlockTime = data.phase3UnlockTime || null;
            // [NEW] Capture Sponsor Message
            state.sponsorMessage = data.sponsorMessage || ""; 
            refreshUI();
        }
    });
    checkTournamentWinner();
}



function refreshUI() {
    const rawID = localStorage.getItem('slc_user_id') || "";
    const myID = rawID.toUpperCase();
    const myPlayer = state.players.find(p => p?.id && p.id.toUpperCase() === myID);
    
    const userBountyEl = document.getElementById('user-bounty-display');
    if (userBountyEl) {
        if (state.isAdmin) {
            userBountyEl.innerText = "ADMIN MODE";
        } else if (myPlayer) {
            userBountyEl.innerText = `${(Number(myPlayer.bounty) || 0).toLocaleString()} BP`;
        }
    }
    
    const totalBP = state.players.reduce((sum, p) => sum + (Number(p?.bounty) || 0), 0);
    const poolEl = document.getElementById('total-pool-display');
    if (poolEl) poolEl.innerText = `POOL: ${totalBP.toLocaleString()} BP`;
    
    checkPhaseLocks();
    
    try {
        renderLeaderboard();
        renderShop();
        checkVaultStatus();
        renderSchedule();
        renderEliteBracket();
        renderBrokerBoard(); 
        renderPlayerDashboard();
        renderNewsTicker();
    } catch (err) {
        console.error("UI Render Error:", err);
    }
}

// [UPDATED] checkPhaseLocks: Handles Phase 3 Countdown & Professional Text
let p3Interval = null; // Variable to hold the timer reference

function checkPhaseLocks() {
    const p1Matches = state.matches.filter(m => m.phase === 1);
    const p1Done = p1Matches.length > 0 && p1Matches.every(m => m.status === 'played');
    
    // Check Top 8 Status
    const ranked = [...state.players].sort((a, b) => b.bounty - a.bounty);
    const top8 = ranked.slice(0, 8);
    const top8Done = top8.length > 0 && top8.every(p => ((p.p2High || 0) + (p.p2Std || 0)) >= 5);
    
    // Phase 1 Logic
    if (p1Done && state.activePhase < 2) state.activePhase = 2;

    // --- PHASE 3 COUNTDOWN LOGIC ---
    let isP3Ready = false;
    const now = Date.now();
    const unlockTime = state.phase3UnlockTime ? new Date(state.phase3UnlockTime).getTime() : null;

    // Determine if Phase 3 should be open (Time passed OR Top 8 done)
    if (p1Done && (top8Done || (unlockTime && now >= unlockTime))) {
        state.activePhase = 3;
        isP3Ready = true;
    }

    // Update Phase Indicator Badge
    const indicator = document.getElementById('phase-indicator');
    if (indicator) indicator.innerText = `Phase ${state.activePhase}`;
    
    // Toggle Visibility
    const showP2Lock = !state.isAdmin && state.activePhase < 2;
    const showP3Lock = !state.isAdmin && state.activePhase < 3;
    
    const p2Lock = document.getElementById('p2-lock-screen');
    const p2Content = document.getElementById('p2-main-content');
    if (p2Lock) p2Lock.classList.toggle('hidden', !showP2Lock);
    if (p2Content) p2Content.classList.toggle('hidden', showP2Lock);
    
    const p3Lock = document.getElementById('p3-lock-screen');
    const p3Content = document.getElementById('p3-main-content');
    if (p3Lock) p3Lock.classList.toggle('hidden', !showP3Lock);
    if (p3Content) p3Content.classList.toggle('hidden', showP3Lock);

    // --- COUNTDOWN RENDERER ---
    const p3MsgBox = document.getElementById('p3-lock-message');
    
    if (showP3Lock && p3MsgBox) {
        // Clear previous interval to prevent duplicates
        if (p3Interval) clearInterval(p3Interval);

        if (unlockTime && now < unlockTime) {
            // Start the countdown
            p3Interval = setInterval(() => {
                const currentNow = Date.now();
                const diff = unlockTime - currentNow;

                if (diff <= 0) {
                    clearInterval(p3Interval);
                    checkPhaseLocks(); // Refresh to unlock
                    return;
                }

                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                p3MsgBox.innerHTML = `
                    <p class="mb-4 text-slate-400">
                        Finalize your matches. Challenge rivals to secure a Top 8 spot and qualify for the Super 8 round.
                    </p>
                    <p class="text-gold-500 mb-2">PHASE 3 UNLOCKS IN:</p>
                    <div class="text-2xl font-black text-white font-mono bg-slate-900/50 p-4 rounded-2xl border border-white/10 inline-block">
                        ${days}d : ${hours}h : ${minutes}m : ${seconds}s
                    </div>
                    <p class="mt-4 text-[8px] text-rose-500 italic">
                        *Phase 2 fixtures will close automatically when timer expires.
                    </p>
                `;
            }, 1000);
        } else {
            // Default message if no timer is set
            p3MsgBox.innerHTML = `<span class="text-slate-600">COMPLETE PHASE 2 MATCHES TO UNLOCK ELITE 8</span>`;
        }
    }
}


// --- 5. PHASE 2: THE BROKER BOARD (MARKET) ---

function renderBrokerBoard() {
    const container = document.getElementById('broker-board');
    if (!container) return;
    container.innerHTML = '';
    
    const myID = localStorage.getItem('slc_user_id');
    const myPlayer = state.players.find(p => p.id === myID);
    
    if (!state.brokerSubTab) state.brokerSubTab = 'hunts';
    
    // Sub-Navigation Tabs
    const subNav = document.createElement('div');
    subNav.className = "flex gap-2 mb-8 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5 w-full max-w-[340px] mx-auto";
    subNav.innerHTML = `
        <button onclick="state.brokerSubTab='hunts'; renderBrokerBoard();" class="flex-1 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${state.brokerSubTab === 'hunts' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}">Hunts</button>
        <button onclick="state.brokerSubTab='stats'; renderBrokerBoard();" class="flex-1 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${state.brokerSubTab === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}">Arena Stats</button>`;
    container.appendChild(subNav);
    
    // TAB: HUNTS (Negotiations & Targets)
    if (state.brokerSubTab === 'hunts') {
        const myChallenges = state.matches.filter(m => m.phase === 2 && m.status === 'pending' && (state.isAdmin || m.homeId === myID || m.awayId === myID));
        
        // 1. Render Active Negotiations (Pending)
        if (myChallenges.length > 0) {
            const dashDiv = document.createElement('div');
            dashDiv.className = "w-full space-y-4 mb-10";
            dashDiv.innerHTML = `<h4 class="text-[8px] font-black text-gold-500 uppercase tracking-[0.2em] text-center mb-2">Active Negotiations</h4>`;
            myChallenges.forEach(m => {
                const isTarget = m.awayId === myID;
                const challenger = state.players.find(p => p.id === m.homeId);
                const target = state.players.find(p => p.id === m.awayId);
                const opp = isTarget ? challenger : target;
                
                dashDiv.innerHTML += `
                    <div class="moving-border-gold p-[1px] rounded-[2.1rem] mb-3 animate-pop-in">
                        <div class="bg-slate-900 rounded-[2rem] p-5 relative z-10">
                            <div class="flex justify-between items-center mb-4">
                                <div class="flex items-center gap-3">
                                    ${getAvatarUI(opp, "w-10", "h-10")}
                                    <div class="flex flex-col">
                                        <span class="text-[7px] text-gold-500 font-black uppercase tracking-widest">${isTarget ? 'INCOMING' : 'SENT REQUEST'}</span>
                                        <span class="text-xs font-bold text-white uppercase">${opp?.name}</span>
                                    </div>
                                </div>
                                <div class="bg-gold-500/10 px-3 py-1 rounded-full border border-gold-500/20">
                                    <span class="text-[8px] font-black text-gold-400 uppercase">${m.stakeRate}% ${m.stakeType.toUpperCase()}</span>
                                </div>
                            </div>
                            ${(isTarget || state.isAdmin) ? `<div class="flex gap-2"><button onclick="respondToChallenge('${m.id}', 'accept')" class="flex-1 py-3 bg-emerald-600 text-white text-[9px] font-black rounded-xl uppercase active:scale-95 transition-all">Accept</button><button onclick="respondToChallenge('${m.id}', 'decline')" class="flex-1 py-3 bg-rose-600 text-white text-[9px] font-black rounded-xl uppercase active:scale-95 transition-all">Decline</button></div>` : `<div class="py-3 bg-white/5 border border-white/5 rounded-xl text-center"><p class="text-[7px] text-slate-500 italic uppercase font-black tracking-widest animate-pulse">Awaiting Approval</p></div>`}
                        </div>
                    </div>`;
            });
            container.appendChild(dashDiv);
        }
        
        // 2. Render Available Targets
        if (!myPlayer && !state.isAdmin) {
            container.innerHTML += `<p class="text-center py-10 text-slate-500 text-[8px] font-black uppercase">Please Login as Player to see Targets</p>`;
        } else {
            // Filter targets: Not me, Not already matched
            const targets = [...state.players]
                .filter(p => p.id !== myID && !state.matches.some(m => m.phase === 2 && m.status !== 'declined' && ((m.homeId === myID && m.awayId === p.id) || (m.homeId === p.id && m.awayId === myID))))
                .sort((a, b) => Math.abs(a.bounty - (myPlayer?.bounty || 0)) - Math.abs(b.bounty - (myPlayer?.bounty || 0)))
                .slice(0, 5);

            if (targets.length === 0) container.innerHTML += `<p class="text-center py-10 text-slate-600 text-[8px] font-black uppercase">No Targets found in your Sector</p>`;
            
            targets.forEach(t => {
                const isBusy = state.matches.some(m => m.phase === 2 && m.status === 'scheduled' && (m.homeId === t.id || m.awayId === t.id));
                const rank = getRankInfo(t.bounty);
                
                // --- NEW SCOUT LOGIC START ---
                const hasScout = myPlayer?.active_effects?.scout;
                let scoutBtnHTML = '';
                
                if (hasScout) {
                    scoutBtnHTML = `
                    <button onclick="useScout('${t.id}')" class="col-span-2 mb-2 py-2 bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 text-[8px] font-black rounded-xl uppercase hover:bg-emerald-900/60 transition-colors shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-2">
                        <i data-lucide="scan" class="w-3 h-3"></i> Use Active Scout
                    </button>`;
                }
                // --- NEW SCOUT LOGIC END ---

                const card = document.createElement('div');
                card.className = "moving-border-blue p-[1px] rounded-[2.6rem] mb-5 w-full max-w-[340px] mx-auto shadow-xl block";
                card.innerHTML = `
                    <div class="bg-slate-900 rounded-[2.5rem] p-6 relative z-10 h-full">
                        <div class="flex justify-between items-start mb-6">
                            <div class="flex items-center gap-3">
                                ${getAvatarUI(t, "w-12", "h-12")}
                                <div>
                                    <h3 class="text-white font-black text-sm uppercase italic leading-tight">${t.name}</h3>
                                    <p class="text-[7px] font-black uppercase mt-1 tracking-widest ${rank.color}">${rank.name}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-blue-400 font-black text-sm">${t.bounty.toLocaleString()}</p>
                                <span class="text-[6px] text-slate-600 font-black uppercase">Current BP</span>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3">
                            ${scoutBtnHTML} <button onclick="sendChallenge('${myID}', '${t.id}', 'std')" ${isBusy ? 'disabled' : ''} class="py-3 bg-slate-950 border border-white/10 rounded-2xl text-[8px] font-black text-slate-400 uppercase active:scale-95 disabled:opacity-20 hover:bg-white/5 transition-colors">Standard</button>
                            <button onclick="sendChallenge('${myID}', '${t.id}', 'high')" ${isBusy ? 'disabled' : ''} class="py-3 bg-blue-600 rounded-2xl text-[8px] font-black text-white uppercase active:scale-95 shadow-lg shadow-blue-900/40 disabled:opacity-20 hover:bg-blue-500 transition-colors">High Stake</button>
                        </div>
                    </div>`;
                container.appendChild(card);
            });
        }
    }
    // TAB: STATS
    else if (state.brokerSubTab === 'stats') {
        const statsDiv = document.createElement('div');
        statsDiv.className = "w-full animate-pop-in space-y-3";
        [...state.players].sort((a, b) => b.bounty - a.bounty).forEach(p => {
            const rank = getRankInfo(p.bounty);
            statsDiv.innerHTML += `
                <div class="moving-border p-[1px] rounded-[1.1rem]">
                    <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-[1rem] relative z-10">
                        <div class="flex items-center gap-3">
                            ${getAvatarUI(p, "w-8", "h-8")}
                            <div class="flex flex-col">
                                <span class="text-[10px] font-bold ${p.id === myID ? 'text-emerald-400' : 'text-white'} uppercase">${p.name}</span>
                                <span class="text-[7px] font-black uppercase tracking-widest ${rank.color}">${rank.name}</span>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="text-center"><p class="text-[7px] text-blue-400 font-black uppercase">High</p><p class="text-xs text-white font-black">${p.p2High || 0}/3</p></div>
                            <div class="text-center"><p class="text-[7px] text-slate-500 font-black uppercase">Std</p><p class="text-xs text-white font-black">${p.p2Std || 0}/2</p></div>
                        </div>
                    </div>
                </div>`;
        });
        container.appendChild(statsDiv);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}




async function sendChallenge(hunterId, targetId, type) {
    const hunter = state.players.find(p => p.id === hunterId);
    const target = state.players.find(p => p.id === targetId);

    if (!hunter && !state.isAdmin) return notify("Login Required", "lock");

    if (type === 'high' && (hunter.p2High || 0) >= P2_LIMIT_HIGH) return notify("High Stake limit reached (3/3)", "alert-triangle");
    if (type === 'std' && (hunter.p2Std || 0) >= P2_LIMIT_STD) return notify("Standard limit reached (2/2)", "alert-triangle");
    if (type === 'high' && (target.p2High || 0) >= P2_LIMIT_HIGH) return notify("Target High slots full", "user-minus");
    if (type === 'std' && (target.p2Std || 0) >= P2_LIMIT_STD) return notify("Target Standard slots full", "user-minus");

    const rate = type === 'high' ? 30 : 15;
    const mid = `p2-req-${Date.now()}`;

    try {
        await db.collection("matches").doc(mid).set({
            id: mid, homeId: hunterId, awayId: targetId, status: 'pending', phase: 2,
            stakeType: type, stakeRate: rate, createdAt: Date.now()
        });
        notify(`Request Sent: ${rate}% ${type.toUpperCase()}`, "send");
    } catch (e) { notify("Cloud error", "x-circle"); }
}

async function respondToChallenge(matchId, action) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return notify("Match missing", "x-octagon");

    const h = state.players.find(p => p.id === match.homeId);
    const t = state.players.find(p => p.id === match.awayId);

    if (action === 'accept') {
        if (match.stakeType === 'high' && ((h.p2High || 0) >= 3 || (t.p2High || 0) >= 3)) return notify("Slot Error: Limit reached", "alert-triangle");
        if (match.stakeType === 'std' && ((h.p2Std || 0) >= 2 || (t.p2Std || 0) >= 2)) return notify("Slot Error: Limit reached", "alert-triangle");

        try {
            const batch = db.batch();
            const field = match.stakeType === 'high' ? 'p2High' : 'p2Std';
            
            batch.update(db.collection("players").doc(h.id), { [field]: firebase.firestore.FieldValue.increment(1) });
            batch.update(db.collection("players").doc(t.id), { [field]: firebase.firestore.FieldValue.increment(1) });
            batch.update(db.collection("matches").doc(matchId), { status: 'scheduled' });
            
            await batch.commit();
            notify("Contract Scheduled!", "check-circle");
        } catch (e) { notify("Sync Failed", "x-circle"); }
    } 
     else {
        // DECLINE LOGIC WITH ITEM CHECK
        const activeEff = t.active_effects || {};
        
        if (activeEff.decline_pass) {
             askConfirm("Use DECLINE PASS to waive penalty?", async () => {
                const batch = db.batch();
                // Remove Item
                batch.update(db.collection("players").doc(t.id), { "active_effects.decline_pass": false });
                batch.update(db.collection("matches").doc(matchId), { status: 'declined' });
                await batch.commit();
                notify("Declined using Pass (0 BP)", "shield-check");
             });
        } else {
            // STANDARD PENALTY
            const penalty = Math.floor(t.bounty * 0.05);
            // ... (Existing standard decline code) ...
        }
    }

}

// --- 6. PRO DASHBOARD (SETTINGS TAB) ---
function renderPlayerDashboard() {
    const container = document.getElementById('view-settings');
    if (!container) return;
    
    const rawID = localStorage.getItem('slc_user_id') || "";
    const myID = rawID.toUpperCase();
    const p = state.players.find(x => x?.id && x.id.toUpperCase() === myID);
    
    let html = `<div class="space-y-6 animate-pop-in">`;
    if (p) {
        const rank = getRankInfo(p.bounty || 0);
        
        // --- AVATAR LOGIC ---
        const avatarHTML = p.avatar 
            ? `<img src="${p.avatar}" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="w-full h-full bg-slate-800 flex items-center justify-center text-2xl font-black text-white hidden">${(p.name || "U").charAt(0).toUpperCase()}</div>`
            : `<div class="w-full h-full bg-slate-800 flex items-center justify-center text-2xl font-black text-white shadow-inner">${(p.name || "U").charAt(0).toUpperCase()}</div>`;

        // 1. PROFILE CARD
        html += `
            <div class="moving-border-gold p-[1.5px] rounded-[2.6rem] shadow-2xl relative">
                <div class="bg-slate-900 rounded-[2.5rem] p-6 text-center relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4">
                        <span class="achievement-badge">Verified Pro</span>
                    </div>
                    
                    <div class="w-20 h-20 rounded-3xl mx-auto mb-4 border border-white/10 shadow-lg overflow-hidden relative">
                        ${avatarHTML}
                    </div>

                    <h2 class="text-white font-black text-lg uppercase italic leading-none">${p.name || "Unknown Agent"}</h2>
                    
                    <div class="flex items-center justify-center gap-2 mt-2 cursor-pointer active:scale-95 transition-transform group" onclick="copyToClipboard('${p.id}')">
                        <p class="text-[8px] text-slate-500 font-black uppercase tracking-widest group-hover:text-emerald-400 transition-colors">SLC-ID: ${p.id}</p>
                        <i data-lucide="copy" class="w-3 h-3 text-slate-600 group-hover:text-emerald-400 transition-colors"></i>
                    </div>
                    
                    <div class="flex justify-center gap-2 mt-4">
                        ${p.bounty >= 1001 ? '<span class="achievement-badge border-gold-500/50 text-gold-500"><i data-lucide="crown" class="w-2 h-2"></i> Legend</span>' : ''}
                        ${p.wins >= 5 ? '<span class="achievement-badge border-rose-500/50 text-rose-500"><i data-lucide="zap" class="w-2 h-2"></i> Predator</span>' : ''}
                        <span class="achievement-badge ${rank.color} border-white/10">${rank.name}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="moving-border-blue p-[1px] rounded-[2.1rem] shadow-lg">
                    <div class="bg-slate-900 p-5 rounded-[2rem] text-center h-full flex flex-col justify-center">
                        <p class="text-[7px] text-slate-500 font-black uppercase mb-1">Current Bounty</p>
                        <p class="text-xl font-black text-emerald-400">${(p.bounty || 0).toLocaleString()}</p>
                    </div>
                </div>
                <div class="moving-border-blue p-[1px] rounded-[2.1rem] shadow-lg">
                    <div class="bg-slate-900 p-5 rounded-[2rem] text-center h-full flex flex-col justify-center">
                        <p class="text-[7px] text-slate-500 font-black uppercase mb-1">Recent Form</p>
                        <div class="flex justify-center gap-1.5 mt-2" id="dash-form-dots"></div>
                    </div>
                </div>
            </div>`;
        const nextMatches = state.matches.filter(m =>
            m.status === 'scheduled' && (m.homeId === p.id || m.awayId === p.id)
        );
        html += `
            <div class="moving-border-emerald p-[1px] rounded-[2.6rem] shadow-xl">
                <div class="bg-slate-900 rounded-[2.5rem] p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-[9px] font-black text-blue-400 uppercase tracking-widest italic">Upcoming Fixtures</h3>
                        <span class="text-[8px] font-bold text-slate-600">${nextMatches.length} Pending</span>
                    </div>
                    <div class="space-y-3">
                        ${nextMatches.length > 0 ? nextMatches.map(m => {
                            const oppID = m.homeId === p.id ? m.awayId : m.homeId;
                            const opponent = state.players.find(x => x.id === oppID);
                            return `
                                <div class="flex justify-between items-center p-3 bg-slate-950/50 rounded-2xl border border-white/5">
                                    <div>
                                        <p class="text-[10px] font-bold text-white uppercase">${opponent?.name || "Unknown"}</p>
                                        <p class="text-[7px] text-slate-500 font-black uppercase tracking-tighter">PHASE ${m.phase} • ${m.stakeType || 'STD'}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[8px] font-black text-emerald-500 uppercase">${m.scheduledDate || 'TBA'}</p>
                                    </div>
                                </div>`;
                        }).join('') : '<p class="text-[8px] text-slate-600 uppercase font-black py-2">No upcoming matches</p>'}
                    </div>
                </div>
            </div>`;
    }
    
    if (state.isAdmin) {
        html += `
            <div class="admin-tool space-y-6 mt-8 pt-8 border-t border-white/5">
                <h2 class="text-[10px] font-black text-rose-500 uppercase text-center tracking-[0.4em] italic">Command Center</h2>
                
                <div class="moving-border p-[1px] rounded-[2.6rem] shadow-2xl">
                    <div class="bg-slate-900 rounded-[2.5rem] p-6">
                        <label class="block text-[8px] font-black text-blue-400 uppercase mb-3 tracking-widest">Global Match Date</label>
                        <div class="flex gap-2 mb-4">
                            <input type="date" id="admin-active-date-input" class="flex-1 bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none focus:border-blue-500">
                            <button onclick="setGlobalMatchDate()" class="px-5 py-3 bg-blue-600 text-white text-[10px] font-black rounded-xl shadow-lg active:scale-95 transition-all">SET DATE</button>
                        </div>
                        
                        <label class="block text-[8px] font-black text-gold-500 uppercase mb-3 tracking-widest">Phase 3 Unlock Countdown</label>
                        <div class="flex gap-2">
                            <input type="datetime-local" id="admin-p3-time-input" class="flex-1 bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none focus:border-gold-500">
                            
                            <button onclick="setPhase3Lock()" class="px-4 py-3 bg-gold-600 text-white text-[10px] font-black rounded-xl shadow-lg active:scale-95 transition-all">SET</button>
                            
                            <button onclick="clearPhase3Lock()" class="px-4 py-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-black rounded-xl shadow-lg active:scale-95 transition-all hover:bg-rose-500 hover:text-white">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>

                        <div class="mt-6 pt-4 border-t border-white/5">
                            <label class="block text-[8px] font-black text-emerald-500 uppercase mb-3 tracking-widest">Sponsor / Announcement</label>
                            <div class="flex gap-2">
                                <input type="text" id="admin-sponsor-input" placeholder="Type message..." value="${state.sponsorMessage || ''}" class="flex-1 bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none focus:border-emerald-500">
                                <button onclick="setSponsorMessage()" class="px-5 py-3 bg-emerald-600 text-white text-[10px] font-black rounded-xl shadow-lg active:scale-95 transition-all">POST</button>
                            </div>
                            <p class="text-[7px] text-slate-500 mt-2 italic">*Clear text and click POST to restore normal news.</p>
                        </div>

                    </div>
                </div>

                <div class="moving-border p-[1px] rounded-[2.6rem] shadow-xl">
                    <div class="bg-slate-900 rounded-[2.5rem] p-6">
                        <label class="block text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">Bulk Recruitment</label>
                        <textarea id="bulk-names" placeholder="Name per line" class="w-full h-24 bg-slate-950 border border-white/10 rounded-2xl p-4 text-[10px] text-white outline-none mb-3"></textarea>
                        <button onclick="bulkAddPlayers()" class="w-full py-3 bg-white/5 border border-white/10 text-white text-[9px] font-black rounded-xl uppercase tracking-widest">Deploy Squad</button>
                    </div>
                </div>

                <div id="admin-players-list" class="space-y-2"></div>
                <button onclick="askFactoryReset()" class="w-full py-4 text-rose-600 font-black text-[8px] uppercase tracking-[0.3em] opacity-30 hover:opacity-100 transition-opacity">Factory Reset Cloud</button>
            </div>`;
    } else {
        // --- NEW: EDIT PROFILE BUTTON (Only for Players) ---
        html += `
            <div class="mt-8 mb-4">
                 <div class="moving-border-blue p-[1px] rounded-[2.1rem] shadow-xl group cursor-pointer active:scale-95 transition-transform" onclick="openEditProfile()">
                    <div class="bg-slate-900 rounded-[2rem] p-5 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <i data-lucide="settings-2" class="w-5 h-5 text-blue-400"></i>
                            </div>
                            <div>
                                <h4 class="text-[9px] font-black text-white uppercase tracking-widest">Edit Profile</h4>
                                <p class="text-[7px] text-slate-500 font-bold uppercase mt-0.5">Update Avatar & Phone</p>
                            </div>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors"></i>
                    </div>
                 </div>
            </div>`;
    }
    
    // Footer
    html += `
        <div class="text-center pt-6 pb-20">
            <button onclick="logout()" class="px-10 py-4 bg-rose-500/5 text-rose-500 text-[10px] font-black rounded-full border border-rose-500/20 tracking-[0.2em] shadow-xl active:scale-95 transition-all mb-16">
                TERMINATE SESSION
            </button>
            <div class="h-[1px] w-16 bg-gradient-to-r from-transparent via-slate-800 to-transparent mx-auto mb-6"></div>
            <p class="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Developed By <span class="text-emerald-500">Meraz Bin Mizanur</span></p>
            <p class="text-[7px] font-bold text-slate-600 uppercase tracking-[0.15em] leading-relaxed max-w-[220px] mx-auto">This tournament platform is an official operating system of the <span class="text-slate-400">Synthex Legion Chronicles Club</span></p>
            <p class="text-[6px] text-slate-800 font-black uppercase mt-4 tracking-widest">SLC-OS v3.0.1 Stable Build</p>
        </div>
    </div>`;
    
    container.innerHTML = html;
    
    // Recent Form Logic
    if (p) {
        setTimeout(() => {
            const hist = state.matches
                .filter(m => m.status === 'played' && (m.homeId === p.id || m.awayId === p.id))
                .sort((a, b) => b.id.localeCompare(a.id)); 
            
            const dotContainer = document.getElementById('dash-form-dots');
            if (dotContainer) {
                dotContainer.innerHTML = '';
                hist.slice(0, 5).forEach(m => {
                    const isWin = (m.winnerId === p.id) || (m.homeId === p.id && m.score.h > m.score.a) || (m.awayId === p.id && m.score.a > m.score.h);
                    const isDraw = m.score && m.score.h === m.score.a;
                    dotContainer.innerHTML += `<span class="form-dot ${isDraw ? 'form-d' : (isWin ? 'form-w' : 'form-l')}"></span>`;
                });
                if (hist.length === 0) dotContainer.innerHTML = '<span class="text-[8px] text-slate-700 font-black">NO DATA</span>';
            }
        }, 50);
    }
    
    if (state.isAdmin) renderAdminList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}






// --- 7. PHASE OPERATIONS (P1 & P3) ---

// [REPLACEMENT] Generator: Fixed 5 Rounds (Randomized)
function askGeneratePhase1() {
    askConfirm("Generate Phase 1 (5 Matches Per Player)?", async () => {
        const players = [...state.players];
        
        // 1. Validation
        if (players.length < 6) return notify("Need at least 6 players for random matchmaking", "alert-triangle");
        if (players.length % 2 !== 0) return notify("Player count must be EVEN (e.g., 30). Add a dummy player.", "users");

        const batch = db.batch();
        const history = new Set(); // Stores "ID1-ID2" strings to prevent duplicates
        const MAX_ROUNDS = 5; // <--- STRICT LIMIT SET TO 5

        // Helper: Fisher-Yates Shuffle
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        // Helper: Create unique key for history check (smaller ID first)
        const getPairKey = (id1, id2) => id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;

        // 2. Generation Loop (Runs exactly 5 times)
        for (let r = 1; r <= MAX_ROUNDS; r++) {
            let isValidRound = false;
            let attempt = 0;
            let roundPairs = [];

            // Retry logic: If a shuffle creates a duplicate match, reshuffle and try again
            while (!isValidRound && attempt < 100) {
                shuffle(players);
                roundPairs = [];
                let collisionFound = false;

                // Try pairing adjacent players (0vs1, 2vs3, etc.)
                for (let i = 0; i < players.length; i += 2) {
                    const p1 = players[i];
                    const p2 = players[i + 1];
                    const pairKey = getPairKey(p1.id, p2.id);

                    if (history.has(pairKey)) {
                        collisionFound = true;
                        break; // Stop this shuffle, it's bad
                    }
                    roundPairs.push({ p1, p2, key: pairKey });
                }

                if (!collisionFound) {
                    isValidRound = true; // We found a clean set of matches for this round!
                }
                attempt++;
            }

            if (!isValidRound) {
                return notify(`Failed to generate Round ${r}. Try reset/again.`, "x-octagon");
            }

            // 3. Commit the valid round to Batch
            roundPairs.forEach(pair => {
                history.add(pair.key); // Mark these two as having played
                const mid = `p1-r${r}-${pair.p1.id}-${pair.p2.id}`;
                
                batch.set(db.collection("matches").doc(mid), { 
                    id: mid, 
                    homeId: pair.p1.id, 
                    awayId: pair.p2.id, 
                    phase: 1, 
                    round: r, 
                    status: 'scheduled',
                    createdAt: Date.now()
                });
            });
        }

        await batch.commit();
        notify(`Success! Generated 5 Matches for ${players.length} Players.`, "calendar");
        setTimeout(() => location.reload(), 1500);
    });
}


function askGeneratePhase3() {
    askConfirm("Initialize Knockout Bracket?", async () => {
        const top8 = [...state.players].sort((a,b) => b.bounty - a.bounty).slice(0, 8);
        if (top8.length < 8) return notify("Need 8 hunters", "alert-triangle");
        
        const batch = db.batch();
        const qfSlots = [[0, 7], [3, 4], [1, 6], [2, 5]]; 
        qfSlots.forEach((slot, i) => {
            const mid = `p3-qf-${i}`;
            batch.set(db.collection("matches").doc(mid), {
                id: mid, round: 'qf', homeId: top8[slot[0]].id, awayId: top8[slot[1]].id, 
                phase: 3, status: 'scheduled', 
                nextMatch: `p3-sf-${Math.floor(i/2)}`,
                nextSlot: (i % 2 === 0) ? 'homeId' : 'awayId'
            });
        });

        batch.set(db.collection("matches").doc('p3-sf-0'), { id: 'p3-sf-0', round: 'sf', phase: 3, status: 'waiting', homeId: null, awayId: null, nextMatch: 'p3-fn-0', nextSlot: 'homeId' });
        batch.set(db.collection("matches").doc('p3-sf-1'), { id: 'p3-sf-1', round: 'sf', phase: 3, status: 'waiting', homeId: null, awayId: null, nextMatch: 'p3-fn-0', nextSlot: 'awayId' });
        batch.set(db.collection("matches").doc('p3-fn-0'), { id: 'p3-fn-0', round: 'fn', phase: 3, status: 'waiting', homeId: null, awayId: null });

        await batch.commit();
        notify("Bracket Live!", "trophy");
    });
}

function renderEliteBracket() {
    const container = document.getElementById('bracket-list');
    if (!container) return;
    
    const m = (id) => state.matches.find(x => x.id === id) || { status: 'waiting' };
    const p = (id) => state.players.find(x => x.id === id) || { name: 'TBD' };
    
    const renderBox = (match) => {
        if (match.status === 'waiting' || (!match.homeId && !match.awayId)) {
            return `<div class="bracket-match opacity-30"><p class="text-[8px] uppercase font-bold text-slate-500">Awaiting Winners</p></div>`;
        }
        
        const h = p(match.homeId);
        const a = p(match.awayId);
        
        const renderScores = (playerType) => {
            if (match.round === 'fn') {
                const score = match.score ? match.score[playerType] : '-';
                return `<div class="bracket-score-box"><span class="w-8 !h-6 text-sm font-black text-white">${score}</span></div>`;
            } else {
                const l1 = match.leg1 ? match.leg1[playerType] : '-';
                const l2 = match.leg2 ? match.leg2[playerType] : '-';
                const needsLeg3 = match.leg3 || (match.leg1 && match.leg2 && (match.leg1.h + match.leg2.h === match.leg1.a + match.leg2.a));
                const l3 = match.leg3 ? match.leg3[playerType] : '-';
                
                return `
                    <div class="bracket-score-box">
                        <span>${l1}</span><span>${l2}</span>
                        ${needsLeg3 ? `<span>${l3}</span>` : ''}
                    </div>`;
            }
        };
        
        return `
            <div class="bracket-match active:scale-95 cursor-pointer transition-transform" onclick="openResultEntry('${match.id}')">
                <div class="bracket-team">
                    <span class="text-[10px] uppercase font-black ${match.winnerId === match.homeId ? 'text-gold-500' : 'text-white'}">${h.name}</span>
                    ${renderScores('h')}
                </div>
                <div class="bracket-team mt-1">
                    <span class="text-[10px] uppercase font-black ${match.winnerId === match.awayId ? 'text-gold-500' : 'text-white'}">${a.name}</span>
                    ${renderScores('a')}
                </div>
                ${match.round === 'fn' ? '<div class="text-[7px] text-gold-500 font-black uppercase tracking-widest text-center mt-2 border-t border-white/5 pt-1">Grand Finale</div>' : ''}
            </div>`;
    };
    
    container.innerHTML = `
        <div class="bracket-wrapper custom-scrollbar">
            <div class="bracket-column">
                <h4 class="text-[8px] text-slate-500 font-black text-center mb-2">QUARTER FINALS</h4>
                ${renderBox(m('p3-qf-0'))} ${renderBox(m('p3-qf-1'))}
                ${renderBox(m('p3-qf-2'))} ${renderBox(m('p3-qf-3'))}
            </div>
            <div class="bracket-column">
                <h4 class="text-[8px] text-blue-400 font-black text-center mb-2">SEMI FINALS</h4>
                ${renderBox(m('p3-sf-0'))} ${renderBox(m('p3-sf-1'))}
            </div>
            <div class="bracket-column">
                <h4 class="text-[8px] text-gold-500 font-black text-center mb-2">GRAND FINAL</h4>
                ${renderBox(m('p3-fn-0'))}
            </div>
        </div>`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- 8. MATCH RESULTS & SCORING ---
// [UPDATED] saveMatchResult: Now supports Shop Items (Insurance & Multiplier)
async function saveMatchResult() {
    const sH = parseInt(document.getElementById('res-s-h').value);
    const sA = parseInt(document.getElementById('res-s-a').value);
    const verifyId = document.getElementById('res-verify-id').value.trim().toUpperCase();

    if (isNaN(sH) || isNaN(sA)) return notify("Enter scores", "alert-circle");
    
    const m = state.matches.find(x => x.id === state.activeMatchId);
    if (!m) return;
    
    const isAuthorized = state.isAdmin || (verifyId === m.homeId || verifyId === m.awayId);
    if (!isAuthorized) return notify("Unauthorized", "lock");

    try {
        // --- CRITICAL CHANGE: REVERT OLD STATS IF EDITING ---
        if (m.status === 'played') {
            await revertMatchStats(m);
        }
        // -----------------------------------------------------

        const batch = db.batch();
        let matchUpdate = { status: 'played' };
        let hBP = 0, aBP = 0;

        // 1. GET PLAYERS & ACTIVE EFFECTS
        const hObj = state.players.find(p => p.id === m.homeId);
        const aObj = state.players.find(p => p.id === m.awayId);
        const hEff = hObj?.active_effects || {};
        const aEff = aObj?.active_effects || {};

        // 2. HELPER: CALCULATE POINTS WITH ITEM LOGIC
        // applies Multiplier on Wins, Insurance on Losses
        const calcPoints = (isWinner, baseWin, baseLoss, effectObj) => {
            if (isWinner) {
                // Multiplier: Doubles the win points
                if (effectObj.multiplier) return baseWin * 2;
                return baseWin;
            } else {
                // Insurance: Halves the loss points
                if (effectObj.insurance) return baseLoss / 2;
                return baseLoss;
            }
        };

        // 3. DEFINE BASE SCORING RULES
        let winPts = 0, lossPts = 0, drawPts = -30;

        if (m.phase === 3) {
            winPts = 300; lossPts = -250; drawPts = -100;
            matchUpdate.winnerId = sH > sA ? m.homeId : (sA > sH ? m.awayId : null);
        } 
        else if (m.phase === 2) {
            // Phase 2: Percentage of Total Pool
            const pool = Math.floor((hObj.bounty + aObj.bounty) * (m.stakeRate / 100));
            winPts = pool; lossPts = -pool;
        } 
        else {
            // Phase 1: Standard Scoring
            winPts = 100; lossPts = -50;
        }

        // 4. CALCULATE FINAL BP (Applying Items)
        if (sH > sA) { 
            hBP = calcPoints(true, winPts, lossPts, hEff);
            aBP = calcPoints(false, winPts, lossPts, aEff);
        } 
        else if (sA > sH) { 
            hBP = calcPoints(false, winPts, lossPts, hEff);
            aBP = calcPoints(true, winPts, lossPts, aEff);
        } 
        else { 
            // Draws are usually not affected by items
            hBP = drawPts; aBP = drawPts; 
        }

        matchUpdate.score = { h: sH, a: sA };
        matchUpdate.resultDelta = { h: hBP, a: aBP };
// NEW: Track who submitted the result
matchUpdate.submittedBy = state.isAdmin ? "ADMIN" : verifyId;
matchUpdate.submittedAt = Date.now();
        
        // 5. CONSUME ITEMS (Remove them after the match)
        // Checks if items were active and removes them from the database
        const consumeItem = (pid, effectName) => {
            batch.update(db.collection("players").doc(pid), { [`active_effects.${effectName}`]: false });
        };

        if (hEff.insurance) consumeItem(m.homeId, "insurance");
        if (hEff.multiplier) consumeItem(m.homeId, "multiplier");
        if (hEff.privacy) consumeItem(m.homeId, "privacy");

        if (aEff.insurance) consumeItem(m.awayId, "insurance");
        if (aEff.multiplier) consumeItem(m.awayId, "multiplier");
        if (aEff.privacy) consumeItem(m.awayId, "privacy");

        // 6. UPDATE PLAYER STATS
        batch.update(db.collection("players").doc(m.homeId), {
            bounty: firebase.firestore.FieldValue.increment(hBP),
            wins: firebase.firestore.FieldValue.increment(sH > sA ? 1 : 0),
            draws: firebase.firestore.FieldValue.increment(sH === sA ? 1 : 0),
            losses: firebase.firestore.FieldValue.increment(sH < sA ? 1 : 0),
            mp: firebase.firestore.FieldValue.increment(1)
        });
        batch.update(db.collection("players").doc(m.awayId), {
            bounty: firebase.firestore.FieldValue.increment(aBP),
            wins: firebase.firestore.FieldValue.increment(sA > sH ? 1 : 0),
            draws: firebase.firestore.FieldValue.increment(sH === sA ? 1 : 0),
            losses: firebase.firestore.FieldValue.increment(sA < sH ? 1 : 0),
            mp: firebase.firestore.FieldValue.increment(1)
        });
        
        batch.update(db.collection("matches").doc(m.id), matchUpdate);
        await batch.commit();
        
        notify("Result Saved & Items Applied!", "check-circle");
        closeModal('modal-result');
        
    } catch (err) {
        console.error(err);
        notify("Sync Error", "x-circle");
    }
}




// [UPDATED] openResultEntry: Pre-fills scores for editing
// [UPDATED] openResultEntry: Uses Avatar Engine for pictures
function openResultEntry(id) {
    state.activeMatchId = id;
    const m = state.matches.find(x => x.id === id);
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);

    // 1. UI Labels (Names)
    document.getElementById('res-h-name').innerText = h?.name || "TBD";
    document.getElementById('res-a-name').innerText = a?.name || "TBD";

    // 2. NEW: Inject Avatars (Large Size: w-16 h-16)
    // This automatically handles the "Image vs Initials" logic
    document.getElementById('res-h-avatar').innerHTML = getAvatarUI(h, "w-16", "h-16", "text-2xl");
    document.getElementById('res-a-avatar').innerHTML = getAvatarUI(a, "w-16", "h-16", "text-2xl");

    // 3. Check if Editing (Match is already played)
    if (m.status === 'played' && m.score) {
        document.getElementById('res-s-h').value = m.score.h;
        document.getElementById('res-s-a').value = m.score.a;
        document.getElementById('res-match-label').innerText = `EDIT RESULT (PH-${m.phase})`;
    } else {
        // New Entry
        document.getElementById('res-s-h').value = "";
        document.getElementById('res-s-a').value = "";
        document.getElementById('res-match-label').innerText = `PH-${m.phase} VERIFICATION`;
    }

    // 4. Admin Layout
    const verifyIdContainer = document.getElementById('res-verify-id').parentElement;
    if (state.isAdmin) {
        verifyIdContainer.classList.add('hidden'); // Hide ID check for admin
        document.getElementById('res-date').value = m.scheduledDate || "";
        document.getElementById('res-deadline').value = m.deadline || "";
    } else {
        verifyIdContainer.classList.remove('hidden');
        document.getElementById('res-verify-id').value = "";
    }
    
    openModal('modal-result');
}





// --- 9. GLOBAL UI RENDERERS ---

// [UPDATED] renderLeaderboard: Now supports "Privacy" Shop Item
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    
    list.innerHTML = `<h2 class="text-xs font-black text-slate-500 uppercase mb-6 italic tracking-widest">Global Standings</h2>`;
    
    [...state.players].sort((a,b) => b.bounty - a.bounty).forEach((p, i) => {
        let borderClass = 'moving-border-blue'; 
        if (i === 0) borderClass = 'moving-border-gold';
        if (i === 1 || i === 2) borderClass = 'moving-border-emerald';

        // --- START UPDATE: CHECK PRIVACY ITEM ---
        const activeEff = p.active_effects || {};
        let statsDisplay = `M: ${p.mp || 0} • W: ${p.wins || 0} • D: ${p.draws || 0} • L: ${p.losses || 0}`;

        // If Privacy is active, hide the stats
        if (activeEff.privacy) {
            statsDisplay = `<span class="text-emerald-500 flex items-center gap-1"><i data-lucide="lock" class="w-2 h-2"></i> DATA ENCRYPTED</span>`;
        }
        // --- END UPDATE ---

        list.innerHTML += `
            <div class="${borderClass} p-[1px] rounded-[1.6rem] mb-3 w-full max-w-[340px] mx-auto shadow-xl">
                <div class="bg-slate-900 p-3 rounded-[1.5rem] flex items-center h-full relative z-10">
                    <span class="text-[10px] font-black w-6 text-center ${i<3?'text-gold-500':'text-slate-600'}">#${i+1}</span>
                    
                    <div class="mx-2">${getAvatarUI(p, "w-8", "h-8")}</div>
                    
                    <div class="flex-1 overflow-hidden">
                        <span class="font-bold text-xs text-white uppercase truncate block">${p.name}</span>
                        <p class="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            ${statsDisplay} 
                        </p>
                    </div>
                    <span class="font-black text-emerald-400 text-xs ml-2">${p.bounty.toLocaleString()}</span>
                </div>
            </div>`;
    });
    
    // Refresh icons for the new "Lock" symbol
    if (typeof lucide !== 'undefined') lucide.createIcons();
}



// --- [NEW] BULK SCHEDULING LOGIC ---

function toggleBulkMode() {
    state.bulkMode = !state.bulkMode;
    state.selectedMatches.clear(); // Reset selection when toggling
    renderSchedule();
}

function toggleMatchSelection(mid) {
    if (state.selectedMatches.has(mid)) {
        state.selectedMatches.delete(mid);
    } else {
        state.selectedMatches.add(mid);
    }
    renderSchedule(); // Re-render to show checkbox state
}

async function applyBulkSchedule() {
    const d = document.getElementById('bulk-date').value;
    const t = document.getElementById('bulk-time').value;

    if (state.selectedMatches.size === 0) return notify("No matches selected", "alert-circle");
    if (!d) return notify("Select a Date", "calendar");

    try {
        const batch = db.batch();
        state.selectedMatches.forEach(mid => {
            const updateData = { scheduledDate: d };
            if (t) updateData.deadline = `${d}T${t}`; // Only add time if selected
            batch.update(db.collection("matches").doc(mid), updateData);
        });

        await batch.commit();
        
        notify(`${state.selectedMatches.size} Matches Updated!`, "check-circle");
        state.bulkMode = false;
        state.selectedMatches.clear();
        renderSchedule();
        
    } catch (e) {
        console.error(e);
        notify("Bulk Update Failed", "x-circle");
    }
}

// [UPDATED] Render: Displays Round Number (e.g., PH-1 • R-1)
function renderSchedule() {
    const active = document.getElementById('schedule-list');
    const recent = document.getElementById('recent-results-list');
    
    // P1 Button Logic
    const p1Btn = document.getElementById('p1-gen-btn');
    if (p1Btn) {
        const p1Exists = state.matches.some(m => m.phase === 1);
        if (p1Exists) {
            p1Btn.disabled = true;
            p1Btn.innerText = "SEASON ACTIVE";
            p1Btn.classList.add('opacity-30', 'cursor-not-allowed', 'grayscale');
            p1Btn.classList.remove('bg-emerald-600', 'shadow-lg');
            p1Btn.onclick = null;
        }
    }
    
    if (!active || !recent) return;
    active.innerHTML = '';
    recent.innerHTML = '';
    
    // Sort by Round First, then Date
    const allScheduled = state.matches
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => (a.round || 0) - (b.round || 0));

    const display = (state.isAdmin || state.bulkMode) ? allScheduled : allScheduled.filter(m => m.scheduledDate === state.viewingDate);
    
    // Admin Controls
    if (state.isAdmin) {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = "w-full max-w-[340px] mb-6 space-y-3";
        
        if (!state.bulkMode) {
            // 1. Bulk Mode Button
            controlsDiv.innerHTML = `
            <button onclick="toggleBulkMode()" class="w-full py-3 bg-white/5 border border-white/10 text-slate-400 text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                <i data-lucide="list-checks" class="w-3 h-3"></i> Bulk Schedule Mode
            </button>`;
            
            // 2. NEW: Download Schedule Button
            controlsDiv.innerHTML += `
            <button onclick="showSchedulePreview()" class="w-full mt-2 py-3 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2">
                <i data-lucide="download" class="w-3 h-3"></i> Download Official Schedule
            </button>`;

        } else {
            // Active Bulk Editor (No changes here)
            controlsDiv.innerHTML = `
                <div class="moving-border-gold p-[1px] rounded-[1.6rem] animate-pop-in">
                    <div class="bg-slate-900 p-4 rounded-[1.5rem]">
                        <div class="flex justify-between items-center mb-3"><span class="text-[8px] font-black text-gold-500 uppercase tracking-widest">Bulk Editor</span><span class="text-[8px] font-bold text-white bg-white/10 px-2 py-0.5 rounded-lg">${state.selectedMatches.size} Selected</span></div>
                        <div class="flex gap-2 mb-3"><input type="date" id="bulk-date" class="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-[9px] text-white outline-none focus:border-gold-500"><input type="time" id="bulk-time" class="w-20 bg-slate-950 border border-white/10 rounded-lg p-2 text-[9px] text-white outline-none focus:border-gold-500"></div>
                        <div class="flex gap-2"><button onclick="toggleBulkMode()" class="flex-1 py-2 bg-white/5 text-slate-500 text-[8px] font-black rounded-lg uppercase">Cancel</button><button onclick="applyBulkSchedule()" class="flex-[2] py-2 bg-gold-600 text-white text-[8px] font-black rounded-lg uppercase shadow-lg active:scale-95 transition-transform">Apply Updates</button></div>
                    </div>
                </div>`;
        }
        active.appendChild(controlsDiv);
    }

    
    if (display.length === 0) active.innerHTML += `<p class="text-[8px] text-slate-600 font-black uppercase italic text-center py-4">No Active Fixtures</p>`;
    
    display.forEach(m => {
        const h = state.players.find(p => p.id === m.homeId);
        const a = state.players.find(p => p.id === m.awayId);
        const isSelected = state.selectedMatches.has(m.id);
        const borderClass = state.bulkMode ? (isSelected ? 'moving-border-gold' : 'moving-border') : 'moving-border-emerald';
        
        const card = document.createElement('div');
        card.className = `${borderClass} p-[1px] rounded-[1.6rem] mb-4 w-full max-w-[340px] mx-auto shadow-xl transition-transform ${state.bulkMode ? 'cursor-pointer' : 'active:scale-95'}`;
        
        card.onclick = () => { if (state.bulkMode) toggleMatchSelection(m.id);
            else openResultEntry(m.id); };
        
        // --- NEW DISPLAY LOGIC: Shows Round Number ---
        let innerHTML = `
            <div class="bg-slate-900 p-4 rounded-[1.5rem] h-full relative z-10">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[7px] ${isSelected ? 'text-gold-500' : 'text-slate-500'} font-black uppercase transition-colors">${m.scheduledDate || 'NO DATE'}</span>
                    <span class="text-[7px] text-blue-400 font-black uppercase">PH-${m.phase} • R-${m.round || 1}</span>
                </div>
                
                <div class="flex justify-between items-center gap-2">
                    <div class="flex items-center gap-2 flex-1 overflow-hidden">
                        ${getAvatarUI(h, "w-8", "h-8")}
                        <span class="text-[10px] font-bold text-white truncate">${h?.name || "TBD"}</span>
                    </div>
                    <span class="text-[8px] font-black text-slate-700 italic">VS</span>
                    <div class="flex items-center gap-2 flex-1 justify-end overflow-hidden">
                        <span class="text-[10px] font-bold text-white truncate text-right">${a?.name || "TBD"}</span>
                        ${getAvatarUI(a, "w-8", "h-8")}
                    </div>
                </div>`;
        
        if (state.bulkMode && isSelected) {
            innerHTML += `<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"><div class="w-8 h-8 bg-gold-500 rounded-full flex items-center justify-center shadow-lg animate-pop-in"><i data-lucide="check" class="w-5 h-5 text-black"></i></div></div>`;
        }
       if (state.isAdmin && !state.bulkMode) {
    // 1. Get FULL names (removed the .split logic)
    const hName = h ? h.name : 'HOME';
    const aName = a ? a.name : 'AWAY';

    innerHTML += `
    <div class="mt-4 pt-3 border-t border-white/5 flex gap-2">
        <button onclick="event.stopPropagation(); openSMS('${m.id}', 'home')" 
            class="flex-1 py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all overflow-hidden">
            <i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i> 
            <span class="truncate">${hName}</span>
        </button>
        
        <button onclick="event.stopPropagation(); openSMS('${m.id}', 'away')" 
            class="flex-1 py-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all overflow-hidden">
            <i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i> 
            <span class="truncate">${aName}</span>
        </button>
    </div>`;
}

        innerHTML += `</div>`;
        card.innerHTML = innerHTML;
        active.appendChild(card);
    });
    
    // Recent Results Logic (No Changes needed here)
    const playedMatches = state.matches.filter(m => m.status === 'played').sort((a, b) => b.id.localeCompare(a.id));
    playedMatches.slice(0, 5).forEach(m => recent.appendChild(createMatchResultCard(m)));
    if (playedMatches.length > 5) recent.innerHTML += `<div class="w-full text-center mt-4"><button onclick="openFullHistory()" class="px-6 py-3 bg-white/5 border border-white/5 text-slate-400 text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-white/10 transition-all">View All Results (${playedMatches.length})</button></div>`;
    if (playedMatches.length === 0) recent.innerHTML = `<p class="text-[8px] text-slate-600 font-black uppercase italic text-center">No matches played yet</p>`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}




// Replace the entire createMatchResultCard function with this:
function createMatchResultCard(m) {
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);
    
    // 1. FIND SUBMITTER FULL NAME
    let submitterLabel = ""; 
    if (m.submittedBy) {
        if (m.submittedBy === 'ADMIN') {
            submitterLabel = "By ADMIN";
        } else {
            const p = state.players.find(x => x.id === m.submittedBy);
            // CHANGED: Removed .split(' ')[0] to show FULL NAME
            submitterLabel = p ? `By ${p.name}` : "By Unknown";
        }
    }

    const div = document.createElement('div');
    div.className = "bg-slate-900/40 p-3 rounded-2xl flex justify-between items-center border border-white/5 mb-2 w-full max-w-[340px] mx-auto opacity-70 relative group";
    
    div.innerHTML = `
        <span class="text-[9px] font-bold text-white truncate w-20">${h?.name || "TBD"}</span>
        
        <div class="flex flex-col items-center justify-center w-20">
            <span class="text-xs font-black text-emerald-400 leading-none">${m.score ? m.score.h : '0'}-${m.score ? m.score.a : '0'}</span>
            <span class="text-[6px] text-slate-600 font-bold uppercase mt-1">PH-${m.phase}</span>
            
            ${submitterLabel ? `<span class="text-[5px] text-gold-500 font-black uppercase tracking-wider mt-0.5 truncate max-w-[70px] block">${submitterLabel}</span>` : ''}
        </div>

        <span class="text-[9px] font-bold text-white truncate w-20 text-right">${a?.name || "TBD"}</span>
    `;

    if (state.isAdmin) {
        const controls = document.createElement('div');
        controls.className = "absolute -right-2 -top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20";
        controls.innerHTML = `
            <button onclick="openResultEntry('${m.id}')" class="p-1.5 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-500 transition-colors"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
            <button onclick="askDeleteResult('${m.id}')" class="p-1.5 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-500 transition-colors"><i data-lucide="trash" class="w-3 h-3"></i></button>
        `;
        div.appendChild(controls);
    }

    return div;
}

// Function to open the separate "page"
function openFullHistory() {
    // Hide all main views
    document.querySelectorAll('section[id^="view-"]').forEach(el => el.classList.add('hidden'));
    
    // Show the specific history view
    const historyView = document.getElementById('view-all-matches');
    const container = document.getElementById('full-match-history-list');
    
    if(historyView && container) {
        historyView.classList.remove('hidden');
        container.innerHTML = ''; // Clear previous
        
        // Render ALL matches here
        const allPlayed = state.matches
            .filter(m => m.status === 'played')
            .sort((a,b) => b.id.localeCompare(a.id));
            
        allPlayed.forEach(m => {
            const card = createMatchResultCard(m);
            card.classList.remove('opacity-70');
            card.classList.add('bg-slate-900');
            container.appendChild(card);
        });
    }
}

function renderNewsTicker() {
    const container = document.getElementById('ticker-content');
    if (!container) return;

    // 1. SPONSOR CHECK (Overrides everything else)
    if (state.sponsorMessage && state.sponsorMessage.trim() !== "") {
        const sponsorHtml = `
            <div class="moving-border-gold p-[1px] rounded-full flex-shrink-0">
                <div class="news-pill-content relative z-10">
                    <i data-lucide="megaphone" class="w-3 h-3 text-gold-500"></i>
                    <span class="text-[9px] font-black uppercase text-gold-500 tracking-wider">${state.sponsorMessage}</span>
                </div>
            </div>`;
        
        // Repeat the message 5 times to ensure the track is long enough to loop seamlessly
        injectTickerContent(container, Array(5).fill(sponsorHtml).join(''));
        return; 
    }

    let newsItems = [];

    // 2. HEADLINE: Phase Status
    newsItems.push({
        text: `STATUS: PHASE ${state.activePhase} LIVE`,
        type: 'emerald', 
        icon: 'activity'
    });

    // 3. HEADLINE: Top Player (Leader)
    const topPlayer = [...state.players].sort((a, b) => b.bounty - a.bounty)[0];
    if (topPlayer) {
        newsItems.push({
            text: `LEADER: ${topPlayer.name} (${topPlayer.bounty} BP)`,
            type: 'gold',
            icon: 'crown'
        });
    }

    // 4. HEADLINE: Recent Matches (STRICT LIMIT: 5)
    const recent = state.matches
        .filter(m => m.status === 'played')
        .sort((a, b) => b.id.localeCompare(a.id)) // Newest first
        .slice(0, 5); // Take only top 5

    recent.forEach(m => {
        const h = state.players.find(p => p.id === m.homeId)?.name || "Unknown";
        const a = state.players.find(p => p.id === m.awayId)?.name || "Unknown";
        const winner = m.score.h > m.score.a ? h : (m.score.a > m.score.h ? a : "Draw");
        
        let msg = "";
        let color = "blue";
        
        if (winner === "Draw") {
            msg = `${h} ${m.score.h}-${m.score.a} ${a}`;
            color = "slate";
        } else {
            msg = `${winner} DEF. ${winner === h ? a : h} (${m.score.h}-${m.score.a})`;
        }

        newsItems.push({ text: msg, type: color, icon: 'trending-up' });
    });

    // 5. RENDER HTML
    const htmlContent = newsItems.map(item => {
        let borderClass = 'moving-border-blue';
        let textClass = 'text-blue-400';
        
        if (item.type === 'gold') { borderClass = 'moving-border-gold'; textClass = 'text-gold-500'; }
        if (item.type === 'emerald') { borderClass = 'moving-border-emerald'; textClass = 'text-emerald-400'; }
        if (item.type === 'slate') { borderClass = 'moving-border'; textClass = 'text-slate-400'; }

        return `
            <div class="${borderClass} p-[1px] rounded-full flex-shrink-0">
                <div class="news-pill-content relative z-10">
                    <i data-lucide="${item.icon}" class="w-3 h-3 ${textClass}"></i>
                    <span class="text-[9px] font-black uppercase ${textClass} tracking-wider">${item.text}</span>
                </div>
            </div>
        `;
    }).join('');

    injectTickerContent(container, htmlContent);
}

// [NEW HELPER] Handles Duplication & Speed Calculation
function injectTickerContent(container, rawHtml) {
    // A. Double content for seamless loop
    container.innerHTML = rawHtml + rawHtml; 
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // B. Calculate Constant Speed (50px per second)
    const pixelsPerSecond = 50; 
    
    setTimeout(() => {
        const totalWidth = container.scrollWidth;
        const halfWidth = totalWidth / 2;
        const duration = halfWidth / pixelsPerSecond;
        container.style.animationDuration = `${duration}s`;
    }, 50);
}


// --- 10. ADMIN COMMANDS ---

async function bulkAddPlayers() {
    const area = document.getElementById('bulk-names');
    const lines = area.value.split('\n');
    const batch = db.batch();
    for (const name of lines) {
        const clean = name.replace('@', '').trim();
        if (clean) {
            const uid = `S${Math.floor(Math.random()*90+10)}L${Math.floor(Math.random()*90+10)}C${Math.floor(Math.random()*90+10)}`;
            batch.set(db.collection("players").doc(uid), { id: uid, name: clean, bounty: 500, mp: 0, wins: 0, draws: 0, losses: 0, p2High: 0, p2Std: 0 });
        }
    }
    await batch.commit();
    area.value = ''; notify("Bulk Recruited!", "users");
}

// --- REPLACE ENTIRE renderAdminList FUNCTION ---
function renderAdminList() {
    const l = document.getElementById('admin-players-list'); if(!l) return; l.innerHTML = '';
    state.players.forEach(p => { 
        l.innerHTML += `
            <div class="p-4 bg-white/5 rounded-2xl flex justify-between items-center text-[10px] font-bold mb-2">
                <div class="flex items-center gap-3">
                    <span onclick="copyToClipboard('${p.id}')" class="cursor-pointer hover:text-emerald-400 transition-colors flex items-center gap-2">
                        ${p.name} <span class="text-slate-500 text-[8px] tracking-wider">(${p.id})</span>
                        <i data-lucide="copy" class="w-3 h-3 text-slate-600"></i>
                    </span>
                </div>
                <span onclick="deleteP('${p.id}')" class="text-rose-500 cursor-pointer bg-rose-500/10 px-2 py-1 rounded-lg hover:bg-rose-500/20 transition-all">DELETE</span>
            </div>`; 
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}


async function deleteP(id) { askConfirm("Delete player?", async () => await db.collection("players").doc(id).delete()); }
async function setGlobalMatchDate() { const d = document.getElementById('admin-active-date-input').value; if(d) await db.collection("settings").doc("global").set({ activeDate: d }, {merge:true}); notify("Date Updated!"); }
async function updateMatchSchedule(mid) { const d = document.getElementById('res-date').value; const dl = document.getElementById('res-deadline').value; await db.collection("matches").doc(mid).update({ scheduledDate: d, deadline: dl }); closeModal('modal-result'); }
async function askFactoryReset() { askConfirm("WIPE CLOUD?", async () => { const p = await db.collection("players").get(); p.forEach(d => d.ref.delete()); const m = await db.collection("matches").get(); m.forEach(d => d.ref.delete()); notify("Reset!"); }); }

// --- 11. NAVIGATION ---
// [UPDATED] switchTab: Fixed 'Arena' navigation stuck issue
function switchTab(id) {
    // 1. UPDATED LIST: Replaced 'broker' with 'arena'
    const tabs = ['home', 'schedule', 'arena', 'elite', 'settings', 'rules', 'all-matches'];
    
    tabs.forEach(v => {
        const view = document.getElementById(`view-${v}`);
        const nav = document.getElementById(`nav-${v}`);
        
        // Hide the view
        if (view) view.classList.add('hidden');
        
        // Deactivate the nav icon
        if (nav) nav.classList.replace('text-emerald-500', 'text-slate-500');
    });

    const activeView = document.getElementById(`view-${id}`);
    const activeNav = document.getElementById(`nav-${id}`);
    
    // Show the target view
    if (activeView) activeView.classList.remove('hidden');
    // Activate the nav icon
    if (activeNav) activeNav.classList.replace('text-slate-500', 'text-emerald-500');
    
    // 2. UPDATED LOGIC: Trigger 'renderBrokerBoard' when 'arena' is clicked
    if (id === 'arena') renderBrokerBoard();
    if (id === 'settings') renderPlayerDashboard();
    if (id === 'elite') renderEliteBracket();
    if (id === 'schedule') renderSchedule();
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}



function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { localStorage.clear(); location.reload(); }

function checkTournamentWinner() {
    db.collection("settings").doc("global").onSnapshot(doc => {
        if (doc.exists && doc.data().tournamentStatus === 'finished') {
            const champName = doc.data().championName;
            const overlay = document.getElementById('champion-overlay');
            const nameEl = document.getElementById('champion-name');
            if (overlay && overlay.classList.contains('hidden')) {
                nameEl.innerText = champName;
                overlay.classList.remove('hidden');
                triggerFireworks();
            }
        }
    });
}

function triggerFireworks() {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } });
    }, 250);
}

// [NEW FUNCTION] setPhase3Lock: Saves the countdown time to Firebase
async function setPhase3Lock() {
    const t = document.getElementById('admin-p3-time-input').value;
    if(!t) return notify("Select Time First", "alert-circle");
    
    try {
        await db.collection("settings").doc("global").set({ 
            phase3UnlockTime: t 
        }, {merge: true});
        notify("Countdown Timer Set!", "clock");
    } catch(e) {
        notify("Error saving timer", "x-circle");
    }
}

// [NEW FUNCTION] clearPhase3Lock: Removes the countdown timer
async function clearPhase3Lock() {
    askConfirm("Stop & Clear Phase 3 Timer?", async () => {
        try {
            // Update Firebase to remove the time (set to null)
            await db.collection("settings").doc("global").set({ 
                phase3UnlockTime: null 
            }, {merge: true});
            
            // Clear the input field visually
            const input = document.getElementById('admin-p3-time-input');
            if(input) input.value = "";

            notify("Timer Cancelled!", "trash");
        } catch(e) {
            console.error(e);
            notify("Error clearing timer", "x-circle");
        }
    });
}


// [NEW] revertMatchStats: Reverses points so we can edit cleanly
async function revertMatchStats(m) {
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);
    if (!h || !a) return;

    let hBP = 0, aBP = 0;
    
    // Calculate what needs to be subtracted
    if (m.resultDelta) {
        // Use exact saved delta if available
        hBP = -m.resultDelta.h;
        aBP = -m.resultDelta.a;
    } else {
        // Fallback Reversal Calculation
        const sH = m.score.h;
        const sA = m.score.a;
        
        if (m.phase === 1) {
             if (sH > sA) { hBP = -100; aBP = 50; } 
             else if (sA > sH) { hBP = 50; aBP = -100; } 
             else { hBP = 30; aBP = 30; }
        } else if (m.phase === 2) {
             const rate = m.stakeRate || 15;
             const pool = Math.floor((h.bounty + a.bounty) * (rate / 100));
             if (sH > sA) { hBP = -pool; aBP = pool; }
             else if (sA > sH) { hBP = pool; aBP = -pool; }
             else { hBP = 30; aBP = 30; }
        } else if (m.phase === 3) {
             if (sH > sA) { hBP = -300; aBP = 250; }
             else if (sA > sH) { hBP = 250; aBP = -300; }
        }
    }

    const batch = db.batch();
    // Reverse Home
    batch.update(db.collection("players").doc(h.id), {
        bounty: firebase.firestore.FieldValue.increment(hBP),
        mp: firebase.firestore.FieldValue.increment(-1),
        wins: firebase.firestore.FieldValue.increment(m.score.h > m.score.a ? -1 : 0),
        draws: firebase.firestore.FieldValue.increment(m.score.h === m.score.a ? -1 : 0),
        losses: firebase.firestore.FieldValue.increment(m.score.h < m.score.a ? -1 : 0)
    });
    // Reverse Away
    batch.update(db.collection("players").doc(a.id), {
        bounty: firebase.firestore.FieldValue.increment(aBP),
        mp: firebase.firestore.FieldValue.increment(-1),
        wins: firebase.firestore.FieldValue.increment(m.score.a > m.score.h ? -1 : 0),
        draws: firebase.firestore.FieldValue.increment(m.score.a === m.score.h ? -1 : 0),
        losses: firebase.firestore.FieldValue.increment(m.score.a < m.score.h ? -1 : 0)
    });
    await batch.commit();
}

// [NEW] askDeleteResult: Admin command to delete a result
async function askDeleteResult(mid) {
    askConfirm("Delete result? Stats will revert.", async () => {
        const m = state.matches.find(x => x.id === mid);
        if (!m) return;
        try {
            await revertMatchStats(m); // 1. Revert stats first
            // 2. Reset match to 'scheduled'
            await db.collection("matches").doc(mid).update({
                status: 'scheduled',
                score: firebase.firestore.FieldValue.delete(),
                winnerId: firebase.firestore.FieldValue.delete(),
                resultDelta: firebase.firestore.FieldValue.delete()
            });
            notify("Result Deleted", "trash");
        } catch (e) { notify("Error deleting", "x-circle"); }
    });
}

// [NEW] setSponsorMessage: Updates the global sponsor text
async function setSponsorMessage() {
    const input = document.getElementById('admin-sponsor-input');
    if (!input) return;
    
    const msg = input.value;
    
    try {
        await db.collection("settings").doc("global").set({ 
            sponsorMessage: msg 
        }, {merge: true});
        
        if (msg) {
            notify("Sponsor Message Live!", "megaphone");
        } else {
            notify("News Feed Restored!", "rotate-ccw");
        }
    } catch(e) {
        console.error(e);
        notify("Error updating ticker", "x-circle");
    }
}

// [REPLACEMENT] openSMS: Added Round Number, Portal Link & 12H Time
function openSMS(matchId, target) {
    const m = state.matches.find(x => x.id === matchId);
    if (!m) return notify("Match not found", "x-circle");

    // 1. Identify Players
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);

    if (!h || !a) return notify("Player data missing", "alert-circle");

    // 2. Determine Recipient & Opponent
    const recipient = target === 'away' ? a : h;
    const opponent  = target === 'away' ? h : a;

    // 3. Validate Recipient Phone
    if (!recipient.phone) return notify(`${recipient.name} has no phone #`, "phone-off");

    // 4. Formatting Helpers (Time & Date)
    let deadlineTime = "11:59 PM";
    
    if (m.deadline) {
        // Convert to Bangladesh Time (12-hour format)
        deadlineTime = new Date(m.deadline).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Dhaka',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    const dateStr = m.scheduledDate || "TBA";
    
    // Handle Round Number (Defaults to 'Standard' if not set, e.g. in Phase 2)
    const roundLabel = m.round ? `Round ${m.round}` : "Fixture";

    // 5. Construct Message
    const msg = 
`OFFICIAL SLC FIXTURE NOTICE

Attention ${recipient.name.toUpperCase()},

Your Phase 0${m.phase} (${roundLabel}) match against ${opponent.name.toUpperCase()} has been officially scheduled for ${dateStr}.
This fixture is active immediately and carries a strict deadline of ${deadlineTime}.

PROTOCOL REQUIREMENTS:
1. Login to the SLC Portal immediately.
2. Verify your opponent's SLC-ID.
3. Submit the final scoreline before the deadline.

PORTAL LINK:
https://merazbinmizanur.github.io/slc-tournament

Your verification ID is ${recipient.id}.
- SLC OPERATIONS`;

    // 6. Open SMS App
    window.open(`sms:${recipient.phone}?body=${encodeURIComponent(msg)}`, '_self');
}


// [REPLACEMENT] openEditProfile: Pre-fills Name, Phone, and Avatar
function openEditProfile() {
    const rawID = localStorage.getItem('slc_user_id');
    const p = state.players.find(x => x.id === rawID);
    
    if (!p) return notify("Profile data not found", "x-circle");
    
    // 1. Pre-fill existing data
    document.getElementById('edit-name').value = p.name || ""; // NEW
    document.getElementById('edit-phone').value = p.phone || "";
    document.getElementById('edit-avatar').value = p.avatar || "";
    
    // 2. Show Modal
    document.getElementById('modal-edit-profile').classList.remove('hidden');
}

// [REPLACEMENT] saveProfileChanges: Validates and Updates Name in Database
async function saveProfileChanges() {
    const rawID = localStorage.getItem('slc_user_id');
    
    // 1. Get Values
    const newName = document.getElementById('edit-name').value.trim(); // NEW
    const newPhone = document.getElementById('edit-phone').value.trim();
    const newAvatar = document.getElementById('edit-avatar').value.trim();

    // 2. Validation
    if (!newName) return notify("Name cannot be empty", "alert-circle");
    if (!newPhone) return notify("Phone number required", "alert-circle");

    try {
        // 3. Update Database
        // Changing the name here automatically updates it across the Leaderboard, Schedule, etc.
        await db.collection("players").doc(rawID).update({
            name: newName,
            phone: newPhone,
            avatar: newAvatar
        });

        notify("Identity Updated Successfully!", "check-circle");
        document.getElementById('modal-edit-profile').classList.add('hidden');
        renderPlayerDashboard(); // Refresh UI immediately
        
    } catch (e) {
        console.error(e);
        notify("Update Failed", "x-circle");
    }
}


// --- BOUNTY SHOP ENGINE ---

function renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    if (!me) return; // Not logged in

    // Initialize inventory if missing
    const inv = me.inventory || {};
    const active = me.active_effects || {};

    Object.keys(SHOP_ITEMS).forEach(key => {
        const item = SHOP_ITEMS[key];
        const isOwned = (inv[key] || 0) > 0;
        const isActive = active[key] || (key === 'vault_access' && me.vault_data?.amount > 0);
        
        // Determine Button State
        let btnText = "PURCHASE";
        let btnClass = "bg-transparent text-slate-500 border border-slate-700";
        let statusIcon = "";

        if (isActive) {
            btnText = "ACTIVE";
            btnClass = "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 cursor-default";
            statusIcon = `<div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>`;
        } else if (isOwned) {
            btnText = "ACTIVATE";
            btnClass = "bg-white text-slate-900 font-black shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse-slow";
        }

        // Card HTML
        const card = document.createElement('div');
        card.className = `relative group cursor-pointer active:scale-95 transition-all`;
        card.onclick = () => openShopItem(key);

        card.innerHTML = `
            <div class="${item.border} p-[1px] rounded-[1.2rem] h-full">
                <div class="bg-slate-900 rounded-[1.1rem] p-3 h-full flex flex-col items-center justify-between relative z-10">
                    ${statusIcon}
                    <div class="mb-2 p-2 bg-slate-950 rounded-full border border-white/5">
                        <i data-lucide="${item.icon}" class="w-4 h-4 ${item.color}"></i>
                    </div>
                    <div class="text-center mb-2">
                        <h4 class="text-[9px] font-black text-white uppercase tracking-wider">${item.name}</h4>
                        <p class="text-[8px] font-bold text-gold-500">${item.price} BP</p>
                    </div>
                    <button class="w-full py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${btnClass}">
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

let selectedShopItem = null;

function openShopItem(key) {
    selectedShopItem = key;
    const item = SHOP_ITEMS[key];
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    
    // Populate Modal
    document.getElementById('shop-modal-title').innerText = item.name;
    document.getElementById('shop-modal-price').innerText = `${item.price} BP`;
    document.getElementById('shop-modal-desc').innerText = item.desc;
    document.getElementById('shop-modal-restrict').innerText = item.restriction;
    
    // Icon Setup
    const iconContainer = document.getElementById('shop-modal-icon');
    iconContainer.innerHTML = `<i data-lucide="${item.icon}" class="w-6 h-6 ${item.color}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Logic for Button Action
    const btn = document.getElementById('btn-shop-action');
    const inv = me?.inventory || {};
    const active = me?.active_effects || {};
    const isOwned = (inv[key] || 0) > 0;
    const isActive = active[key];

    if (key === 'vault_access' && me?.vault_data?.amount > 0) {
        btn.innerText = "VAULT LOCKED";
        btn.onclick = () => notify("Vault is currently sealed.", "lock");
        btn.className = "flex-1 py-3 bg-slate-700 text-slate-400 text-[9px] font-black rounded-xl uppercase tracking-widest cursor-not-allowed";
    } else if (isActive) {
        btn.innerText = "ALREADY ACTIVE";
        btn.onclick = null;
        btn.className = "flex-1 py-3 bg-emerald-900/50 text-emerald-500 text-[9px] font-black rounded-xl uppercase tracking-widest cursor-not-allowed";
    } else if (isOwned) {
        btn.innerText = "ACTIVATE NOW";
        btn.onclick = () => key === 'vault_access' ? openVaultModal() : activateShopItem(key);
        btn.className = "flex-1 py-3 bg-white text-slate-900 text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg";
    } else {
        btn.innerText = `PURCHASE (-${item.price})`;
        btn.onclick = () => buyShopItem(key);
        btn.className = "flex-1 py-3 bg-emerald-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg";
    }

    document.getElementById('modal-shop-details').classList.remove('hidden');
}

async function buyShopItem(key) {
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    const item = SHOP_ITEMS[key];

    if (me.bounty < item.price) return notify("Insufficient Funds", "alert-circle");
    
    try {
        const batch = db.batch();
        const ref = db.collection("players").doc(myID);
        
        // Deduct Price
        batch.update(ref, { bounty: firebase.firestore.FieldValue.increment(-item.price) });
        // Add to Inventory
        batch.update(ref, { [`inventory.${key}`]: 1 });
        
        await batch.commit();
        notify(`${item.name} Purchased!`, "shopping-bag");
        document.getElementById('modal-shop-details').classList.add('hidden');
    } catch (e) { notify("Transaction Failed", "x-circle"); }
}

async function activateShopItem(key) {
    const myID = localStorage.getItem('slc_user_id');
    try {
        const batch = db.batch();
        const ref = db.collection("players").doc(myID);
        
        // Remove from Inventory
        batch.update(ref, { [`inventory.${key}`]: 0 });
        // Add to Active Effects
        batch.update(ref, { [`active_effects.${key}`]: true });
        
        await batch.commit();
        notify(`${SHOP_ITEMS[key].name} Activated!`, "check-circle");
        document.getElementById('modal-shop-details').classList.add('hidden');
    } catch (e) { notify("Activation Error", "x-circle"); }
}

// --- VAULT SPECIFIC LOGIC ---
function openVaultModal() {
    document.getElementById('modal-shop-details').classList.add('hidden');
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    
    const maxDeposit = Math.floor(me.bounty * 0.25);
    document.getElementById('vault-max-display').innerText = `${maxDeposit} BP`;
    document.getElementById('vault-input').max = maxDeposit;
    document.getElementById('modal-vault').classList.remove('hidden');
}

async function depositToVault() {
    const amount = parseInt(document.getElementById('vault-input').value);
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    const max = Math.floor(me.bounty * 0.25);

    if (!amount || amount <= 0) return notify("Enter valid amount", "alert-circle");
    if (amount > max) return notify(`Max limit is ${max} BP`, "alert-triangle");

    try {
        const batch = db.batch();
        const ref = db.collection("players").doc(myID);
        
        // 1. Consume the Access Item
        batch.update(ref, { [`inventory.vault_access`]: 0 });
        
        // 2. Move Funds
        batch.update(ref, { bounty: firebase.firestore.FieldValue.increment(-amount) });
        
        // 3. Set Vault Data
        const expires = Date.now() + (4 * 24 * 60 * 60 * 1000); // 4 Days
        batch.update(ref, { 
            vault_data: {
                amount: amount,
                depositedAt: Date.now(),
                expiresAt: expires
            } 
        });

        await batch.commit();
        notify(`${amount} BP Locked in Vault!`, "lock");
        document.getElementById('modal-vault').classList.add('hidden');
    } catch (e) { notify("Vault Error", "x-circle"); }
}

async function checkVaultStatus() {
    const myID = localStorage.getItem('slc_user_id');
    if (!myID) return;
    
    // We need to fetch fresh data to be safe, but state.players is usually synced
    const me = state.players.find(p => p.id === myID);
    if (me && me.vault_data && me.vault_data.amount > 0) {
        if (Date.now() > me.vault_data.expiresAt) {
            // EXPIRED - RETURN FUNDS
            try {
                const batch = db.batch();
                const ref = db.collection("players").doc(myID);
                
                batch.update(ref, { bounty: firebase.firestore.FieldValue.increment(me.vault_data.amount) });
                batch.update(ref, { vault_data: firebase.firestore.FieldValue.delete() });
                
                await batch.commit();
                notify("Vault Unlocked: Funds Returned", "unlock");
            } catch (e) { console.error("Vault Return Error", e); }
        }
    }
}

// --- SCOUT LOGIC ---
async function useScout(targetId) {
    const t = state.players.find(p => p.id === targetId);
    if (!t) return;

    // 1. Gather Intelligence
    const winRate = t.mp > 0 ? Math.floor((t.wins / t.mp) * 100) : 0;
    
    // 2. Display Report (Using standard Alert for simplicity, or Notify)
    // Formatting a clean report
    const reportMsg = `
[ SCOUT REPORT: ${t.name.toUpperCase()} ]
--------------------------------
• Win Rate:      ${winRate}%
• Total Matches: ${t.mp}
• Record:        ${t.wins}W - ${t.draws}D - ${t.losses}L
• Current BP:    ${t.bounty}
• P2 Contracts:  High(${t.p2High || 0}/3) | Std(${t.p2Std || 0}/2)
--------------------------------
Confirming challenge is now safer.
`;
    
    alert(reportMsg); // Show info to user immediately

    // 3. Consume the Item from Database
    const myID = localStorage.getItem('slc_user_id');
    try {
        await db.collection("players").doc(myID).update({
            "active_effects.scout": false
        });
        notify("Scout Report Complete. Item Consumed.", "check-circle");
        renderBrokerBoard(); // Refresh UI to remove the button
    } catch(e) {
        console.error(e);
        notify("Error consuming item", "x-circle");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

// 1. GENERATE THE PREVIEW
function showStandingsPreview() {
  const previewArea = document.getElementById('preview-content-area');
  const sortedPlayers = [...state.players].sort((a, b) => b.bounty - a.bounty);
  
  let tableRows = sortedPlayers.map((p, i) => `
        <tr>
            <td class="export-rank">#${i + 1}</td>
            <td style="color:white; text-transform:uppercase; font-size:11px;">${p.name}</td>
            <td class="export-stat">${p.mp || 0}</td>
            <td class="export-stat">${p.wins || 0}</td>
            <td class="export-stat">${p.draws || 0}</td>
            <td class="export-stat">${p.losses || 0}</td>
            <td class="export-bp">${(p.bounty || 0).toLocaleString()}</td>
        </tr>
    `).join('');
  
  previewArea.innerHTML = `
        <div class="export-card" id="capture-zone">
            <div class="export-header">
                <p style="color: #10b981; font-size: 8px; font-weight: 900; letter-spacing: 5px; margin-bottom: 5px;">SYNTHEX LEGION CHRONICLES</p>
                <h1 style="color: white; font-size: 18px; font-weight: 900; margin: 0; letter-spacing: -0.5px;">BOUNTY STANDINGS</h1>
                <div style="width: 40px; h: 2px; background: #f59e0b; margin: 10px auto;"></div>
                <p style="color: #475569; font-size: 7px; text-transform: uppercase;">Generated: ${new Date().toLocaleDateString()} | System Stable</p>
            </div>
            <table class="export-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Hunter</th>
                        <th style="text-align:center">M</th>
                        <th style="text-align:center">W</th>
                        <th style="text-align:center">D</th>
                        <th style="text-align:center">L</th>
                        <th style="text-align:right">BP</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <div style="margin-top: 30px; text-align: center; color: #1e293b; font-size: 6px; letter-spacing: 2px; font-weight: 900; text-transform: uppercase;">
                Official SLC Tournament Operating System v3.0.1
            </div>
        </div>
    `;
  
  openModal('modal-download-preview');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// [UPDATED] executeDownload: Mobile-Safe Rendering & Detailed Error Logging
async function executeDownload() {
    const sourceElement = document.getElementById('capture-zone');
    const exportContainer = document.getElementById('export-container');

    // 1. Critical System Checks
    if (!sourceElement) return notify("Error: Preview Content Missing", "alert-circle");
    if (!exportContainer) return notify("System Error: Export Container Missing", "alert-circle");
    
    notify("Generating Image...", "download");

    try {
        // 2. Prepare the Container
        exportContainer.innerHTML = ''; 
        
        // 3. Clone and Setup
        const clone = sourceElement.cloneNode(true);
        
        // Force styles to ensure it looks right even when invisible
        clone.style.margin = "0";
        clone.style.width = "100%"; 
        clone.style.height = "auto";
        clone.style.borderRadius = "0"; 
        clone.style.boxShadow = "none";
        clone.style.background = "#020617"; // Ensure background isn't transparent
        
        exportContainer.appendChild(clone);
        
        // 4. Mobile Render Delay
        // Wait 350ms to ensure the hidden DOM is fully painted by the mobile browser
        await new Promise(resolve => setTimeout(resolve, 350));

        // 5. Capture
        const canvas = await html2canvas(clone, {
            useCORS: true,        // Critical for loading profile images
            allowTaint: false,    // Security flag
            backgroundColor: "#020617", 
            scale: 2,             // 2x Quality
            width: 600,           // Lock width to container
            height: clone.scrollHeight + 20, // Add slight buffer to height
            logging: true,        // Enable logs for debugging
            windowWidth: 1200     // Trick CSS into thinking it's desktop
        });

        // 6. Save
        const image = canvas.toDataURL("image/png", 0.9);
        const link = document.createElement('a');
        
        const timestamp = new Date().toLocaleTimeString().replace(/:/g, "-");
        link.download = `SLC-Standings-${timestamp}.png`;
        link.href = image;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // 7. Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            exportContainer.innerHTML = ''; 
            closeModal('modal-download-preview');
            notify("Saved to Device!", "check-circle");
        }, 500);

    } catch (err) {
        console.error("Download Error:", err);
        // This will now show the REAL error message on your screen
        notify(`Failed: ${err.message || "Unknown Error"}`, "x-circle");
    }
}
// --- NEW FEATURE: SCHEDULE EXPORT GENERATOR ---
function showSchedulePreview() {
    // 1. Find matches that have BOTH a Date and a Deadline set
    const validMatches = state.matches
        .filter(m => m.status === 'scheduled' && m.scheduledDate && m.deadline)
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.deadline.localeCompare(b.deadline));

    if (validMatches.length === 0) return notify("Set Dates & Deadlines first!", "alert-circle");

    // 2. Generate Header Text
    const uniqueDates = [...new Set(validMatches.map(m => m.scheduledDate))];
    const headerDate = uniqueDates.length === 1 ? uniqueDates[0] : "UPCOMING FIXTURES";

    // 3. Create Rows HTML
    const rows = validMatches.map(m => {
        const h = state.players.find(p => p.id === m.homeId);
        const a = state.players.find(p => p.id === m.awayId);
        
        // Extract Time from Deadline (e.g., "2024-02-10T23:00" -> "23:00")
        const deadlineTime = m.deadline.split('T')[1] || "23:59";
        
        return `
        <div class="schedule-export-row">
            <div class="schedule-players">
                <div class="schedule-p">
                    ${getAvatarUI(h, "w-10", "h-10")}
                    <span>${h?.name.split(' ')[0] || "TBD"}</span>
                </div>
                <div class="schedule-vs">VS</div>
                <div class="schedule-p">
                    ${getAvatarUI(a, "w-10", "h-10")}
                    <span>${a?.name.split(' ')[0] || "TBD"}</span>
                </div>
            </div>
            <div class="schedule-info">
                <span class="schedule-badge">Matchday</span>
                <span class="schedule-badge" style="color:#10b981; margin-top:2px;">Deadline: <b class="schedule-highlight">${deadlineTime}</b></span>
            </div>
        </div>`;
    }).join('');

    // 4. Build the Full Export Card
    const html = `
    <div class="export-card" id="capture-zone">
        <div class="export-header">
            <p style="color: #10b981; font-size: 8px; font-weight: 900; letter-spacing: 4px; margin-bottom: 5px;">SYNTHEX LEGION CHRONICLES</p>
            <h1 style="color: white; font-size: 16px; font-weight: 900; margin: 0; letter-spacing: 1px; text-transform:uppercase;">OFFICIAL SCHEDULE</h1>
            <p style="color: #f59e0b; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-top:5px;">${headerDate}</p>
            <div style="width: 40px; height: 2px; background: #334155; margin: 10px auto;"></div>
        </div>
        
        <div class="schedule-export-grid">
            ${rows}
        </div>

        <div style="margin-top: 25px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
             <p style="color: #64748b; font-size: 7px; text-transform: uppercase; font-weight: bold; margin-bottom:5px;">OFFICIAL TOURNAMENT MATCHDAY SCHEDULE</p>
             <p style="color: #94a3b8; font-size: 7px; max-width: 90%; margin: 0 auto; line-height: 1.5;">
                Fixtures must be completed by the <b style="color: #f59e0b;">BOLD DEADLINE</b> shown above. 
                <br>Results not reported by the deadline may be subject to Admin Adjudication.
             </p>
        </div>
    </div>`;

    // 5. Render to Modal
    const previewArea = document.getElementById('preview-content-area');
    if(previewArea) {
        previewArea.innerHTML = html;
        openModal('modal-download-preview');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

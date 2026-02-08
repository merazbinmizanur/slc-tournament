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
const ADMIN_KEY = "001100";
const P2_LIMIT_HIGH = 3;
const P2_LIMIT_STD = 2;
const STARTING_BOUNTY = 500;
const BETTING_MAX_STAKE_PERCENT = 0.20; // 20% Limit
const BETTING_ODDS_CAP = 2.50; // Max Odds 2.5x
const PASS_CONFIG = {
    standard: { cost: 100, rebate: 10, totalRounds: 10 },
    premium: { cost: 200, rebate: 20, totalRounds: 10 }
};

const PASS_REWARDS = {
    standard: [
        { type: 'item', id: 'scout' }, { type: 'bp' }, { type: 'bp' }, { type: 'bp' },
        { type: 'item', id: 'privacy' }, { type: 'bp' }, { type: 'bp' }, { type: 'bp' },
        { type: 'bp' }, { type: 'item', id: 'multiplier' }
    ],
    premium: [
        { type: 'item', id: 'insurance' }, { type: 'bp' }, { type: 'item', id: 'scout' }, 
        { type: 'bp' }, { type: 'badge', id: 'Elite Raider' }, { type: 'item', id: 'privacy' },
        { type: 'bp' }, { type: 'item', id: 'multiplier' }, { type: 'bp' }, { type: 'vault' }
    ]
};

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
    matchAlertShown: false,
    selectedMatches: new Set(),
    bettingActive: true,
    myBets: new Set()
};
let confirmCallback = null;
let alertInterval = null; 

// --- 2. CORE UTILITY ENGINES ---

/**
 * Avatar Generator Engine
 * Returns HTML for Image if available, otherwise Initials
 */
 // --- NEW HELPER: CALCULATE WIN STREAK ---
function calculateWinStreak(playerId) {
    // 1. Get all played matches for this player
    const played = state.matches.filter(m => 
        m.status === 'played' && (m.homeId === playerId || m.awayId === playerId)
    );

    // 2. Sort by ID descending (assuming ID implies time) or use a Date field if available
    // We use ID string comparison for now as per your existing logic
    played.sort((a, b) => b.id.localeCompare(a.id));

    let streak = 0;
    
    // 3. Count backwards from most recent
    for (const m of played) {
        let winnerId = null;
        if (m.score.h > m.score.a) winnerId = m.homeId;
        else if (m.score.a > m.score.h) winnerId = m.awayId;
        
        if (winnerId === playerId) {
            streak++;
        } else {
            // Loss or Draw breaks the streak
            break; 
        }
    }
    return streak;
}

function getAvatarUI(p, w="w-8", h="h-8", text="text-xs") {
    if (!p) return `<div class="${w} ${h} rounded-full bg-slate-800 border border-white/5"></div>`;
    
    const initial = (p.name || "U").charAt(0).toUpperCase();
    const isOnFire = (p.currentStreak || 0) >= 3;
    
    // Check for Pass Status
    const hasStandard = p.passType === 'standard';
    const hasPremium = p.passType === 'premium';
    const passClass = hasPremium ? 'avatar-pass-premium' : (hasStandard ? 'avatar-pass-standard' : '');
    
    // Pass Badge Icon - UPDATED: Standard now shows Silver Crown
    let passIcon = '';
    if (hasPremium) {
        // Gold Crown
        passIcon = `<div class="pass-badge-icon bg-gold-500"><i data-lucide="crown" class="w-[7px] h-[7px] text-slate-950 fill-current"></i></div>`;
    } else if (hasStandard) {
        // Silver Crown
        passIcon = `<div class="pass-badge-icon bg-silver-500"><i data-lucide="crown" class="w-[7px] h-[7px] text-slate-800 fill-current"></i></div>`;
    }

    // Inner Content (Image or Initials)
    let innerContent = '';
    if (p.avatar) {
        innerContent = `
        <img src="${p.avatar}" class="w-full h-full rounded-full object-cover border border-white/10 bg-slate-800 ${passClass}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="w-full h-full rounded-full bg-slate-800 flex items-center justify-center ${text} font-black text-white border border-white/10 hidden absolute inset-0 top-0 left-0 ${passClass}">${initial}</div>`;
    } else {
        innerContent = `<div class="w-full h-full rounded-full bg-slate-800 flex items-center justify-center ${text} font-black text-white border border-white/10 ${passClass}">${initial}</div>`;
    }

    // Wrapper Logic (Preserves existing Flame/Streak UI)
    if (isOnFire) {
        return `
        <div class="${w} ${h} avatar-flame-wrapper flex-shrink-0">
            ${innerContent}
            ${passIcon}
            <div class="streak-fire-badge"><i data-lucide="flame" class="w-2 h-2 fill-orange-500"></i></div>
        </div>`;
    } else {
        return `
        <div class="${w} ${h} relative flex-shrink-0">
            ${innerContent}
            ${passIcon}
        </div>`;
    }
}



/**
 * OFFICIAL RANKING ENGINE
 * Sorting Hierarchy: 
 * 1. Bounty Points (BP)
 * 2. Goal Difference (GD)
 * 3. Goals Scored (GS)
 * 4. Total Wins
 */
function getSmartSortedPlayers() {
    // 1. Calculate Goals Conceded for everyone first
    const concededMap = {};
    state.players.forEach(p => concededMap[p.id] = 0);

    state.matches.forEach(m => {
        if (m.status === 'played' && m.score) {
            // If Home played, they conceded Away's score
            if (concededMap[m.homeId] !== undefined) concededMap[m.homeId] += (parseInt(m.score.a) || 0);
            // If Away played, they conceded Home's score
            if (concededMap[m.awayId] !== undefined) concededMap[m.awayId] += (parseInt(m.score.h) || 0);
        }
    });

    // 2. Create enhanced player objects with GD attached (Non-destructive)
    const enhancedPlayers = state.players.map(p => {
        const conceded = concededMap[p.id] || 0;
        const goals = p.goals || 0;
        const gd = goals - conceded;
        return { ...p, _gd: gd, _conceded: conceded };
    });

    // 3. Execute Multi-Tier Sort
    return enhancedPlayers.sort((a, b) => {
        // Priority 1: Bounty Points (Higher is better)
        const bpDiff = (b.bounty || 0) - (a.bounty || 0);
        if (bpDiff !== 0) return bpDiff;

        // Priority 2: Goal Difference (Higher is better)
        const gdDiff = b._gd - a._gd;
        if (gdDiff !== 0) return gdDiff;

        // Priority 3: Goals Scored (Higher is better)
        const gsDiff = (b.goals || 0) - (a.goals || 0);
        if (gsDiff !== 0) return gsDiff;

        // Priority 4: Total Wins (Higher is better)
        return (b.wins || 0) - (a.wins || 0);
    });
}

/**
 * SANCTION CALCULATOR
 * Returns the penalty percentage based on how many hours late the match is.
 * Rule: 10% per hour late.
 */
function getSanctionPercentage(deadlineISO) {
    if (!deadlineISO) return 0;
    
    const deadline = new Date(deadlineISO).getTime();
    const now = Date.now();
    
    if (now <= deadline) return 0; // Not late
    
    const diffMs = now - deadline;
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60)); // Round up to next hour
    
    // 10% per hour
    return diffHours * 10;
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

// [UPDATED] registerPlayerOnline: Initializes Goals to 0
async function registerPlayerOnline() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const avatar = document.getElementById('reg-avatar').value.trim();

    if (!name || !phone) return notify("Name & Phone required", "alert-circle");
    
    const r = () => Math.floor(Math.random() * 90 + 10);
    const uniqueID = `S${r()}L${r()}C${r()}`;
    
    const newP = { 
        id: uniqueID, 
        name: name, 
        phone: phone, 
        avatar: avatar,
        bounty: STARTING_BOUNTY, 
        goals: 0, // <--- NEW: Init Goals
        mp: 0, wins: 0, draws: 0, losses: 0, 
        p2High: 0, p2Std: 0 
    };
newP.bp_logs = [{
        id: 'init', ts: Date.now(), amount: 500, cat: 'System', desc: 'Welcome Bonus'
    }];
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
    // 1. Core Data Listeners
    db.collection("players").onSnapshot(snapshot => {
        state.players = snapshot.docs.map(doc => doc.data());
        refreshUI();
    });
    db.collection("matches").onSnapshot(snapshot => {
        state.matches = snapshot.docs.map(doc => doc.data());
        refreshUI();
    });
    
    // 2. Global Settings Listener
    db.collection("settings").doc("global").onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            state.viewingDate = data.activeDate;
            state.phase3UnlockTime = data.phase3UnlockTime || null;
            state.sponsorMessage = data.sponsorMessage || "";
            state.bettingActive = data.bettingActive !== false;
            refreshUI();
        }
    });
    
    // 3. Betting Activity Listener (Prevents duplicate bets)
    const myID = localStorage.getItem('slc_user_id');
    if (myID && !localStorage.getItem('slc_admin')) {
        db.collection("bets")
            .where("userId", "==", myID)
            .onSnapshot(snapshot => {
                const betSet = new Set();
                snapshot.docs.forEach(doc => {
                    betSet.add(doc.data().matchId);
                });
                state.myBets = betSet;
                refreshUI(); 
            });
    }

    // 4. Winner Tracking
    checkTournamentWinner();

    // 5. HOUSE POOL REAL-TIME SYNC (The "The House" Economy)
    db.collection("system").doc("pool").onSnapshot(doc => {
        if (doc.exists) {
            const poolData = doc.data();
            const poolEl = document.getElementById('global-pool-amount');
            if (poolEl) {
                // Dynamically updates the UI text with the latest value from Firestore
                poolEl.innerText = (poolData.poolBP || 0).toLocaleString();
            }
        } else {
            // Auto-initialization if document is missing in Firebase
            db.collection("system").doc("pool").set({ poolBP: 0 }, { merge: true });
        }
    });
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

/**
 * PHASE 2: RESPOND TO CHALLENGE
 * Handles the acceptance or decline of a match request.
 * If declined without a pass, 5% of the target's BP is transferred to the challenger.
 */
async function respondToChallenge(matchId, action) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return notify("Match missing", "x-octagon");

    const h = state.players.find(p => p.id === match.homeId); // The Challenger (Hunter)
    const t = state.players.find(p => p.id === match.awayId); // The Target (Requested Player)

    if (action === 'accept') {
        // Validation: Ensure slots are still available before accepting
        if (match.stakeType === 'high' && ((h.p2High || 0) >= 3 || (t.p2High || 0) >= 3)) {
            return notify("Slot Error: Limit reached", "alert-triangle");
        }
        if (match.stakeType === 'std' && ((h.p2Std || 0) >= 2 || (t.p2Std || 0) >= 2)) {
            return notify("Slot Error: Limit reached", "alert-triangle");
        }

        try {
            const batch = db.batch();
            const field = match.stakeType === 'high' ? 'p2High' : 'p2Std';
            
            // Increment match counts for both players
            batch.update(db.collection("players").doc(h.id), { [field]: firebase.firestore.FieldValue.increment(1) });
            batch.update(db.collection("players").doc(t.id), { [field]: firebase.firestore.FieldValue.increment(1) });
            
            // Move match to scheduled status
            batch.update(db.collection("matches").doc(matchId), { status: 'scheduled' });
            
            await batch.commit();
            notify("Contract Scheduled!", "check-circle");
        } catch (e) { 
            console.error(e);
            notify("Sync Failed", "x-circle"); 
        }
    } 
    else {
        // --- UPDATED DECLINE LOGIC: 5% FEE TRANSFERRED TO HUNTER ---
        const activeEff = t.active_effects || {};
        
        // Check if player has a Decline Pass active
        if (activeEff.decline_pass) {
             askConfirm("Use DECLINE PASS to waive penalty?", async () => {
                const batch = db.batch();
                batch.update(db.collection("players").doc(t.id), { "active_effects.decline_pass": false });
                batch.update(db.collection("matches").doc(matchId), { status: 'declined' });
                await batch.commit();
                notify("Declined using Pass (0 BP)", "shield-check");
             });
        } else {
            // Calculate 5% Penalty of the Target's current Bounty
            const penalty = Math.floor(t.bounty * 0.05);
            
            askConfirm(`Refusing pays 5% (${penalty} BP) to ${h.name}. Confirm?`, async () => {
                try {
                    const batch = db.batch();
                    
                    // Mark match as declined
                    batch.update(db.collection("matches").doc(matchId), { status: 'declined' });
                    
                    // Deduct 5% from the Target (t)
                    batch.update(db.collection("players").doc(t.id), { 
                        bounty: firebase.firestore.FieldValue.increment(-penalty) 
                    });
                    
                    // Add 5% to the Challenger (h)
                    batch.update(db.collection("players").doc(h.id), { 
                        bounty: firebase.firestore.FieldValue.increment(penalty) 
                    });
                    
                    await batch.commit();
                    
                    // Log transactions for both players to maintain history
                    logTransaction(t.id, -penalty, 'Fine', `Declined Match from ${h.name}`);
                    logTransaction(h.id, penalty, 'Reward', `${t.name} Paid Decline Fee`);
                    
                    notify(`Match Declined. ${penalty} BP transferred to ${h.name}`, "thumbs-down");
                } catch (e) {
                    console.error(e);
                    notify("Cloud transfer failed", "x-circle");
                }
            });
        }
    }
}


async function buyPass(type) {
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    const cost = PASS_CONFIG[type].cost;
    
    if (me.passType) return notify("Pass already active", "alert-circle");
    if (me.bounty < cost) return notify("Insufficient BP", "lock");
    
    askConfirm(`Purchase ${type.toUpperCase()} Pass for ${cost} BP?`, async () => {
        try {
            const batch = db.batch();
            const playerRef = db.collection("players").doc(myID);
            const statsRef = db.collection("settings").doc("pass_stats"); // Ledger Reference
            const poolRef = db.collection("system").doc("pool");

            // 1. Deduct from Player
            batch.update(playerRef, {
                bounty: firebase.firestore.FieldValue.increment(-cost),
                passType: type,
                passRound: 0,
                passActive: true
            });
            
            [span_0](start_span)// 2. Update Ledger Revenue[span_0](end_span)
            batch.set(statsRef, {
                total_revenue: firebase.firestore.FieldValue.increment(cost)
            }, { merge: true });

            // 3. Update Global House Pool
            batch.set(poolRef, {
                poolBP: firebase.firestore.FieldValue.increment(cost)
            }, { merge: true });
            
            await batch.commit();
            
            logTransaction(myID, -cost, 'System', `${type} Pass Purchase`);
            notify("Pass Activated!", "check-circle");
            
            setTimeout(() => location.reload(), 1000);
        } catch (e) { 
            console.error("Purchase Error:", e);
            notify("Purchase failed", "x"); 
        }
    });
}



async function syncPassLedgerLegacy() {
    notify("Syncing Ledger...", "refresh-cw");
    let totalRev = 0;
    
    // 1. Calculate Revenue from existing players
    state.players.forEach(p => {
        if (p.passType === 'premium') totalRev += 250;
        else if (p.passType === 'standard') totalRev += 100;
    });

    // 2. Update the cloud ledger
    try {
        await db.collection("settings").doc("pass_stats").set({
            total_revenue: totalRev
        }, { merge: true });
        
        notify("Ledger Synced Successfully!", "check-circle");
    } catch (e) {
        console.error(e);
        notify("Sync Failed", "x-circle");
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
        
        // --- NEW CALCULATION: GOALS CONCEDED ---
        let goalsConceded = 0;
        state.matches.forEach(m => {
            if (m.status === 'played') {
                if (m.homeId === p.id) goalsConceded += (m.score?.a || 0);
                if (m.awayId === p.id) goalsConceded += (m.score?.h || 0);
            }
        });
        // ---------------------------------------

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
            </div>

            <div class="moving-border p-[1px] rounded-[2.1rem] shadow-lg">
                <div class="bg-slate-900 p-5 rounded-[2rem]">
                    <h4 class="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-4 border-b border-white/5 pb-2">Season Analytics</h4>
                    
                    <div class="grid grid-cols-3 gap-y-5 gap-x-2">
                        <div class="text-center">
                            <p class="text-[7px] text-slate-500 font-bold uppercase mb-1">Played</p>
                            <p class="text-sm font-black text-white">${p.mp || 0}</p>
                        </div>
                        
                        <div class="text-center">
                            <p class="text-[7px] text-emerald-500 font-bold uppercase mb-1">Won</p>
                            <p class="text-sm font-black text-white">${p.wins || 0}</p>
                        </div>

                        <div class="text-center">
                            <p class="text-[7px] text-slate-400 font-bold uppercase mb-1">Draw</p>
                            <p class="text-sm font-black text-white">${p.draws || 0}</p>
                        </div>

                        <div class="text-center">
                            <p class="text-[7px] text-rose-500 font-bold uppercase mb-1">Lost</p>
                            <p class="text-sm font-black text-white">${p.losses || 0}</p>
                        </div>

                        <div class="text-center">
                            <p class="text-[7px] text-gold-500 font-bold uppercase mb-1">Scored</p>
                            <p class="text-sm font-black text-white">${p.goals || 0}</p>
                        </div>

                        <div class="text-center">
                            <p class="text-[7px] text-blue-400 font-bold uppercase mb-1">Conceded</p>
                            <p class="text-sm font-black text-white">${goalsConceded}</p>
                        </div>
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
                
                <div class="moving-border-purple p-[1px] rounded-[2.1rem] shadow-xl mb-6">
                    <div class="bg-slate-900 rounded-[2rem] p-5">
                        <h3 class="text-purple-400 font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i data-lucide="bar-chart-3" class="w-3 h-3"></i> Pass Financial Ledger
                        </h3>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-slate-950 p-3 rounded-xl border border-white/5">
                                <p class="text-[7px] text-slate-500 uppercase font-black">Pass Revenue</p>
                                <p id="admin-pass-rev" class="text-sm font-black text-emerald-400">0 BP</p>
                            </div>
                            <div class="text-center bg-slate-950 p-3 rounded-xl border border-white/5">
                                <p class="text-[7px] text-slate-500 uppercase font-black">Rewards Given</p>
                                <p id="admin-pass-dist" class="text-sm font-black text-rose-400">0 BP</p>
                            </div>
                        </div>
                        <p id="admin-pass-net" class="text-center text-[8px] font-black uppercase text-slate-400 mt-3"></p>
                    </div>
                </div>

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

                <div class="moving-border-gold p-[1px] rounded-[2.6rem] shadow-xl">
                    <div class="bg-slate-900 rounded-[2.5rem] p-6">
                        <label class="block text-[8px] font-black text-rose-500 uppercase mb-3 tracking-widest">
                            <i data-lucide="shield-alert" class="w-3 h-3 inline mr-1"></i> Manual Purchase Correction
                        </label>
                        <p class="text-[7px] text-slate-500 mb-3 font-bold">Block an item for a player who already used it.</p>
                        
                        <div class="space-y-2">
                            <input type="text" id="admin-manual-id" placeholder="Enter Player SLC-ID" class="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none focus:border-rose-500 uppercase font-bold">
                            
                            <select id="admin-manual-item" class="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none focus:border-rose-500 uppercase font-bold">
                                <option value="insurance">Insurance</option>
                                <option value="multiplier">Multiplier</option>
                                <option value="scout">Scout</option>
                                <option value="privacy">Privacy</option>
                                <option value="decline_pass">Decline Pass</option>
                                <option value="vault_access">The Vault</option>
                            </select>

                            <button onclick="manualMarkAsSold(document.getElementById('admin-manual-id').value, document.getElementById('admin-manual-item').value)" class="w-full py-3 bg-rose-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                                Mark as SOLD OUT
                            </button>
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

                <button onclick="adminSyncGoals()" class="w-full py-4 mb-1 bg-blue-600/10 border border-blue-500/30 text-blue-500 font-black text-[8px] uppercase tracking-[0.2em] rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                    <i data-lucide="refresh-cw" class="w-3 h-3 inline mr-2"></i> Sync Goal History
                </button>

                <button onclick="syncLegacyPurchases()" class="w-full py-4 mb-3 bg-gold-600/10 border border-gold-500/30 text-gold-500 font-black text-[8px] uppercase tracking-[0.2em] rounded-xl hover:bg-gold-600 hover:text-white transition-all">
                    <i data-lucide="database" class="w-3 h-3 inline mr-2"></i> Sync Legacy Purchases
                </button>
                <button onclick="forceRebuildHistory()" class="w-full py-4 mb-3 bg-purple-600/10 border border-purple-500/30 text-purple-400 font-black text-[8px] uppercase tracking-[0.2em] rounded-xl hover:bg-purple-600 hover:text-white transition-all">
                    <i data-lucide="history" class="w-3 h-3 inline mr-2"></i> Reconstruct All History
                </button>
                <button onclick="toggleBettingSystem()" class="w-full py-4 mb-3 ${state.bettingActive ? 'bg-rose-600/10 border-rose-500/30 text-rose-500 hover:bg-rose-600' : 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-600'} border font-black text-[8px] uppercase tracking-[0.2em] rounded-xl hover:text-white transition-all">
                    <i data-lucide="${state.bettingActive ? 'ban' : 'power'}" class="w-3 h-3 inline mr-2"></i> 
                    ${state.bettingActive ? 'STOP BETTING SYSTEM' : 'ACTIVATE BETTING SYSTEM'}
                </button>
                <button onclick="askFactoryReset()" class="w-full py-4 text-rose-600 font-black text-[8px] uppercase tracking-[0.3em] opacity-30 hover:opacity-100 transition-opacity">Factory Reset Cloud</button>
                
            </div>`;
    } else {
        // --- PLAYER VIEW BUTTONS ---
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

            // [NEW] TRANSACTION HISTORY BUTTON
            html += `
            <div class="mt-2 mb-2">
                 <button onclick="openBPHistory()" class="w-full py-4 bg-slate-900 border border-white/10 rounded-[1.8rem] relative overflow-hidden group shadow-xl active:scale-95 transition-all flex items-center justify-between px-6">
                    <div class="flex items-center gap-3">
                        <div class="bg-gold-500/10 p-2 rounded-full border border-gold-500/20">
                            <i data-lucide="history" class="w-5 h-5 text-gold-500"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-[9px] font-black text-white uppercase tracking-widest">Transaction History</p>
                            <p class="text-[7px] text-slate-500 font-bold uppercase mt-0.5">Track Earnings & Spendings</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover:text-gold-500 transition-colors"></i>
                 </button>
            </div>`;

            html += `
            <div class="mt-2 mb-4">
                 <button onclick="showPersonalCardPreview()" class="w-full py-4 bg-gradient-to-r from-slate-900 to-slate-900 border border-gold-500/30 rounded-[1.8rem] relative overflow-hidden group shadow-xl active:scale-95 transition-all">
                    <div class="absolute inset-0 bg-gold-500/5 group-hover:bg-gold-500/10 transition-colors"></div>
                    <div class="relative z-10 flex items-center justify-center gap-3">
                        <div class="bg-slate-950 p-2 rounded-full border border-gold-500/20">
                            <i data-lucide="id-card" class="w-5 h-5 text-gold-500"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-[9px] font-black text-white uppercase tracking-widest">Download Player Card</p>
                            <p class="text-[7px] text-slate-500 font-bold uppercase mt-0.5">Save Official Stats Image</p>
                        </div>
                    </div>
                 </button>
            </div>`;
    }
    // 1. INJECT THE HTML FIRST
    container.innerHTML = html;
    
    // 2. TRIGGER THE PASS UI (The code needs the HTML to exist first)
    if (p) {
        updatePassUI(p);
    }
    
    // 3. INITIALIZE ICONS
    if (window.lucide) {
        lucide.createIcons();
    }
    // Footer
    html += `
        <div class="text-center pt-6 pb-20">
            <button onclick="logout()" class="px-10 py-4 bg-rose-500/5 text-rose-500 text-[10px] font-black rounded-full border border-rose-500/20 tracking-[0.2em] shadow-xl active:scale-95 transition-all mb-16">
                LOGOUT
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
    
    function updatePassUI(me) {
        const purchaseView = document.getElementById('pass-purchase-view');
        const activeView = document.getElementById('pass-active-view');
        const passSection = document.getElementById('pass-section');
        
        if (!purchaseView || !activeView) return; // Safety check

        if (me && me.passType) {
            purchaseView.classList.add('hidden');
            activeView.classList.remove('hidden');
            
            const round = me.passRound || 0;
            const progress = (round / 10) * 100;
            
            document.getElementById('current-round-text').innerText = round;
            document.getElementById('pass-progress-bar').style.width = `${progress}%`;
            
            const tag = document.getElementById('active-pass-tag');
            tag.innerText = `${me.passType} Pass Active`;
            tag.className = me.passType === 'premium' ? 'bg-gold-500/10 text-gold-500' : 'bg-blue-500/10 text-blue-500';
            
            // Match calculation logic
            const p1Played = state.matches.filter(m => m.phase === 1 && m.status === 'played').length;
            const p2Played = state.matches.filter(m => m.phase === 2 && m.status === 'played').length;
            const totalLeft = (4 - p1Played) + (5 - p2Played);
            
            const remainingTag = document.getElementById('matches-remaining-tag');
            if (remainingTag) remainingTag.innerText = `${totalLeft} Matches Left`;
            
            if (round < 10) {
                const nextReward = PASS_REWARDS[me.passType][round];
                document.getElementById('next-reward-text').innerText = `Next: ${nextReward.id || '10 BP'}`;
            } else {
                document.getElementById('next-reward-text').innerText = `MAXED`;
            }
        } else {
            purchaseView.classList.remove('hidden');
            activeView.classList.add('hidden');
        }
    }
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
async function saveMatchResult() {
    const sH = parseInt(document.getElementById('res-s-h').value);
    const sA = parseInt(document.getElementById('res-s-a').value);
    const verifyId = document.getElementById('res-verify-id').value.trim().toUpperCase();

    if (isNaN(sH) || isNaN(sA)) return notify("Enter scores", "alert-circle");
    
    const m = state.matches.find(x => x.id === state.activeMatchId);
    if (!m) return;
    
    // Authorization Check
    const isAuthorized = state.isAdmin || (verifyId === m.homeId || verifyId === m.awayId);
    if (!isAuthorized) return notify("Unauthorized", "lock");

    try {
        const batch = db.batch();

        // --- STEP 1: REVERT STATS AND BETS IF ALREADY PLAYED ---
        if (m.status === 'played') {
            await revertMatchStats(m);

            const oldBetsSnap = await db.collection("bets")
                .where("matchId", "==", m.id)
                .get();
                
            for (const doc of oldBetsSnap.docs) {
                const bet = doc.data();
                if (bet.status === 'won') {
                    batch.update(db.collection("players").doc(bet.userId), {
                        bounty: firebase.firestore.FieldValue.increment(-bet.potentialPayout)
                    });
                }
                batch.update(doc.ref, { status: 'pending', taxPaid: 0 });
            }
        }

        let matchUpdate = { status: 'played' };
        let hBP = 0, aBP = 0;

        let submitterName = "Admin";
        if (!state.isAdmin) {
            const submitterObj = state.players.find(p => p.id === verifyId);
            submitterName = submitterObj && submitterObj.name ? submitterObj.name : "Verified Player"; 
        }
        matchUpdate.submittedBy = submitterName;

        const hObj = state.players.find(p => p.id === m.homeId);
        const aObj = state.players.find(p => p.id === m.awayId);
        const hEff = hObj?.active_effects || {};
        const aEff = aObj?.active_effects || {};

        const sanctionPercent = getSanctionPercentage(m.deadline);
        const winMod = Math.max(0, 1 - (sanctionPercent / 100)); 
        const lossMod = 1 + (sanctionPercent / 100);
        matchUpdate.sanctionApplied = sanctionPercent;

        const calcPoints = (isWinner, baseWin, baseLoss, effectObj) => {
            if (isWinner) {
                let pts = baseWin * winMod;
                if (effectObj.multiplier) pts *= 2;
                return Math.floor(pts);
            } else {
                let pts = baseLoss * lossMod;
                if (effectObj.insurance) pts /= 2;
                return Math.floor(pts);
            }
        };

        let winPts = 0, lossPts = 0, drawPts = -30;
        if (m.phase === 3) {
            winPts = 300; lossPts = -250; drawPts = -100;
            matchUpdate.winnerId = sH > sA ? m.homeId : (sA > sH ? m.awayId : null);
        } else if (m.phase === 2) {
            const pool = Math.floor((hObj.bounty + aObj.bounty) * (m.stakeRate / 100));
            winPts = pool; lossPts = -pool;
        } else {
            winPts = 100; lossPts = -50;
        }

        if (sH > sA) { 
            hBP = calcPoints(true, winPts, lossPts, hEff);
            aBP = calcPoints(false, winPts, lossPts, aEff);
        } else if (sA > sH) { 
            hBP = calcPoints(false, winPts, lossPts, hEff);
            aBP = calcPoints(true, winPts, lossPts, aEff);
        } else { 
            hBP = Math.floor(drawPts * lossMod); 
            aBP = Math.floor(drawPts * lossMod); 
        }

        matchUpdate.score = { h: sH, a: sA };
        matchUpdate.resultDelta = { h: hBP, a: aBP };

        // --- NEW PASS SYSTEM REWARD ENGINE (FIXED) ---
        const winnerId = sH > sA ? m.homeId : (sA > sH ? m.awayId : null);
        const winnerData = state.players.find(p => p.id === winnerId);

        if (winnerId && winnerData && winnerData.passType) {
            const currentRound = winnerData.passRound || 0;
            
            if (currentRound < 10) {
                const nextRound = currentRound + 1;
                const config = PASS_CONFIG[winnerData.passType];
                const reward = PASS_REWARDS[winnerData.passType][nextRound - 1];

                let passBountyGain = config.rebate; 
                let rewardDesc = `Pass R-${nextRound}: +${config.rebate} BP`;
                
                let passUpdates = { 
                    passRound: nextRound,
                    bounty: firebase.firestore.FieldValue.increment(passBountyGain)
                };

                if (reward.type === 'bp') {
                    let bpBonus = 0;
                    if (winnerData.passType === 'premium') {
                        if ([2, 4, 7].includes(nextRound)) bpBonus = 50;
                        else if (nextRound === 9) bpBonus = 100;
                        else bpBonus = 10;
                    } else {
                        bpBonus = [6, 8, 9].includes(nextRound) ? 20 : 10;
                    }
                    passUpdates['bounty'] = firebase.firestore.FieldValue.increment(config.rebate + bpBonus);
                    passBountyGain += bpBonus;
                    rewardDesc += ` & +${bpBonus} Bonus`;
                } 
                else if (reward.type === 'item') {
                    passUpdates[`inventory.${reward.id}`] = firebase.firestore.FieldValue.increment(1);
                    rewardDesc += ` & Item: ${reward.id}`;
                }
                else if (reward.type === 'badge') {
                    passUpdates[`badges.${reward.id}`] = true;
                    rewardDesc += ` & Title: ${reward.id}`;
                }
                else if (reward.type === 'vault') {
                    passUpdates[`inventory.vault_access`] = firebase.firestore.FieldValue.increment(1);
                    rewardDesc += ` & Vault Key`;
                }

                batch.update(db.collection("players").doc(winnerId), passUpdates);
                logTransaction(winnerId, passBountyGain, 'Pass Reward', rewardDesc);

                batch.set(db.collection("settings").doc("pass_stats"), {
                    total_distributed: firebase.firestore.FieldValue.increment(passBountyGain)
                }, { merge: true });
            }
        }
        // --- END PASS SYSTEM ENGINE ---

        // --- STEP 2: EVALUATE BETS (NEW SCORE) ---
        const betsSnap = await db.collection("bets") 
            .where("matchId", "==", m.id)
            .get();
        
        let resultType = (sH > sA) ? 'home' : (sA > sH ? 'away' : 'draw');

        betsSnap.forEach(doc => {
            const bet = doc.data();
            let isWin = (bet.selection === resultType);

            if (isWin) {
                const rawPayout = bet.potentialPayout; 
                const brokerTax = Math.floor(rawPayout * 0.10); 
                const netPayout = rawPayout - brokerTax;
                
                batch.update(db.collection("players").doc(bet.userId), {
                    bounty: firebase.firestore.FieldValue.increment(netPayout)
                });

                logTransaction(bet.userId, netPayout, 'Betting', `Win: +${netPayout} BP (Tax: -${brokerTax})`);
                batch.update(doc.ref, { status: 'won', taxPaid: brokerTax });
            } else {
                batch.update(doc.ref, { status: 'lost', taxPaid: 0 });
            }
        });

        const consumeItem = (pid, effectName) => {
            batch.update(db.collection("players").doc(pid), { [`active_effects.${effectName}`]: false });
        };
        ['insurance', 'multiplier', 'privacy'].forEach(eff => {
            if (hEff[eff]) consumeItem(m.homeId, eff);
            if (aEff[eff]) consumeItem(m.awayId, eff);
        });

        const updateStats = (id, bp, goals, isWin, isDraw, isLoss) => {
            batch.update(db.collection("players").doc(id), {
                bounty: firebase.firestore.FieldValue.increment(bp),
                goals: firebase.firestore.FieldValue.increment(goals),
                wins: firebase.firestore.FieldValue.increment(isWin ? 1 : 0),
                draws: firebase.firestore.FieldValue.increment(isDraw ? 1 : 0),
                losses: firebase.firestore.FieldValue.increment(isLoss ? 1 : 0),
                mp: firebase.firestore.FieldValue.increment(1)
            });
        };

        updateStats(m.homeId, hBP, sH, sH > sA, sH === sA, sH < sA);
        updateStats(m.awayId, aBP, sA, sA > sH, sH === sA, sA < sH);
        
        batch.update(db.collection("matches").doc(m.id), matchUpdate);
        
        await batch.commit();

        logTransaction(m.homeId, hBP, 'Match', `vs ${aObj?.name || 'Opponent'}`);
        logTransaction(m.awayId, aBP, 'Match', `vs ${hObj?.name || 'Opponent'}`);

        notify(m.status === 'played' ? "Result Corrected & Bets Synced!" : "Result Saved!", "check-circle");
        
        closeModal('modal-result');
        if (typeof checkAndRewardMilestones === 'function') {
            await checkAndRewardMilestones(m.homeId);
            await checkAndRewardMilestones(m.awayId);
        }
        
    } catch (err) {
        console.error(err);
        notify("Sync Error", "x-circle");
    }
}



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


// --- NEW: GOAL MILESTONE ENGINE ---

async function checkAndRewardMilestones(playerId) {
    try {
        const ref = db.collection("players").doc(playerId);
        const doc = await ref.get();
        if (!doc.exists) return;

        const p = doc.data();
        const goals = p.goals || 0;
        // Retrieve existing claims or initialize empty object
        const claimed = p.claimed_milestones || {}; 
        
        let bonusBP = 0;
        let updates = {};
        let milestonesReached = [];

        // Milestone Configuration
        const milestones = [
            { target: 15, reward: 50 },
            { target: 30, reward: 100 },
            { target: 50, reward: 150 },
            { target: 80, reward: 200 },
            { target: 100, reward: 500 }
        ];

        milestones.forEach(m => {
            // Check if goal target met AND reward not yet claimed
            if (goals >= m.target && !claimed[m.target]) {
                bonusBP += m.reward;
                // Prepare Firestore update for this specific key
                updates[`claimed_milestones.${m.target}`] = true;
                milestonesReached.push(m.target);
            }
        });

        // If bonuses exist, apply them
        if (bonusBP > 0) {
            updates['bounty'] = firebase.firestore.FieldValue.increment(bonusBP);
            
            await ref.update(updates);
            logTransaction(playerId, bonusBP, 'Achievement', `Hit ${milestonesReached.join(', ')} Goals`);
            // Trigger Notification
            notify(`${p.name} HIT ${milestonesReached.join(', ')} GOALS! +${bonusBP} BP`, "trophy");
            
            // Optional: Celebration Effect
            if (bonusBP >= 150) triggerFireworks();
        }

    } catch (e) {
        console.error("Milestone Error:", e);
    }
}



// --- 9. GLOBAL UI RENDERERS ---

// [UPDATED] renderLeaderboard: Now supports "Privacy" Shop Item
let scheduleTicker = null;
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    
    list.innerHTML = `<h2 class="text-xs font-black text-slate-500 uppercase mb-6 italic tracking-widest">Global Standings</h2>`;
    
    // Use Official Sorting
    const sortedPlayers = getSmartSortedPlayers();
    
    sortedPlayers.forEach((p, i) => {
        let borderClass = 'moving-border-blue'; 
        if (i === 0) borderClass = 'moving-border-gold';
        if (i === 1 || i === 2) borderClass = 'moving-border-emerald';

        const activeEff = p.active_effects || {};
        const gdSign = p._gd > 0 ? '+' : '';
        const gdDisplay = `${gdSign}${p._gd}`;
        
        let statsDisplay = `${p.mp||0}M ${p.wins||0}W ${p.draws||0}D ${p.losses||0}L • <span class="${p._gd >= 0 ? 'text-slate-400' : 'text-rose-500'}">GD ${gdDisplay}</span>`;

        // Privacy Check
        if (activeEff.privacy) {
            statsDisplay = `<span class="text-emerald-500 flex items-center gap-1"><i data-lucide="lock" class="w-2 h-2"></i> DATA ENCRYPTED</span>`;
        }

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

// [NEW FUNCTION] startScheduleTicker: Updates all countdowns every second
function startScheduleTicker() {
    if (scheduleTicker) clearInterval(scheduleTicker); // Clear existing timer

    const update = () => {
        const now = new Date().getTime();
        const elements = document.querySelectorAll('.active-countdown');

        elements.forEach(el => {
            const deadlineVal = el.getAttribute('data-deadline');
            if (!deadlineVal) return;

            const countDownDate = new Date(deadlineVal).getTime();
            const distance = countDownDate - now;

            if (distance < 0) {
                el.innerHTML = `<span class="text-rose-500">EXPIRED</span>`;
                el.classList.remove('bg-slate-950/50');
                el.classList.add('bg-rose-500/10', 'border-rose-500/30');
            } else {
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                // Format: 2d 10h 45m 30s
                let timeStr = "";
                if (days > 0) timeStr += `<span class="text-white">${days}d </span>`;
                timeStr += `<span class="text-white">${hours}h </span>`;
                timeStr += `<span class="text-white">${minutes}m </span>`;
                timeStr += `<span class="text-gold-500 w-[14px] inline-block text-right">${seconds}s</span>`;

                el.innerHTML = timeStr;
            }
        });
    };

    update(); // Run immediately
    scheduleTicker = setInterval(update, 1000); // Repeat every second
}

// --- BETTING ENGINE ---

function calculateMatchOdds(h, a) {
    // 1. Calculate Strength Scores (Preserved Performance Logic)
    const getStrength = (p) => {
        if (!p) return 500;
        const streak = (typeof calculateWinStreak === 'function') ? calculateWinStreak(p.id) : 0;
        // Calculation based on Bounty (50%), Wins, Goals, and Win Streaks
        let score = (p.bounty * 0.5) + ((p.wins || 0) * 50) + ((p.goals || 0) * 5);
        if (streak > 2) score += (streak * 20);
        return Math.max(100, score);
    };
    
    const sH = getStrength(h);
    const sA = getStrength(a);
    const totalStrength = sH + sA;
    
    // 2. Raw Win Probabilities
    let probH = sH / totalStrength;
    let probA = sA / totalStrength;
    let probD = 0.20; // 20% Base Draw Probability

    // 3. THE HOUSE EDGE (15% Overround/Vig)
    // We divide by 1.15 to shrink the payout, ensuring the House keeps the difference.
    const houseEdge = 1.15; 
    
    // 4. Convert to "House-Skewed" Odds
    let oddsH = (1 / probH) / houseEdge;
    let oddsA = (1 / probA) / houseEdge;
    
    // Draw Odds Refinement: Closer strength = Lower Draw Odds (more likely)
    const diff = Math.abs(sH - sA);
    const maxDiff = 1000;
    let baseOddsD = 2.0 + (Math.min(diff, maxDiff) / maxDiff) * 0.5;
    let refinedOddsD = baseOddsD / houseEdge;
    
    // 5. Apply CAP (2.5x) and Floor (1.1x)
    const clamp = (val) => Math.min(BETTING_ODDS_CAP, Math.max(1.10, val));
    
    return {
        h: parseFloat(clamp(oddsH).toFixed(2)),
        d: parseFloat(clamp(refinedOddsD).toFixed(2)),
        a: parseFloat(clamp(oddsA).toFixed(2))
    };
}



let activeBet = { mid: null, selection: null, odds: 0 };

// --- UPDATED BETTING LIMIT LOGIC ---

function openBettingModal(mid) {
    const m = state.matches.find(x => x.id === mid);
    if (!m) return;
    
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    
    if (!me) return notify("Login required to bet", "lock");
    
    // 1. Recalculate odds live
    const odds = calculateMatchOdds(h, a);
    
    // 2. FIXED LOOPHOLE CALCULATION:
    // Calculate how much is already tied up in pending bets
    let pendingStakes = 0;
    // We filter the global bets state for the current user's pending bets
    db.collection("bets")
        .where("userId", "==", myID)
        .where("status", "==", "pending")
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                pendingStakes += (doc.data().stake || 0);
            });

            // Total worth = Current BP + What is already bet
            const totalWorth = me.bounty + pendingStakes;
            const absoluteMaxStake = Math.floor(totalWorth * BETTING_MAX_STAKE_PERCENT);
            const remainingAllowance = Math.max(0, absoluteMaxStake - pendingStakes);

            // UI Setup
            document.getElementById('bet-h-name').innerText = h.name;
            document.getElementById('bet-a-name').innerText = a.name;
            document.getElementById('odds-home').innerText = odds.h + 'x';
            document.getElementById('odds-draw').innerText = odds.d + 'x';
            document.getElementById('odds-away').innerText = odds.a + 'x';
            document.getElementById('bet-wallet-display').innerText = `${me.bounty} BP`;
            
            // Set the dynamic remaining limit
            document.getElementById('bet-max-val').innerText = remainingAllowance;
            const stakeInput = document.getElementById('bet-stake-input');
            stakeInput.max = remainingAllowance;
            stakeInput.value = '';
            
            // Set State for the current transaction
            activeBet = { 
                mid: mid, 
                selection: null, 
                oddsObj: odds, 
                allowedLimit: remainingAllowance // Store for validation
            };

            document.querySelectorAll('.bet-option-btn').forEach(b => b.classList.remove('selected'));
            document.getElementById('btn-confirm-bet').disabled = true;
            updatePotentialReturn();
            
            openModal('modal-betting');
        });
}

function updatePotentialReturn() {
    const stakeInput = document.getElementById('bet-stake-input');
    const stake = parseInt(stakeInput.value) || 0;
    const btn = document.getElementById('btn-confirm-bet');
    const msg = document.getElementById('bet-limit-msg');
    
    // Use the limit calculated when the modal opened
    const maxAllowed = activeBet.allowedLimit || 0;
    
    let potential = 0;
    
    if (stake > maxAllowed) {
        msg.classList.remove('hidden');
        msg.innerText = `Limit Reached: Max ${maxAllowed} BP remaining`;
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        msg.classList.add('hidden');
        if (activeBet.selection && stake > 0) {
            potential = Math.floor(stake * activeBet.odds);
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
    
    document.getElementById('bet-return-display').innerText = `${potential} BP`;
}


function selectBetOutcome(selection) {
    activeBet.selection = selection;
    
    // Visual Update
    document.querySelectorAll('.bet-option-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(`btn-bet-${selection}`).classList.add('selected');
    
    // Determine Odds
    if (selection === 'home') activeBet.odds = activeBet.oddsObj.h;
    if (selection === 'draw') activeBet.odds = activeBet.oddsObj.d;
    if (selection === 'away') activeBet.odds = activeBet.oddsObj.a;
    
    updatePotentialReturn();
}

function updatePotentialReturn() {
    const stake = parseInt(document.getElementById('bet-stake-input').value) || 0;
    const myID = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID);
    const maxBet = Math.floor(me.bounty * BETTING_MAX_STAKE_PERCENT);
    const btn = document.getElementById('btn-confirm-bet');
    const msg = document.getElementById('bet-limit-msg');
    
    let potential = 0;
    
    // Validations
    if (stake > maxBet) {
        msg.classList.remove('hidden');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        msg.classList.add('hidden');
        if (activeBet.selection && stake > 0) {
            potential = Math.floor(stake * activeBet.odds);
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
    
    document.getElementById('bet-return-display').innerText = `${potential} BP`;
}


// --- 2. PROFIT-OPTIMIZED BETTING EXECUTION (THE BURN) ---
async function placeBet() {
    const stakeInput = document.getElementById('bet-stake-input');
    const btn = document.getElementById('btn-confirm-bet'); // Reference to button
    const stake = parseInt(stakeInput.value);
    const myID = localStorage.getItem('slc_user_id');

    // 1. Basic Validations
    if (!activeBet.selection) return notify("Select an outcome", "alert-circle");
    if (isNaN(stake) || stake <= 0) return notify("Enter valid amount", "alert-circle");
    if (stake > activeBet.allowedLimit) return notify("Limit reached (20%)", "lock");
    
    // 2. Prevent Double-Click Loophole
    if (btn.disabled) return; 
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const batch = db.batch();
        
        // --- 3. ODDS REFRESH LOOPHOLE FIX ---
        // We re-fetch the latest match data to re-calculate odds at the millisecond of betting
        const m = state.matches.find(x => x.id === activeBet.mid);
        const hObj = state.players.find(p => p.id === m.homeId);
        const aObj = state.players.find(p => p.id === m.awayId);
        
        // Re-run the profit-optimized odds engine
        const freshOdds = calculateMatchOdds(hObj, aObj);
        const finalOdds = freshOdds[activeBet.selection[0]]; // h, d, or a

        // --- 4. HOUSE REVENUE CALCULATION ---
        const burnAmount = Math.floor(stake * 0.05); 
        const effectiveStake = stake - burnAmount; 
        const potentialReturn = Math.floor(effectiveStake * finalOdds);

        // 5. Deduct full stake from player
        batch.update(db.collection("players").doc(myID), {
            bounty: firebase.firestore.FieldValue.increment(-stake)
        });

        // 6. Create the bet record
        const betId = `BET_${Date.now()}_${myID.slice(0,3)}`;
        batch.set(db.collection("bets").doc(betId), {
            id: betId,
            userId: myID,
            matchId: activeBet.mid,
            selection: activeBet.selection,
            stake: stake,
            burnFee: burnAmount,
            potentialPayout: potentialReturn,
            oddsAtBet: finalOdds, // Record final odds used
            status: 'pending',
            ts: Date.now()
        });

        // 7. Log the transaction
        logTransaction(myID, -stake, 'Betting', `Stake: ${effectiveStake} BP | Fee: ${burnAmount} BP`);

        await batch.commit();
        notify(`Bet Confirmed! ${burnAmount} BP Burned.`, "check-circle");
        closeModal('modal-betting');
        
    } catch (e) {
        console.error(e);
        notify("Betting failed", "x-circle");
    } finally {
        // Reset button state
        btn.disabled = false;
        btn.innerText = "Confirm";
    }
}


// [UPDATED] Render: Displays Round Number (e.g., PH-1 • R-1)
function renderSchedule() {
    const active = document.getElementById('schedule-list');
    const recent = document.getElementById('recent-results-list');
    const myFixtureContainer = document.getElementById('my-fixture-container');
    const myFixtureDivider = document.getElementById('my-fixture-divider');
    
    // --- [ADDED] Get Current Player Object for Betting Logic ---
    const myID_raw = localStorage.getItem('slc_user_id');
    const me = state.players.find(p => p.id === myID_raw);
    // ---------------------------------------------------------
    
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
    if (myFixtureContainer) myFixtureContainer.innerHTML = '';
    
    // Sort: Round -> Date
    const allScheduled = state.matches
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => (a.round || 0) - (b.round || 0));
    
    const display = (state.isAdmin || state.bulkMode) ? allScheduled : allScheduled.filter(m => m.scheduledDate === state.viewingDate);

    // --- MY FIXTURE SECTION ---
    const myID = localStorage.getItem('slc_user_id');
    const myMatches = allScheduled.filter(m => 
        (m.homeId === myID || m.awayId === myID) && 
        m.deadline && m.deadline !== ""
    );

    if (myID && myMatches.length > 0 && !state.isAdmin && !state.bulkMode) {
        myFixtureContainer.classList.remove('hidden');
        if(myFixtureDivider) myFixtureDivider.classList.remove('hidden');

        myFixtureContainer.innerHTML = `<h2 class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] text-center mb-4 italic">My Fixture</h2>`;

        myMatches.forEach(m => {
            const h = state.players.find(p => p.id === m.homeId);
            const a = state.players.find(p => p.id === m.awayId);
            
            // --- NEW: SANCTION CHECK ---
            const sanction = getSanctionPercentage(m.deadline);
            const isLate = sanction > 0;
            
            let boxClass = "moving-border-gold";
            let timerHTML = '';
            let dateDisplay = '';

            const dateObj = new Date(m.deadline);
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            if (isLate) {
                // OVERDUE STATE
                boxClass = "moving-border-rose"; // Red Alert
                dateDisplay = `<span class="text-[7px] text-rose-500 font-black ml-1 border-l border-white/10 pl-2 animate-pulse">DEADLINE BREACHED</span>`;
                
                timerHTML = `
                <div class="mt-3 flex justify-center border-t border-white/5 pt-2">
                    <div class="flex items-center gap-2 bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-500/30">
                        <i data-lucide="alert-triangle" class="w-3 h-3 text-rose-500"></i>
                        <span class="text-[9px] font-black font-mono tracking-widest text-rose-500">SANCTION ACTIVE: -${sanction}%</span>
                    </div>
                </div>`;
            } else {
                // NORMAL STATE
                dateDisplay = `<span class="text-[7px] text-emerald-500 font-bold ml-1 border-l border-white/10 pl-2">@ ${timeStr}</span>`;
                timerHTML = `
                <div class="mt-3 flex justify-center border-t border-white/5 pt-2">
                    <div class="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-white/5 active-countdown-wrapper">
                        <i data-lucide="timer" class="w-3 h-3 text-gold-500 animate-pulse"></i>
                        <span class="active-countdown text-[9px] font-black font-mono tracking-widest text-slate-300" data-deadline="${m.deadline}">CALCULATING...</span>
                    </div>
                </div>`;
            }

            const box = document.createElement('div');
            box.className = `${boxClass} p-[1.5px] rounded-[1.8rem] mb-4 w-full shadow-2xl active:scale-95 transition-transform cursor-pointer`;
            box.onclick = () => openResultEntry(m.id);

            box.innerHTML = `
                <div class="bg-slate-900 p-5 rounded-[1.7rem] relative z-10">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center">
                            <span class="text-[8px] ${isLate ? 'text-rose-500' : 'text-gold-500'} font-black uppercase tracking-wide">${m.scheduledDate || 'NO DATE'}</span>
                            ${dateDisplay}
                        </div>
                        <span class="text-[7px] text-blue-400 font-black uppercase bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">PH-${m.phase} • R-${m.round || 1}</span>
                    </div>
                    <div class="flex justify-between items-center gap-3">
                        <div class="flex flex-col items-center gap-2 flex-1">
                            ${getAvatarUI(h, "w-10", "h-10")}
                            <span class="text-[9px] font-bold text-white uppercase truncate max-w-[80px]">${h?.name || "TBD"}</span>
                        </div>
                        <div class="flex flex-col items-center">
                            <span class="text-[10px] font-black text-slate-700 italic">VS</span>
                        </div>
                        <div class="flex flex-col items-center gap-2 flex-1">
                            ${getAvatarUI(a, "w-10", "h-10")}
                            <span class="text-[9px] font-bold text-white uppercase truncate max-w-[80px]">${a?.name || "TBD"}</span>
                        </div>
                    </div>
                    ${timerHTML}
                    <div class="mt-3 pt-2 border-t border-white/5 text-center">
                        <p class="text-[7px] ${isLate ? 'text-rose-500' : 'text-emerald-500'} font-bold uppercase tracking-widest">${isLate ? 'Submit to Apply Penalty' : 'Tap to Verify Result'}</p>
                    </div>
                </div>`;
            
            myFixtureContainer.appendChild(box);
        });
    } else {
        if(myFixtureContainer) myFixtureContainer.classList.add('hidden');
        if(myFixtureDivider) myFixtureDivider.classList.add('hidden');
    }
    
    // Admin Controls
    if (state.isAdmin) {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = "w-full max-w-[340px] mb-6 space-y-3";
        if (!state.bulkMode) {
            controlsDiv.innerHTML = `
            <button onclick="toggleBulkMode()" class="w-full py-3 bg-white/5 border border-white/10 text-slate-400 text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                <i data-lucide="list-checks" class="w-3 h-3"></i> Bulk Schedule Mode
            </button>
            <button onclick="showSchedulePreview()" class="w-full mt-2 py-3 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2">
                <i data-lucide="download" class="w-3 h-3"></i> Download Official Schedule
            </button>`;
        } else {
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
    
    // Main Schedule Loop
    display.forEach(m => {
        const h = state.players.find(p => p.id === m.homeId);
        const a = state.players.find(p => p.id === m.awayId);
        const isSelected = state.selectedMatches.has(m.id);
        
        // --- NEW: SANCTION CHECK FOR MAIN LIST ---
        const sanction = getSanctionPercentage(m.deadline);
        const isLate = sanction > 0;
    
        let borderClass = state.bulkMode ? (isSelected ? 'moving-border-gold' : 'moving-border') : 'moving-border-emerald';
        if (isLate && !state.bulkMode) borderClass = 'moving-border-rose'; // Red Border if late
    
        const card = document.createElement('div');
        card.className = `${borderClass} p-[1px] rounded-[1.6rem] mb-4 w-full max-w-[340px] mx-auto shadow-xl transition-transform ${state.bulkMode ? 'cursor-pointer' : 'active:scale-95'}`;
        
        card.onclick = () => { if (state.bulkMode) toggleMatchSelection(m.id);
            else openResultEntry(m.id); };
        
        let dateDisplay = "";
        let countdownHTML = "";
        
        if (m.deadline) {
            const dateObj = new Date(m.deadline);
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            
            if (isLate) {
                dateDisplay = `<span class="text-[7px] text-rose-500 font-black ml-1 border-l border-white/10 pl-2">LATE: -${sanction}%</span>`;
                countdownHTML = `
                <div class="mt-3 flex justify-center border-t border-white/5 pt-2">
                    <span class="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-950/30 px-2 py-1 rounded">Sanction Active</span>
                </div>`;
            } else {
                dateDisplay = `<span class="text-[7px] text-emerald-500 font-bold ml-1 border-l border-white/10 pl-2">@ ${timeStr}</span>`;
                countdownHTML = `
                <div class="mt-3 flex justify-center border-t border-white/5 pt-2">
                    <div class="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-white/5 active-countdown-wrapper">
                        <i data-lucide="timer" class="w-3 h-3 text-gold-500 animate-pulse"></i>
                        <span class="active-countdown text-[9px] font-black font-mono tracking-widest text-slate-300" data-deadline="${m.deadline}">CALCULATING...</span>
                    </div>
                </div>`;
            }
        }
        
        let innerHTML = `
            <div class="bg-slate-900 p-4 rounded-[1.5rem] h-full relative z-10">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center">
                        <span class="text-[7px] ${isSelected ? 'text-gold-500' : 'text-slate-400'} font-black uppercase transition-colors">${m.scheduledDate || 'NO DATE'}</span>
                        ${dateDisplay}
                    </div>
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
                </div>
                ${countdownHTML}
        `;
        
        if (state.bulkMode && isSelected) {
            innerHTML += `<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"><div class="w-8 h-8 bg-gold-500 rounded-full flex items-center justify-center shadow-lg animate-pop-in"><i data-lucide="check" class="w-5 h-5 text-black"></i></div></div>`;
        }
        
        if (state.isAdmin && !state.bulkMode) {
             const hName = h ? h.name : 'HOME';
             const aName = a ? a.name : 'AWAY';
             innerHTML += `
             <div class="mt-3 pt-3 border-t border-white/5 flex gap-2">
                 <button onclick="event.stopPropagation(); openSMS('${m.id}', 'home')" class="flex-1 py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all overflow-hidden"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i> <span class="truncate">${hName}</span></button>
                 <button onclick="event.stopPropagation(); openSMS('${m.id}', 'away')" class="flex-1 py-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all overflow-hidden"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i> <span class="truncate">${aName}</span></button>
             </div>`;
        }
        
        // --- UPDATED BETTING SYSTEM UI ---
const odds = calculateMatchOdds(h, a);

// Check 1: Is user logged in and not admin?
const isPlayer = !state.isAdmin && me;
// Check 2: Are they not playing in this match?
const isNotParticipant = isPlayer && m.homeId !== myID && m.awayId !== myID;
// Check 3: Is match valid?
const isValidMatch = m.deadline && !state.bulkMode;

// LOGIC: Show UI if Player + Not Participant + Valid Match
if (isPlayer && isNotParticipant && isValidMatch) {
    
    // CONDITION 1: GLOBAL BETTING STOPPED
    if (!state.bettingActive) {
        // Do not render anything (vanish), or optionally render a "Suspended" badge
        // innerHTML += ``; // Renders nothing
    }
    // CONDITION 2: ALREADY BET ON THIS MATCH
    else if (state.myBets.has(m.id)) {
        innerHTML += `
                <div class="mt-3 pt-3 border-t border-white/5 text-center">
                    <div class="w-full py-2 bg-purple-900/20 border border-purple-500/30 rounded-xl flex items-center justify-center gap-2">
                        <i data-lucide="ticket" class="w-3 h-3 text-purple-400"></i>
                        <span class="text-[8px] font-black text-purple-400 uppercase tracking-widest">Wager Active</span>
                    </div>
                </div>`;
    }
    // CONDITION 3: ALLOW BETTING
    else {
        innerHTML += `
                <div class="mt-3 pt-3 border-t border-white/5 relative group">
                    <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2">
                        <span class="text-[6px] text-purple-400 font-black uppercase tracking-widest border border-purple-500/30 px-1 rounded bg-purple-500/10">Betting</span>
                    </div>
                    
                    <div class="flex justify-between items-center mb-2 px-2">
                        <div class="text-center"><span class="block text-[6px] text-slate-500 uppercase">Home</span><span class="text-[8px] font-black text-purple-400">${odds.h}x</span></div>
                        <div class="text-center"><span class="block text-[6px] text-slate-500 uppercase">Draw</span><span class="text-[8px] font-black text-purple-400">${odds.d}x</span></div>
                        <div class="text-center"><span class="block text-[6px] text-slate-500 uppercase">Away</span><span class="text-[8px] font-black text-purple-400">${odds.a}x</span></div>
                    </div>

                    <button onclick="openBettingModal('${m.id}')" class="w-full py-2 bg-gradient-to-r from-purple-900/40 to-purple-800/40 border border-purple-500/30 rounded-xl text-[8px] font-black text-white uppercase tracking-widest hover:bg-purple-600 transition-all shadow-[0_0_10px_rgba(168,85,247,0.1)] flex items-center justify-center gap-2">
                        <i data-lucide="banknote" class="w-3 h-3 text-purple-400"></i> Place Bet
                    </button>
                </div>`;
    }
}
// ---------------------------------

innerHTML += `</div>`;
card.innerHTML = innerHTML;
active.appendChild(card);
});

startScheduleTicker();

const playedMatches = state.matches.filter(m => m.status === 'played').sort((a, b) => b.id.localeCompare(a.id));
playedMatches.slice(0, 5).forEach(m =>
recent.appendChild(createMatchResultCard(m)));
    if (playedMatches.length > 5) recent.innerHTML += `<div class="w-full text-center mt-4"><button onclick="openFullHistory()" class="px-6 py-3 bg-white/5 border border-white/5 text-slate-400 text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-white/10 transition-all">View All Results (${playedMatches.length})</button></div>`;
    if (playedMatches.length === 0) recent.innerHTML = `<p class="text-[8px] text-slate-600 font-black uppercase italic text-center">No matches played yet</p>`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();

}


// [UPDATED] createMatchResultCard: Shows Submitters Name
// [UPDATED] createMatchResultCard: Includes Retroactive Privacy Fix
function createMatchResultCard(m) {
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);
    
    const div = document.createElement('div');
    div.className = "bg-slate-900/40 p-3 rounded-2xl flex justify-between items-center border border-white/5 mb-2 w-full max-w-[340px] mx-auto opacity-70 relative group";
    
    // --- SMART SUBMITTER NAME RESOLVER ---
    let submitterDisplay = "";
    
    if (m.submittedBy) {
        // 1. Check if the stored text is actually a known Player ID (Retroactive Fix)
        const submitterObj = state.players.find(p => p.id === m.submittedBy);
        
        if (submitterObj) {
            // It was an ID! Swap it for the Name immediately
            submitterDisplay = `Ver: ${submitterObj.name}`;
        } else {
            // It's already a Name (or "Admin"), use it as is
            submitterDisplay = `Ver: ${m.submittedBy}`;
        }
    }
    // -------------------------------------

    div.innerHTML = `
        <span class="text-[9px] font-bold text-white truncate w-20">${h?.name || "TBD"}</span>
        <div class="flex flex-col items-center justify-center min-w-[60px]">
            <span class="text-xs font-black text-emerald-400 leading-none">${m.score ? m.score.h : '0'}-${m.score ? m.score.a : '0'}</span>
            <span class="text-[6px] text-slate-600 font-bold uppercase mt-1">PH-${m.phase}</span>
            
            ${submitterDisplay ? `<span class="text-[5px] text-slate-500 font-bold uppercase mt-0.5 tracking-tight max-w-[80px] truncate">${submitterDisplay}</span>` : ''}
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

// [UPDATED] bulkAddPlayers: Added Null Safety
async function bulkAddPlayers() {
    const area = document.getElementById('bulk-names');
    if (!area) return; // Prevent crash if element missing

    const lines = area.value.split('\n');
    const batch = db.batch();
    
    for (const name of lines) {
        const clean = name.replace('@', '').trim();
        if (clean) {
            const uid = `S${Math.floor(Math.random()*90+10)}L${Math.floor(Math.random()*90+10)}C${Math.floor(Math.random()*90+10)}`;
            batch.set(db.collection("players").doc(uid), { 
                id: uid, 
                name: clean, 
                bounty: 500, 
                goals: 0, 
                mp: 0, wins: 0, draws: 0, losses: 0, 
                p2High: 0, p2Std: 0 
            });
        }
    }
    await batch.commit();
    area.value = ''; 
    notify("Bulk Recruited!", "users");
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


// [UPDATED] revertMatchStats: Reverses points AND goals
async function revertMatchStats(m) {
    const h = state.players.find(p => p.id === m.homeId);
    const a = state.players.find(p => p.id === m.awayId);
    if (!h || !a) return;

    let hBP = 0, aBP = 0;
    
    // Calculate what needs to be subtracted
    if (m.resultDelta) {
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
    
    // Reverse Home (Subtract goals using negative increment)
    batch.update(db.collection("players").doc(h.id), {
        bounty: firebase.firestore.FieldValue.increment(hBP),
        goals: firebase.firestore.FieldValue.increment(-m.score.h), // <--- NEW: Remove Goals
        mp: firebase.firestore.FieldValue.increment(-1),
        wins: firebase.firestore.FieldValue.increment(m.score.h > m.score.a ? -1 : 0),
        draws: firebase.firestore.FieldValue.increment(m.score.h === m.score.a ? -1 : 0),
        losses: firebase.firestore.FieldValue.increment(m.score.h < m.score.a ? -1 : 0)
    });

    // Reverse Away (Subtract goals using negative increment)
    batch.update(db.collection("players").doc(a.id), {
        bounty: firebase.firestore.FieldValue.increment(aBP),
        goals: firebase.firestore.FieldValue.increment(-m.score.a), // <--- NEW: Remove Goals
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



// --- NEW: PROFILE EDITING LOGIC ---

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
    if (!me) return; // Exit if user is not logged in
    
    // Initialize data from player object
    const inv = me.inventory || {}; // Stock of items (Pass rewards go here)
    const active = me.active_effects || {}; // Currently used effects
    const history = me.purchase_history || {}; // Record of items bought with BP
    
    Object.keys(SHOP_ITEMS).forEach(key => {
        const item = SHOP_ITEMS[key];
        const stockCount = inv[key] || 0; // Number of this item the player owns
        const isActive = active[key] || (key === 'vault_access' && me.vault_data?.amount > 0);
        const hasBoughtBefore = history[key] === true;
        
        let btnText = "PURCHASE";
        let btnClass = "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20";
        let statusIcon = "";
        let cardOpacity = "opacity-100";
        
        // --- NEW PASS SYSTEM LOGIC ENGINE ---
        
        if (isActive) {
            // Priority 1: Item is currently in use
            btnText = "ACTIVE";
            btnClass = "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 cursor-default";
            statusIcon = `<div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>`;
        }
        else if (stockCount > 0) {
            // Priority 2: Player owns the item (from PASS or previous purchase)
            // Even if "Sold Out" for buying, they can still ACTIVATE their inventory
            btnText = stockCount > 1 ? `ACTIVATE (${stockCount})` : "ACTIVATE";
            btnClass = "bg-white text-slate-900 font-black shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse-slow";
        }
        else if (hasBoughtBefore) {
            // Priority 3: Player already bought it with BP and has 0 stock left
            btnText = "SOLD OUT";
            btnClass = "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed";
            cardOpacity = "opacity-50 grayscale";
        }
        
        // Create the card element
        const card = document.createElement('div');
        card.className = `relative group cursor-pointer active:scale-95 transition-all ${cardOpacity}`;
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
                    <button class="w-full py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${btnClass}">
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    // Re-initialize Lucide icons for the new elements
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
    const history = me?.purchase_history || {}; // NEW
    
    const isOwned = (inv[key] || 0) > 0;
    const isActive = active[key];
    const hasBoughtEver = history[key] === true; // NEW

    if (key === 'vault_access' && me?.vault_data?.amount > 0) {
        btn.innerText = "VAULT LOCKED";
        btn.onclick = () => notify("Vault is currently sealed.", "lock");
        btn.className = "flex-1 py-3 bg-slate-700 text-slate-400 text-[9px] font-black rounded-xl uppercase tracking-widest cursor-not-allowed";
    } else if (isActive) {
        btn.innerText = "ALREADY ACTIVE";
        btn.onclick = null;
        btn.className = "flex-1 py-3 bg-emerald-900/50 text-emerald-500 text-[9px] font-black rounded-xl uppercase tracking-widest cursor-not-allowed";
    } else if (isOwned) {
        // Player has it but hasn't used it yet
        btn.innerText = "ACTIVATE NOW";
        btn.onclick = () => key === 'vault_access' ? openVaultModal() : activateShopItem(key);
        btn.className = "flex-1 py-3 bg-white text-slate-900 text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg";
    } else if (hasBoughtEver) {
        // NEW: Player bought it, used it, and now is blocked from buying again
        btn.innerText = "SOLD OUT (MAX 1)";
        btn.onclick = () => notify("Item limit reached (1 Per Player)", "lock");
        btn.className = "flex-1 py-3 bg-slate-800 text-slate-500 text-[9px] font-black rounded-xl uppercase tracking-widest cursor-not-allowed border border-slate-700";
    } else {
        // Player has never bought it
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

    // Double check history here for security
    if (me.purchase_history && me.purchase_history[key]) {
        return notify("You have already purchased this item once.", "alert-circle");
    }

    if (me.bounty < item.price) return notify("Insufficient Funds", "alert-circle");
    
    try {
        const batch = db.batch();
        const ref = db.collection("players").doc(myID);
        
        // Deduct Price
        batch.update(ref, { bounty: firebase.firestore.FieldValue.increment(-item.price) });
        // Add to Inventory
        batch.update(ref, { [`inventory.${key}`]: 1 });
        // NEW: Mark as purchased forever
        batch.update(ref, { [`purchase_history.${key}`]: true });
        
        await batch.commit();
        logTransaction(myID, -item.price, 'Shop', `Purchased ${item.name}`);

notify(`${item.name} Purchased!`, "shopping-bag");
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
        logTransaction(myID, -amount, 'Vault', 'Locked in Vault');

    notify(`${amount} BP Locked in Vault!`, "lock");
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
                logTransaction(myID, me.vault_data.amount, 'Vault', 'Funds Unlocked');

    notify("Vault Unlocked: Funds Returned", "unlock");
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
    if (!previewArea) return;

    // Use Official Sorting
    const sortedPlayers = getSmartSortedPlayers();
    
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
    
    // (Rest of the function remains the same, just injecting tableRows)
    previewArea.innerHTML = `
        <div class="export-card" id="capture-zone">
            <div class="export-header">
                <p style="color: #10b981; font-size: 8px; font-weight: 900; letter-spacing: 5px; margin-bottom: 5px;">SYNTHEX LEGION CHRONICLES</p>
                <h1 style="color: white; font-size: 18px; font-weight: 900; margin: 0; letter-spacing: -0.5px;">BOUNTY STANDINGS</h1>
                <div style="width: 40px; height: 2px; background: #f59e0b; margin: 10px auto;"></div>
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


// --- NEW FEATURE: PERSONAL CARD GENERATOR (Updated v2) ---

// --- TOGGLE PRIVACY LOGIC (Updated v2) ---
function togglePreviewID() {
    const el = document.getElementById('preview-slc-id');
    const btnIcon = document.getElementById('btn-privacy-icon');
    const btnText = document.getElementById('btn-privacy-text');
    const warningEl = document.getElementById('privacy-warning'); // New Warning Element
    
    if (!el) return;

    const full = el.getAttribute('data-full');
    const masked = el.getAttribute('data-masked');
    const isHidden = el.innerText.includes('*');

    if (isHidden) {
        // ACTION: SHOW FULL ID
        el.innerText = `SLC-ID: ${full}`;
        
        // Update Button
        if(btnIcon) btnIcon.setAttribute('data-lucide', 'eye-off');
        if(btnText) btnText.innerText = "Hide SLC-ID";
        
        // Show Warning
        if(warningEl) warningEl.classList.remove('hidden');
        
    } else {
        // ACTION: HIDE ID
        el.innerText = `SLC-ID: ${masked}`;
        
        // Update Button
        if(btnIcon) btnIcon.setAttribute('data-lucide', 'eye');
        if(btnText) btnText.innerText = "Show SLC-ID";
        
        // Hide Warning
        if(warningEl) warningEl.classList.add('hidden');
    }
    
    // Refresh icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}


// --- NEW FEATURE: PERSONAL CARD
function showPersonalCardPreview() {
    const myID = localStorage.getItem('slc_user_id');
    const sortedPlayers = getSmartSortedPlayers(); // Use Official Sort
    const p = sortedPlayers.find(x => x.id === myID);
    
    if (!p) return notify("Player Data Not Found", "x-circle");

    // 1. Rankings & Stats
    const globalRank = sortedPlayers.findIndex(x => x.id === p.id) + 1;
    const rankInfo = getRankInfo(p.bounty);

    // 2. Achievement
    const sortedScorers = [...state.players].sort((a, b) => (b.goals || 0) - (a.goals || 0));
    const scorerIndex = sortedScorers.findIndex(x => x.id === p.id);
    let achievementHTML = '';
    
    if (p.goals > 0 && scorerIndex < 3) {
        const medals = ["GOLDEN BOOT LEADER", "SILVER STRIKER", "BRONZE BOMBER"];
        const colors = ["text-gold-500", "text-slate-300", "text-rose-400"];
        achievementHTML = `
            <div class="p-card-achievement">
                <div class="bg-slate-900 p-1.5 rounded-full border border-white/10 flex items-center justify-center">
                    <i data-lucide="trophy" class="w-3 h-3 ${colors[scorerIndex]}"></i>
                </div>
                <div>
                    <p class="text-[6px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Achievement</p>
                    <p class="text-[8px] font-black text-white uppercase tracking-wide leading-none">${medals[scorerIndex]}</p>
                </div>
            </div>`;
    }

    // 3. Avatar & Privacy
    let imgHTML = p.avatar 
        ? `<img src="${p.avatar}" class="p-card-avatar-img" crossorigin="anonymous">`
        : `<div class="p-card-avatar-img flex items-center justify-center text-7xl font-black text-white bg-slate-800">${(p.name || "U").charAt(0).toUpperCase()}</div>`;
    
    const maskedID = p.id.replace(/\d/g, '*');

    // 4. HTML
    const html = `
    <div class="w-full max-w-[400px] mx-auto mb-4 flex flex-col items-center gap-3">
        <button onclick="togglePreviewID()" class="flex items-center gap-2 px-6 py-2.5 bg-slate-800 border border-white/10 rounded-full hover:bg-slate-700 transition-colors active:scale-95 shadow-lg">
            <i id="btn-privacy-icon" data-lucide="eye-off" class="w-3 h-3 text-emerald-400"></i>
            <span id="btn-privacy-text" class="text-[9px] font-black text-white uppercase tracking-widest">Hide SLC-ID</span>
        </button>
        <div id="privacy-warning" class="bg-rose-950/30 px-4 py-2 rounded-xl border border-rose-500/20 text-center animate-pulse">
            <p class="text-[8px] font-bold text-rose-500 uppercase tracking-wide leading-tight">
                <i data-lucide="alert-triangle" class="w-3 h-3 inline mr-1 mb-0.5"></i>
                Security Alert: Your ID is visible.
            </p>
        </div>
    </div>

    <div class="p-card-container" id="capture-zone">
        
        <div class="p-card-cyber-pattern"></div>

        <div class="p-card-header flex flex-col items-center justify-center">
            <p class="text-[7px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-1 leading-none text-center">Synthex Legion Chronicles</p>
            <h1 class="text-base font-black text-white uppercase italic tracking-tighter leading-none mb-2 text-center">SLC Bounty Hunter</h1>
            <div class="border border-white/10 bg-slate-900/50 px-3 py-1 rounded flex items-center justify-center h-5">
                <p class="text-[6px] font-bold text-slate-500 uppercase tracking-widest leading-none m-0 p-0">Official Player Profile</p>
            </div>
        </div>

        <div class="p-card-avatar-box">
            ${imgHTML}
            
            <div class="p-card-id-pill">
                <span id="preview-slc-id" data-full="${p.id}" data-masked="${maskedID}" class="text-[8px] font-black text-gold-500 uppercase tracking-widest leading-none whitespace-nowrap">SLC-ID: ${p.id}</span>
            </div>
        </div>

        <div class="p-card-name-strip flex flex-col items-center justify-center">
            <h2 class="text-xl font-black text-white uppercase italic tracking-tight drop-shadow-lg relative z-10 leading-none mb-2 text-center">${p.name}</h2>
            
            <div class="flex items-center justify-center gap-2 relative z-10">
                <div class="bg-white/5 h-5 px-2 rounded border border-white/10 flex items-center justify-center">
                    <span class="text-[8px] font-black text-white leading-none pt-[1px]">#${globalRank} GLOBAL</span>
                </div>
                <div class="h-5 flex items-center justify-center">
                    <span class="text-[8px] font-bold ${rankInfo.color} uppercase tracking-[0.2em] leading-none pt-[1px]">${rankInfo.name} Tier</span>
                </div>
            </div>
        </div>

        ${achievementHTML}

        <div class="p-card-grid">
            <div class="p-card-stat"><span class="text-[7px] text-slate-500 font-black uppercase leading-none">Matches</span><span class="text-[10px] font-black text-white leading-none">${p.mp || 0}</span></div>
            <div class="p-card-stat"><span class="text-[7px] text-slate-500 font-black uppercase leading-none">Bounty</span><span class="text-[10px] font-black text-emerald-400 leading-none">${(p.bounty || 0).toLocaleString()}</span></div>
            <div class="p-card-stat"><span class="text-[7px] text-emerald-500 font-black uppercase leading-none">Wins</span><span class="text-[10px] font-black text-white leading-none">${p.wins || 0}</span></div>
            <div class="p-card-stat"><span class="text-[7px] text-gold-500 font-black uppercase leading-none">Goals (S)</span><span class="text-[10px] font-black text-white leading-none">${p.goals || 0}</span></div>
            <div class="p-card-stat"><span class="text-[7px] text-rose-500 font-black uppercase leading-none">Losses</span><span class="text-[10px] font-black text-white leading-none">${p.losses || 0}</span></div>
            <div class="p-card-stat"><span class="text-[7px] text-blue-400 font-black uppercase leading-none">Goals (C)</span><span class="text-[10px] font-black text-white leading-none">${p._conceded || 0}</span></div>
        </div>

        <div class="p-card-footer flex items-center justify-center flex-col">
            <div class="h-[1px] w-10 bg-white/10 mb-2"></div>
            <p class="text-[6px] text-slate-600 font-black uppercase tracking-[0.2em] leading-none text-center">Generated via SLC-OS • ${new Date().toLocaleString()}</p>
        </div>
    </div>`;

    const previewArea = document.getElementById('preview-content-area');
    if(previewArea) {
        previewArea.innerHTML = html;
        openModal('modal-download-preview');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}


// 2. EXECUTE THE ACTUAL DOWNLOAD
// --- DOWNLOAD ENGINE (Fixed for Exact Fit) ---
async function executeDownload() {
    const sourceElement = document.getElementById('capture-zone');
    const exportContainer = document.getElementById('export-container');

    if (!sourceElement) return notify("Error: Preview Content Missing", "alert-circle");
    if (!exportContainer) return notify("System Error: Export Container Missing", "alert-circle");
    
    notify("Generating Image...", "download");

    try {
        // 1. Prepare Export Container
        exportContainer.innerHTML = ''; 
        
        // 2. Clone the Element
        const clone = sourceElement.cloneNode(true);
        
        // 3. Force Exact Styling on Clone to remove external spacing
        clone.style.margin = "0";
        clone.style.transform = "none"; 
        clone.style.position = "relative";
        clone.style.left = "auto";
        clone.style.top = "auto";
        clone.style.boxShadow = "none";
        
        // Add to hidden container
        exportContainer.appendChild(clone);
        
        // 4. Wait for DOM to paint
        await new Promise(resolve => setTimeout(resolve, 350));

        // 5. Capture with EXACT Dimensions
        // We measure the clone, not the original, to get the true render size
        const width = clone.offsetWidth;
        const height = clone.offsetHeight;

        const canvas = await html2canvas(clone, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#020617", // Force dark background
            scale: 2, // High Quality
            width: width,  // Exact width match
            height: height, // Exact height match
            scrollX: 0,
            scrollY: 0,
            logging: false
        });

        // 6. Save File
        const image = canvas.toDataURL("image/png", 0.9);
        const link = document.createElement('a');
        
        const timestamp = new Date().toLocaleTimeString().replace(/:/g, "-");
        link.download = `SLC-Card-${timestamp}.png`;
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
        notify(`Failed: ${err.message || "Unknown Error"}`, "x-circle");
    }
}



// --- UPDATED SCHEDULE GENERATOR (Pagination + BD Time + Details) ---

let currentPreviewPage = 1; // Global tracker for pagination

function showSchedulePreview(page = 1) {
    currentPreviewPage = page; // Update tracker

    // 1. Filter: Scheduled matches that have BOTH Date and Deadline
    const validMatches = state.matches
        .filter(m => m.status === 'scheduled' && m.scheduledDate && m.deadline)
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.deadline.localeCompare(b.deadline));

    if (validMatches.length === 0) return notify("No matches with Deadlines found!", "alert-circle");

    // 2. Pagination Logic (Max 8 per page)
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(validMatches.length / ITEMS_PER_PAGE);
    
    // Ensure page is within bounds
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const displayMatches = validMatches.slice(startIndex, endIndex);

    // 3. Determine Header Date
    const uniqueDates = [...new Set(displayMatches.map(m => m.scheduledDate))];
    const headerDate = uniqueDates.length === 1 ? uniqueDates[0] : "UPCOMING FIXTURES";

    // 4. Build Match Rows
    // 4. Build Match Rows (UPDATED LAYOUT)
    const rows = displayMatches.map(m => {
        const h = state.players.find(p => p.id === m.homeId);
        const a = state.players.find(p => p.id === m.awayId);
        
        // Time Formatting (Kept same)
        const dateObj = new Date(m.deadline);
        const bdTime = dateObj.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Dhaka',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const roundInfo = `PHASE ${m.phase} • R-${m.round || 1}`;
        
        return `
        <div class="schedule-export-row">
            <div class="schedule-players" style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
                
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end;">
                    ${getAvatarUI(h, "w-10", "h-10")}
                    <span style="font-size: 9px; font-weight: 800; color: #e2e8f0; text-transform: uppercase; text-align: right;">${h?.name || "TBD"}</span>
                </div>

                <div class="schedule-vs" style="margin: 0 5px;">VS</div>

                <div style="display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-start;">
                    <span style="font-size: 9px; font-weight: 800; color: #e2e8f0; text-transform: uppercase; text-align: left;">${a?.name || "TBD"}</span>
                    ${getAvatarUI(a, "w-10", "h-10")}
                </div>

            </div>

            <div class="schedule-info">
                <span class="schedule-badge" style="color:#64748b; font-size: 7px; margin-bottom: 2px;">${roundInfo}</span>
                <span class="schedule-badge" style="color:#10b981;">Deadline: <b class="schedule-highlight">${bdTime}</b></span>
            </div>
        </div>`;
    }).join('');

    // 5. Construct Final HTML (The Image Card)
    // Note: We add specific page number info to the footer
    const cardHtml = `
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
                All players are required to complete their fixtures by the <b style="color: #f59e0b;">DEADLINE</b> indicated in the header above. 
                <br>Page ${page} of ${totalPages}
             </p>
        </div>
    </div>`;

    // 6. Construct Pagination Controls (Not captured in image)
    let controlsHtml = '';
    if (totalPages > 1) {
        controlsHtml = `
        <div class="flex items-center justify-center gap-4 mt-6 mb-2">
            <button onclick="changeSchedulePage(-1)" ${page === 1 ? 'disabled class="opacity-30"' : ''} class="px-4 py-2 bg-slate-800 rounded-xl text-white text-[9px] font-black uppercase border border-white/10">
                <i data-lucide="chevron-left" class="w-4 h-4 inline"></i> Prev
            </button>
            <span class="text-gold-500 text-[10px] font-black uppercase tracking-widest">Page ${page} / ${totalPages}</span>
            <button onclick="changeSchedulePage(1)" ${page === totalPages ? 'disabled class="opacity-30"' : ''} class="px-4 py-2 bg-slate-800 rounded-xl text-white text-[9px] font-black uppercase border border-white/10">
                Next <i data-lucide="chevron-right" class="w-4 h-4 inline"></i>
            </button>
        </div>`;
    }

    // 7. Inject & Open
    const previewArea = document.getElementById('preview-content-area');
    if(previewArea) {
        previewArea.innerHTML = cardHtml + controlsHtml;
        
        // Only open modal if it's not already open (prevents flickering during page switch)
        const modal = document.getElementById('modal-download-preview');
        if (modal.classList.contains('hidden')) {
            openModal('modal-download-preview');
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Helper function to switch pages
function changeSchedulePage(direction) {
    showSchedulePreview(currentPreviewPage + direction);
}

// --- NEW FEATURE: HOME RANKING SWITCHER ---

function switchHomeRank(type) {
    const btnBounty = document.getElementById('tab-rank-bounty');
    const btnGoals = document.getElementById('tab-rank-goals');
    const viewBounty = document.getElementById('leaderboard-container');
    const viewGoals = document.getElementById('scorers-container');

    if (type === 'bounty') {
        viewBounty.classList.remove('hidden');
        viewGoals.classList.add('hidden');
        
        btnBounty.className = "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-emerald-600 text-white shadow-lg";
        btnGoals.className = "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-slate-500 hover:text-white";
    } else {
        viewBounty.classList.add('hidden');
        viewGoals.classList.remove('hidden');
        
        btnGoals.className = "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-gold-500 text-white shadow-lg";
        btnBounty.className = "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-slate-500 hover:text-white";
        
        renderTopScorers(); // Trigger render
    }
}


// [UPDATED] ADMIN TOOL: Recalculates goal counts AND checks milestones
async function adminSyncGoals() {
    askConfirm("Recalculate ALL goals & Check Milestones?", async () => {
        try {
            notify("Analyzing Match History...", "activity");
            
            const pSnap = await db.collection("players").get();
            const mSnap = await db.collection("matches").where('status', '==', 'played').get();
            
            // 1. Reset everyone to 0 in memory
            let goalMap = {}; 
            pSnap.forEach(doc => { goalMap[doc.id] = 0; });

            // 2. Tally up goals from match history
            mSnap.forEach(doc => {
                const m = doc.data();
                if (m.score) {
                    if (goalMap[m.homeId] !== undefined) goalMap[m.homeId] += (parseInt(m.score.h) || 0);
                    if (goalMap[m.awayId] !== undefined) goalMap[m.awayId] += (parseInt(m.score.a) || 0);
                }
            });

            // 3. Save correct goal counts
            const batch = db.batch();
            Object.keys(goalMap).forEach(pid => {
                const ref = db.collection("players").doc(pid);
                batch.update(ref, { goals: goalMap[pid] });
            });

            await batch.commit();
            
            // --- NEW: RETROACTIVE MILESTONE CHECK ---
            // Now that goals are correct, check if anyone earned a milestone
            notify("Verifying Milestones...", "star");
            for (const pid of Object.keys(goalMap)) {
                await checkAndRewardMilestones(pid);
            }
            // ------------------------------------------

            notify("Goals & Milestones Synced!", "check-circle");
            setTimeout(() => location.reload(), 2000);

        } catch (e) {
            console.error(e);
            notify("Sync Failed", "x-circle");
        }
    });
}



// --- NEW: HOME VIEW SECTION MANAGEMENT ---

function openShopSection() {
    document.getElementById('shop-box').classList.add('hidden');
    document.getElementById('scorers-box').classList.add('hidden');
    document.getElementById('shop-section').classList.remove('hidden');
    document.getElementById('top5-leaderboard-container').classList.add('hidden');
    document.getElementById('full-leaderboard-container').classList.add('hidden');
    document.querySelector('button[onclick="showStandingsPreview()"]').classList.add('hidden');
    
    // Force re-render of shop items
    renderShop();
}

function openTopScorersSection() {
    document.getElementById('shop-box').classList.add('hidden');
    document.getElementById('scorers-box').classList.add('hidden');
    document.getElementById('scorers-full-section').classList.remove('hidden');
    document.getElementById('top5-leaderboard-container').classList.add('hidden');
    document.getElementById('full-leaderboard-container').classList.add('hidden');
    document.querySelector('button[onclick="showStandingsPreview()"]').classList.add('hidden');
    
    // Render top scorers
    renderTopScorers();
}

function closeAllSections() {
    document.getElementById('shop-box').classList.remove('hidden');
    document.getElementById('scorers-box').classList.remove('hidden');
    document.getElementById('shop-section').classList.add('hidden');
    document.getElementById('scorers-full-section').classList.add('hidden');
    document.getElementById('top5-leaderboard-container').classList.remove('hidden');
    document.querySelector('button[onclick="showStandingsPreview()"]').classList.remove('hidden');
    
    // Make sure full leaderboard is hidden
    document.getElementById('full-leaderboard-container').classList.add('hidden');
}

function toggleLeaderboardView() {
    const top5Container = document.getElementById('top5-leaderboard-container');
    const fullContainer = document.getElementById('full-leaderboard-container');
    
    if (fullContainer.classList.contains('hidden')) {
        // Show full leaderboard
        top5Container.classList.add('hidden');
        fullContainer.classList.remove('hidden');
        renderFullLeaderboard();
    } else {
        // Show top 5 only
        fullContainer.classList.add('hidden');
        top5Container.classList.remove('hidden');
        renderTop5Leaderboard();
    }
}

function renderTop5Leaderboard() {
    const container = document.getElementById('top5-leaderboard-list');
    if (!container) return;
    
    // 1. Get Smart Sorted Data (Official Rules)
    const sortedPlayers = getSmartSortedPlayers();
    const top5 = sortedPlayers.slice(0, 5);
    
    // 2. Identify Current User
    const myID = localStorage.getItem('slc_user_id');
    const myRankIndex = sortedPlayers.findIndex(p => p.id === myID); // 0-based index
    
    container.innerHTML = '';
    
    // 3. Render Top 5 Loop
    top5.forEach((p, i) => {
        const rank = getRankInfo(p.bounty);
        const isTop3 = i < 3;
        const isOnFire = (p.currentStreak || 0) >= 3;
        
        let medal = '';
        if (i === 0) medal = '🥇';
        if (i === 1) medal = '🥈';
        if (i === 2) medal = '🥉';
        
        let borderClass = isTop3 ? 'moving-border-gold' : 'moving-border';
        if (isOnFire) borderClass = 'moving-border-flame'; 

        // Format GD string (e.g., +5, -2, 0)
        const gdSign = p._gd > 0 ? '+' : '';
        const gdDisplay = `${gdSign}${p._gd}`;

        container.innerHTML += `
            <div class="${borderClass} p-[1px] rounded-[1.4rem] mb-2">
                <div class="bg-slate-900 p-3 rounded-[1.3rem] flex items-center relative z-10">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="relative">
                            ${getAvatarUI(p, "w-10", "h-10")}
                            <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-950 rounded-full border border-white/5 flex items-center justify-center">
                                <span class="text-[7px] font-black ${isTop3 ? 'text-gold-500' : 'text-slate-500'}">#${i+1}</span>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1 mb-1">
                                <h3 class="text-[11px] font-black text-white truncate">${p.name}</h3>
                                ${medal ? `<span class="text-xs">${medal}</span>` : ''}
                                ${isOnFire ? `<span class="text-[7px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded font-black uppercase border border-orange-500/30 tracking-wider">🔥 ${p.currentStreak}</span>` : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[7px] ${rank.color} font-black uppercase">${rank.name}</span>
                                <span class="text-[7px] text-slate-500">•</span>
                                <span class="text-[7px] text-slate-400 font-bold">
                                    ${p.mp||0}M ${p.wins||0}W ${p.draws||0}D ${p.losses||0}L • <span class="${p._gd >= 0 ? 'text-emerald-500' : 'text-rose-500'}">GD ${gdDisplay}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right ml-2">
                        <p class="text-sm font-black ${isOnFire ? 'text-orange-400' : 'text-emerald-400'}">${p.bounty.toLocaleString()}</p>
                        <p class="text-[7px] text-slate-500 uppercase font-bold">BP</p>
                    </div>
                </div>
            </div>
        `;
    });

    // 4. --- PERSONAL RANKING (If outside Top 5) ---
    if (myID && myRankIndex >= 5) {
        const p = sortedPlayers[myRankIndex];
        const rank = getRankInfo(p.bounty);
        const isOnFire = (p.currentStreak || 0) >= 3;
        
        let borderClass = 'moving-border-blue';
        if (isOnFire) borderClass = 'moving-border-flame';

        const gdSign = p._gd > 0 ? '+' : '';
        const gdDisplay = `${gdSign}${p._gd}`;

        container.innerHTML += `
            <div class="flex items-center gap-2 my-3 opacity-60">
                <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <span class="text-[7px] font-black text-emerald-500 uppercase tracking-[0.2em]">Your Rank</span>
                <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
            
            <div class="${borderClass} p-[1px] rounded-[1.4rem] animate-pop-in shadow-lg shadow-emerald-500/5">
                <div class="bg-slate-900 p-3 rounded-[1.3rem] flex items-center relative z-10 border border-emerald-500/20">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="relative">
                            ${getAvatarUI(p, "w-10", "h-10")}
                            <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border border-slate-900 flex items-center justify-center shadow-lg">
                                <span class="text-[7px] font-black text-white">#${myRankIndex + 1}</span>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1 mb-1">
                                <h3 class="text-[11px] font-black ${isOnFire ? 'text-orange-400' : 'text-emerald-400'} truncate">${p.name} (You)</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[7px] ${rank.color} font-black uppercase">${rank.name}</span>
                                <span class="text-[7px] text-slate-500">•</span>
                                <span class="text-[7px] text-slate-400 font-bold">
                                    ${p.mp||0}M ${p.wins||0}W ${p.draws||0}D ${p.losses||0}L • <span class="${p._gd >= 0 ? 'text-emerald-500' : 'text-rose-500'}">GD ${gdDisplay}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right ml-2">
                        <p class="text-sm font-black text-white">${p.bounty.toLocaleString()}</p>
                        <p class="text-[7px] text-emerald-500 uppercase font-bold">BP</p>
                    </div>
                </div>
            </div>
        `;
    }
}

function renderFullLeaderboard() {
    const container = document.getElementById('full-leaderboard-list');
    if (!container) return;
    
    // Use the official sorting engine
    const sortedPlayers = getSmartSortedPlayers();
    container.innerHTML = '';
    
    sortedPlayers.forEach((p, i) => {
        const isTop3 = i < 3;
        const isOnFire = (p.currentStreak || 0) >= 3;
        
        let borderClass = isTop3 ? 'moving-border-gold' : 'moving-border-blue';
        if (isOnFire) borderClass = 'moving-border-flame';

        // GD Formatting
        const gdSign = p._gd > 0 ? '+' : '';
        const gdColor = p._gd >= 0 ? 'text-slate-400' : 'text-rose-500';

        container.innerHTML += `
            <div class="${borderClass} p-[1px] rounded-[1.2rem]">
                <div class="bg-slate-900 p-3 rounded-[1.1rem] flex items-center relative z-10">
                    <span class="text-[10px] font-black w-6 text-center ${isTop3 ? 'text-gold-500' : 'text-slate-600'}">#${i+1}</span>
                    
                    <div class="mx-2">${getAvatarUI(p, "w-8", "h-8")}</div>
                    
                    <div class="flex-1 overflow-hidden">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-xs text-white uppercase truncate block">${p.name}</span>
                            ${isOnFire ? `<i data-lucide="flame" class="w-3 h-3 text-orange-500 fill-orange-500"></i>` : ''}
                        </div>
                        <p class="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                           ${p.mp||0}M ${p.wins||0}W ${p.draws||0}D ${p.losses||0}L • <span class="${gdColor}">GD ${gdSign}${p._gd}</span>
                        </p>
                    </div>
                    <span class="font-black ${isOnFire ? 'text-orange-400' : 'text-emerald-400'} text-xs ml-2">${p.bounty.toLocaleString()}</span>
                </div>
            </div>
        `;
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}




// Update the renderTopScorers function to work with the new section:

function renderTopScorers() {
    const list = document.getElementById('top-scorers-list');
    if (!list) return;
    list.innerHTML = '';

    const scorers = [...state.players]
        .filter(p => (p.goals || 0) > 0)
        .sort((a, b) => (b.goals || 0) - (a.goals || 0) || (a.mp || 0) - (b.mp || 0));

    if (scorers.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8">
                <i data-lucide="target" class="w-12 h-12 text-slate-700 mx-auto mb-3"></i>
                <p class="text-[8px] text-slate-600 font-black uppercase italic">No Goals Recorded Yet</p>
                <p class="text-[7px] text-slate-700 mt-1">Score your first goal to enter the race!</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    scorers.forEach((p, index) => {
        const victimStats = {};
        let maxGoals = 0;
        let favoriteVictimName = "None";

        state.matches.forEach(m => {
            if (m.status === 'played') {
                let goalsScored = 0;
                let opponentId = null;

                if (m.homeId === p.id) { goalsScored = m.score.h; opponentId = m.awayId; }
                if (m.awayId === p.id) { goalsScored = m.score.a; opponentId = m.homeId; }

                if (goalsScored > 0 && opponentId) {
                    victimStats[opponentId] = (victimStats[opponentId] || 0) + goalsScored;
                    if (victimStats[opponentId] > maxGoals) {
                        maxGoals = victimStats[opponentId];
                        const victimObj = state.players.find(v => v.id === opponentId);
                        favoriteVictimName = victimObj ? victimObj.name.split(' ')[0] : "Unknown";
                    }
                }
            }
        });

        let rankColor = "text-slate-500"; 
        let borderClass = "moving-border-blue";
        let badgeClass = "bg-slate-500/10 text-slate-500";

        if (index === 0) { 
            rankColor = "text-gold-500"; 
            borderClass = "moving-border-gold";
            badgeClass = "bg-gold-500/10 text-gold-500";
        }
        if (index === 1) { 
            rankColor = "text-slate-300"; 
            badgeClass = "bg-slate-400/10 text-slate-400";
        }
        if (index === 2) { 
            rankColor = "text-rose-400"; 
            badgeClass = "bg-rose-500/10 text-rose-500";
        }

        list.innerHTML += `
            <div class="${borderClass} p-[1px] rounded-[1.4rem]">
                <div class="bg-slate-900 p-4 rounded-[1.3rem] flex items-center justify-between relative z-10">
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            ${getAvatarUI(p, "w-10", "h-10")}
                            <div class="absolute -top-1 -right-1 w-5 h-5 bg-slate-950 rounded-full border border-white/5 flex items-center justify-center">
                                <span class="text-[8px] font-black ${rankColor}">#${index + 1}</span>
                            </div>
                        </div>
                        <div>
                            <h3 class="text-xs font-black text-white uppercase tracking-wide">${p.name}</h3>
                            <p class="text-[7px] text-slate-500 font-bold uppercase mt-0.5">
                                favorite Opponent: <span class="text-rose-500">${favoriteVictimName}</span>
                            </p>
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="${badgeClass} px-3 py-2 rounded-xl border ${borderClass.includes('gold') ? 'border-gold-500/20' : 'border-white/5'}">
                            <span class="block text-xl font-black ${rankColor} leading-none">${p.goals || 0}</span>
                            <span class="text-[6px] text-slate-600 font-black uppercase tracking-widest">GOALS</span>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- UPDATE YOUR EXISTING REFRESH UI FUNCTION ---
function refreshUI() {
    const rawID = localStorage.getItem('slc_user_id') || "";
    const myID = rawID.toUpperCase();
    
    // Calculate streaks for all players
    state.players.forEach(p => {
        p.currentStreak = calculateWinStreak(p.id);
    });

    const myPlayer = state.players.find(p => p?.id && p.id.toUpperCase() === myID);
    
    // Update individual bounty display
    const userBountyEl = document.getElementById('user-bounty-display');
    if (userBountyEl) {
        if (state.isAdmin) {
            userBountyEl.innerText = "ADMIN MODE";
        } else if (myPlayer) {
            userBountyEl.innerText = `${(Number(myPlayer.bounty) || 0).toLocaleString()} BP`;
        }
    }
    
    // Update global pool display
    const totalBP = state.players.reduce((sum, p) => sum + (Number(p?.bounty) || 0), 0);
    const poolEl = document.getElementById('total-pool-display');
    if (poolEl) poolEl.innerText = `POOL: ${totalBP.toLocaleString()} BP`;

    // --- NEW: HEADER HUD DATA INJECTION ---
    const headerAvatar = document.getElementById('header-user-avatar');
    const phaseInd = document.getElementById('phase-indicator');
    const idBadge = document.getElementById('user-id-badge');

    if (headerAvatar && myPlayer) {
        // Injects player photo into the right HUD wing
        headerAvatar.innerHTML = getAvatarUI(myPlayer, "w-full", "h-full", "text-[10px]");
    }

    if (phaseInd) {
        // Updates the P1/P2/P3 text in the central command core
        phaseInd.innerText = `P${state.activePhase}`;
    }

    if (idBadge && myPlayer) {
        // Displays masked ID in the right HUD module
        idBadge.innerText = myPlayer.id;
    }
    // --------------------------------------
    
    checkPhaseLocks();

    try {
        renderTop5Leaderboard();
        
        // --- ADD THIS LINE HERE ---
        // This ensures the thin box on the home screen updates automatically
        renderBettingAnalytics(); 

        // Update Shop if visible
        if (document.getElementById('shop-section') && !document.getElementById('shop-section').classList.contains('hidden')) {
            renderShop();
        }
        
        // Update Scorers if visible
        if (document.getElementById('scorers-full-section') && !document.getElementById('scorers-full-section').classList.contains('hidden')) {
            renderTopScorers();
        }

        checkVaultStatus();
        renderSchedule();
        renderEliteBracket();
        renderBrokerBoard(); 
        renderPlayerDashboard();
        renderNewsTicker();
        checkPriorityMatches(); 

        // Refresh Lucide icons to ensure new header elements render correctly
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error("UI Render Error:", err);
    }
}

// [MOVED] checkTournamentWinner: Now completely outside and global
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

// --- PRIORITY MATCH ALERT SYSTEM ---

function checkPriorityMatches() {
    // 1. Prevent showing if already shown this session or if user is Admin
    if (state.matchAlertShown || state.isAdmin) return;

    const myID = localStorage.getItem('slc_user_id');
    if (!myID) return;

    // 2. Find Pending Matches
    // We look for: Status = Scheduled AND (Home = Me OR Away = Me)
    const pendingMatches = state.matches.filter(m => 
        m.status === 'scheduled' && 
        (m.homeId === myID || m.awayId === myID) &&
        m.deadline // Must have a deadline set
    );

    if (pendingMatches.length === 0) return;

    // 3. Sort by Urgency (Closest Deadline First)
    pendingMatches.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    // 4. Pick the most urgent match
    const urgentMatch = pendingMatches[0];
    
    // 5. Populate Data
    const opponentId = urgentMatch.homeId === myID ? urgentMatch.awayId : urgentMatch.homeId;
    const opponent = state.players.find(p => p.id === opponentId);
    const opName = opponent ? opponent.name : "Unknown Rival";
    
    // Format Date
    const d = new Date(urgentMatch.deadline);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    document.getElementById('alert-opponent-name').innerText = opName;
    document.getElementById('alert-phase-badge').innerText = `PHASE ${urgentMatch.phase} • ROUND ${urgentMatch.round || 1}`;
    document.getElementById('alert-deadline-text').innerText = `${dateStr} @ ${timeStr}`;

    // 6. Start Live Countdown
    startAlertCountdown(urgentMatch.deadline);

    // 7. Show Modal
    document.getElementById('modal-match-alert').classList.remove('hidden');
    state.matchAlertShown = true; // Mark as shown so it doesn't pop up again on this refresh
}

function startAlertCountdown(deadlineISO) {
    if (alertInterval) clearInterval(alertInterval);

    const timerEl = document.getElementById('alert-countdown-timer');
    const target = new Date(deadlineISO).getTime();

    const update = () => {
        const now = Date.now();
        const diff = target - now;

        if (diff <= 0) {
            timerEl.innerText = "00:00:00";
            timerEl.classList.add('text-rose-600');
            clearInterval(alertInterval);
            return;
        }

        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        // Format: 05h : 30m : 12s
        timerEl.innerText = `${h.toString().padStart(2, '0')}h : ${m.toString().padStart(2, '0')}m : ${s.toString().padStart(2, '0')}s`;
    };

    update(); // Run immediately
    alertInterval = setInterval(update, 1000);
}

function dismissMatchAlert() {
    const modal = document.getElementById('modal-match-alert');
    modal.classList.add('hidden'); // Just hide, don't remove animation classes so it works next time
    if (alertInterval) clearInterval(alertInterval);
}

// --- ADMIN TOOL: MANUAL HISTORY OVERRIDE ---
async function manualMarkAsSold(targetId, itemKey) {
    if (!targetId || !itemKey) return notify("Missing ID or Item", "alert-circle");
    
    // Normalize ID
    const pid = targetId.trim().toUpperCase();
    
    try {
        const doc = await db.collection("players").doc(pid).get();
        if (!doc.exists) return notify("Player ID not found", "x-circle");
        
        // Update their history to say "True" (Bought)
        await db.collection("players").doc(pid).update({
            [`purchase_history.${itemKey}`]: true
        });
        
        notify(`Marked '${itemKey}' as SOLD OUT for ${doc.data().name}`, "check-circle");
        
    } catch(e) {
        console.error(e);
        notify("Update Failed", "x-circle");
    }
}

// ==========================================
// [NEW FEATURE] BP TRANSACTION HISTORY ENGINE
// ==========================================

// 1. Helper to Save Log to Database
function logTransaction(uid, amount, cat, desc) {
    const pRef = db.collection("players").doc(uid);
    const logEntry = {
        id: `TX_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ts: Date.now(),
        amount: amount, // Positive for earnings, negative for expenses
        cat: cat, // 'Betting', 'Match', 'Shop', etc.
        desc: desc
    };
    
    // This ensures the array is updated correctly in Firestore
    pRef.update({
        bp_logs: firebase.firestore.FieldValue.arrayUnion(logEntry)
    });
}

// 2. Render the History Modal
async function openBPHistory() {
    const myID = localStorage.getItem('slc_user_id');
    const list = document.getElementById('bp-history-list');
    const totalInEl = document.getElementById('hist-total-in');
    const totalOutEl = document.getElementById('hist-total-out');
    
    if (!myID || !list) return;
    
    list.innerHTML = `<div class="text-center py-10"><i data-lucide="loader" class="w-6 h-6 text-gold-500 animate-spin mx-auto"></i></div>`;
    document.getElementById('modal-bp-history').classList.remove('hidden');
    
    try {
        const doc = await db.collection("players").doc(myID).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        const logs = data.bp_logs || [];
        
        // Sort: Newest first
        logs.sort((a, b) => b.ts - a.ts);
        
        // Calc Totals
        let totalIn = 0;
        let totalOut = 0;
        
        let html = '';
        
        if (logs.length === 0) {
            html = `<p class="text-center text-[8px] text-slate-500 font-black uppercase mt-10">No Transactions Recorded</p>`;
        } else {
            logs.forEach(log => {
                const isGain = log.amount >= 0;
                if (isGain) totalIn += log.amount;
                else totalOut += Math.abs(log.amount);
                
                const dateStr = new Date(log.ts).toLocaleDateString() + " " + new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const color = isGain ? 'text-emerald-400' : 'text-rose-500';
                const bg = isGain ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20';
                const sign = isGain ? '+' : '';
                const icon = isGain ? 'arrow-down-left' : 'arrow-up-right';
                
                html += `
                <div class="bg-slate-950/80 p-3 rounded-xl border border-white/5 flex items-center justify-between animate-pop-in">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${bg} border flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-4 h-4 ${color}"></i>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-white uppercase tracking-wide">${log.cat}</p>
                            <p class="text-[8px] font-bold text-slate-500 truncate max-w-[120px]">${log.desc}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black ${color}">${sign}${log.amount}</p>
                        <p class="text-[6px] text-slate-600 font-bold uppercase">${dateStr}</p>
                    </div>
                </div>`;
            });
        }
        
        list.innerHTML = html;
        totalInEl.innerText = totalIn.toLocaleString();
        totalOutEl.innerText = totalOut.toLocaleString();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (e) {
        console.error(e);
        list.innerHTML = `<p class="text-center text-rose-500 text-[8px]">Error loading data</p>`;
    }
}

// ==========================================
// [ADMIN TOOL] TIME MACHINE (HISTORY SYNC)
// ==========================================
async function forceRebuildHistory() {
    askConfirm("DANGER: WIPE & REBUILD ALL HISTORY?", async () => {
        const notifId = notify("Time Machine Started...", "loader");
        const batch = db.batch();
        const players = state.players;
        const matches = state.matches.filter(m => m.status === 'played');

        console.log(`Analyzing ${players.length} players and ${matches.length} matches...`);

        // Iterate every player
        players.forEach(p => {
            const pid = p.id;
            const pRef = db.collection("players").doc(pid);
            let reconstructedLogs = [];

            // 1. ADD: Initial Welcome Bonus (The Foundation)
            reconstructedLogs.push({
                id: `init_${pid}`,
                ts: 1704067200000, // Jan 1 2024 (Approx start)
                amount: 500,
                cat: 'System',
                desc: 'Initial Bounty Grant'
            });

            // 2. ADD: Match History
            matches.forEach(m => {
                // Skip if this player wasn't in this match
                if (m.homeId !== pid && m.awayId !== pid) return;

                const isHome = m.homeId === pid;
                const oppId = isHome ? m.awayId : m.homeId;
                const oppName = state.players.find(x => x.id === oppId)?.name || "Opponent";
                
                let amount = 0;
                let cat = "Match";

                // A. TRY EXACT DATA (If available from newer versions)
                if (m.resultDelta) {
                    amount = isHome ? m.resultDelta.h : m.resultDelta.a;
                } 
                // B. ESTIMATE LEGACY DATA (If exact delta missing)
                else {
                    const sH = parseInt(m.score.h);
                    const sA = parseInt(m.score.a);
                    
                    if (sH === sA) {
                        amount = -30; // Standard Draw Penalty
                    } else if ((isHome && sH > sA) || (!isHome && sA > sH)) {
                        amount = 100; // Standard Win
                    } else {
                        amount = -50; // Standard Loss
                    }
                }

                cat = amount > 0 ? 'Match Win' : (amount < 0 ? 'Match Loss' : 'Match Draw');

                reconstructedLogs.push({
                    id: `legacy_match_${m.id}`,
                    ts: m.createdAt || (Date.now() - 1000000), // Use match time or older date
                    amount: parseInt(amount),
                    cat: cat,
                    desc: `Vs ${oppName}`
                });
            });

            // 3. ADD: Purchase History
            // Check 'purchase_history' OR inferred from 'inventory'
            const purchases = p.purchase_history || {};
            const inventory = p.inventory || {};
            
            // Merge both sources
            const allItems = new Set([...Object.keys(purchases), ...Object.keys(inventory)]);

            allItems.forEach(key => {
                // Skip vault items as they are deposits, not costs
                if (key === 'vault_access') return; 
                
                const itemDef = SHOP_ITEMS[key];
                if (itemDef) {
                    reconstructedLogs.push({
                        id: `legacy_buy_${key}`,
                        ts: Date.now(), // No date for legacy buys, set to now
                        amount: -itemDef.price,
                        cat: 'Shop',
                        desc: `Purchased ${itemDef.name}`
                    });
                }
            });

            // 4. ADD: Vault Logic
            if (p.vault_data && p.vault_data.amount > 0) {
                 reconstructedLogs.push({
                    id: `legacy_vault_lock`,
                    ts: p.vault_data.depositedAt || Date.now(),
                    amount: -p.vault_data.amount,
                    cat: 'Vault',
                    desc: 'Locked Funds (Active)'
                });
            }

            // 5. SORT & SAVE
            // Sort by timestamp (newest first)
            reconstructedLogs.sort((a, b) => b.ts - a.ts);

            // Overwrite the log array
            batch.update(pRef, { bp_logs: reconstructedLogs });
        });

        try {
            await batch.commit();
            notify("History Successfully Rebuilt!", "check-circle");
            setTimeout(() => location.reload(), 2000);
        } catch (e) {
            console.error(e);
            notify("Rebuild Failed", "x-circle");
        }
    });
}
// --- NEW ADMIN FUNCTION ---
async function toggleBettingSystem() {
    const action = state.bettingActive ? "STOP" : "ACTIVATE";
    askConfirm(`${action} global betting? Existing bets remain valid.`, async () => {
        try {
            await db.collection("settings").doc("global").set({
                bettingActive: !state.bettingActive
            }, { merge: true });
            
            notify(`Betting System ${state.bettingActive ? 'Stopped' : 'Activated'}`, "check-circle");
        } catch (e) {
            console.error(e);
            notify("Update Failed", "x-circle");
        }
    });
}

// ==========================================
// BETTING ANALYTICS & LEDGER SYSTEM
// ==========================================

function openBettingAnalytics() {
    // Hide standard view components
    document.getElementById('shop-box').classList.add('hidden');
    document.getElementById('scorers-box').classList.add('hidden');
    document.getElementById('betting-stats-box').classList.add('hidden');
    document.getElementById('top5-leaderboard-container').classList.add('hidden');
    document.getElementById('full-leaderboard-container').classList.add('hidden');
    const dlBtn = document.querySelector('button[onclick="showStandingsPreview()"]');
    if (dlBtn) dlBtn.classList.add('hidden');
    
    // Show analytics view
    document.getElementById('betting-analytics-section').classList.remove('hidden');
    renderBettingAnalytics();
}

async function renderBettingAnalytics() {
    const phaseFilter = document.getElementById('filter-bet-phase')?.value || 'all';
    const roundFilter = document.getElementById('filter-bet-round')?.value || 'all';

    try {
        const snapshot = await db.collection("bets").get();
        const allBets = snapshot.docs.map(doc => doc.data());
        
        const filteredBets = allBets.filter(bet => {
            const match = state.matches.find(m => m.id === bet.matchId);
            if (!match) return false;
            const matchPhase = (match.phase || "").toString();
            const matchRound = (match.round || "").toString();
            const matchesPhase = (phaseFilter === 'all' || matchPhase === phaseFilter);
            const matchesRound = (roundFilter === 'all' || matchRound === roundFilter);
            return matchesPhase && matchesRound;
        });

        // Initialize calculation variables
        let totalBetVolume = 0;
        let totalWonCount = 0;
        let totalLostCount = 0;
        let totalBPWonValue = 0;  
        let totalBPLostValue = 0; 
        let totalHouseRevenue = 0; 

        filteredBets.forEach(b => {
            const stake = parseInt(b.stake) || 0;
            const burn = parseInt(b.burnFee) || 0; 
            const tax = parseInt(b.taxPaid) || 0;
            
            totalBetVolume += stake;
            
            // House Profit = Fees collected upon entry + Tax collected upon win
            totalHouseRevenue += (burn + tax);

            if (b.status === 'won') {
                totalWonCount++;
                totalBPWonValue += (parseInt(b.potentialPayout) || 0);
            } else if (b.status === 'lost') {
                totalLostCount++;
                totalBPLostValue += stake;
            }
        });

        const avgBet = filteredBets.length > 0 ? Math.floor(totalBetVolume / filteredBets.length) : 0;

        // Push data to the Full Ledger UI (New IDs Included)
        if (document.getElementById('ledger-volume')) {
            document.getElementById('ledger-volume').innerText = totalBetVolume.toLocaleString() + " BP";
            document.getElementById('ledger-won').innerText = totalWonCount;
            document.getElementById('ledger-lost').innerText = totalLostCount;
            document.getElementById('ledger-avg').innerText = avgBet + " BP";
            
            document.getElementById('ledger-bp-won').innerText = totalBPWonValue.toLocaleString() + " BP";
            document.getElementById('ledger-bp-lost').innerText = totalBPLostValue.toLocaleString() + " BP";
            
            // Push total house profit to UI
            const houseProfitEl = document.getElementById('ledger-house-profit');
            if (houseProfitEl) houseProfitEl.innerText = totalHouseRevenue.toLocaleString() + " BP";
        }

        // Update the "Thin Box" on the Home Screen
        const homeBetEl = document.getElementById('stat-total-bet');
        const homeTaxEl = document.getElementById('stat-total-tax');
        if (homeBetEl) homeBetEl.innerText = totalBetVolume.toLocaleString() + " BP";
        if (homeTaxEl) homeTaxEl.innerText = totalHouseRevenue.toLocaleString() + " BP"; 

    } catch (e) {
        console.error("Betting Analytics Error:", e);
    }
}




/**
 * Guideline: Update your closeAllSections function to restore the thin box
 */
function closeAllSections() {
    // Standard section visibility resets
    document.getElementById('shop-box').classList.remove('hidden');
    document.getElementById('scorers-box').classList.remove('hidden');
    document.getElementById('betting-stats-box').classList.remove('hidden'); // Show the thin box again
    
    document.getElementById('shop-section').classList.add('hidden');
    document.getElementById('scorers-full-section').classList.add('hidden');
    document.getElementById('betting-analytics-section').classList.add('hidden'); // Hide ledger
    
    document.getElementById('top5-leaderboard-container').classList.remove('hidden');
    const dlBtn = document.querySelector('button[onclick="showStandingsPreview()"]');
    if (dlBtn) dlBtn.classList.remove('hidden');
}

// --- NEW FUNCTION: SHOW PASS REWARDS PREVIEW ---
function showPassPreview(type) {
    const listContainer = document.getElementById('pass-reward-list');
    const titleEl = document.getElementById('pass-detail-title');
    const subtitleEl = document.getElementById('pass-detail-subtitle');
    const buyBtn = document.getElementById('btn-confirm-pass-buy');
    
    if (!listContainer) return;
    
    const config = PASS_CONFIG[type];
    const rewards = PASS_REWARDS[type];
    
    titleEl.innerText = `${type.toUpperCase()} PHASE PASS`;
    subtitleEl.innerText = `Price: 
    ${config.cost} BP | Rebate: ${config.rebate} BP / Win`;
    
    // Set the button to the actual purchase function
    buyBtn.onclick = () => {
        closeModal('modal-pass-details');
        buyPass(type);
    };
    buyBtn.className = `w-full py-4 ${type === 'premium' ? 'bg-gold-600 shadow-gold-600/20' : 'bg-blue-600 shadow-blue-600/20'} text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all`;
    
    listContainer.innerHTML = '';
    
    rewards.forEach((item, index) => {
        let rewardName = "";
        let rewardIcon = "gift";
        let colorClass = "text-slate-400";
        let bgClass = "bg-white/5";
        
        if (item.type === 'item') {
    const itemInfo = SHOP_ITEMS[item.id];
    rewardName = `Tactical ${itemInfo.name}`;
    rewardIcon = itemInfo.icon;
    colorClass = "text-emerald-400";
} else if (item.type === 'bp') {
    let amount = 0;
    if (type === 'premium') {
        // Premium: 2nd(idx 1), 4th(idx 3), 7th(idx 6) = 50BP | 9th(idx 8) = 100BP | Else 10BP
        if (index === 1 || index === 3 || index === 6) {
            amount = 50;
        } else if (index === 8) {
            amount = 100;
        } else {
            amount = 10;
        }
    } else {
        amount = (index === 5 || index === 7 || index === 8) ? 20 : 10;
    }
    rewardName = `+${amount} BP Bonus`;
    rewardIcon = "coins";
    colorClass = "text-gold-500";
} else if (item.type === 'badge') {
            rewardName = `Title: ${item.id}`;
            rewardIcon = "award";
            colorClass = "text-blue-400";
        } else if (item.type === 'vault') {
            rewardName = "The Vault Key";
            rewardIcon = "lock";
            colorClass = "text-purple-400";
        }
        
        listContainer.innerHTML += `
            <div class="flex items-center gap-3 p-3 ${bgClass} border border-white/5 rounded-2xl">
                <div class="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center font-black text-[10px] text-slate-500 border border-white/5">
                    ${index + 1}
                </div>
                <div class="flex-1">
                    <p class="text-[6px] text-slate-500 font-bold uppercase tracking-widest">Match Win Reward</p>
                    <p class="text-[9px] font-black text-white uppercase">${rewardName}</p>
                </div>
                <i data-lucide="${rewardIcon}" class="w-4 h-4 ${colorClass}"></i>
            </div>
        `;
    });
    
    openModal('modal-pass-details');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

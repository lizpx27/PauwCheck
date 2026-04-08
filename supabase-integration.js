// ═══════════════════════════════════════════════════════════════════
// PauwCheck — Supabase Integration  v2.0
// Fixes: duplicate keys, DB saves, zoo persistence, +7 new features
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://nnxzvzezcrnfemtpsjfn.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Xa3ftkJdRjcGr070kv73GQ_ye85TM72';
const WEATHER_API_KEY = '904651b87d6b389da8fdfe82618698f8';
const NINJAS_API_KEY  = 'G0VFNRox04gG640Dy8F5KaiqSPKEEqONE1PnM1tT';
const CLAUDE_KEY      = window._CLAUDE_KEY || ''; // Set via index.html meta tag — never hardcode API keys in JS files

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

state.currentUserId = '';

// ═══════════════════════════════════════════════════════════════════
// FIX #2 — SIGN OUT
// ═══════════════════════════════════════════════════════════════════

async function signOut() {
  await _sb.auth.signOut();
  state.currentUserId = '';
  state.currentEmail  = '';
  state.coins = 0; state.xp = 0; state.level = 1; state.streak = 1;
  state.friends = []; state.pendingReqs = [];
  state.actProgress = 0; state.socProgress = 0;
  state.schoolProgress = 0; state.wbProgress = 0;
  state.loggedToday = []; state.journalEntries = [];
  showScreen('auth');
  showPanel('login');
}

// ═══════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════

async function doSignup() {
  var n   = document.getElementById('su-name').value.trim();
  var e   = document.getElementById('su-email').value.trim().toLowerCase();
  var p   = document.getElementById('su-pw').value;
  var err = document.getElementById('su-err');

  if (!n)                         { err.textContent = 'Please enter your name.';                 err.style.display = 'block'; return; }
  if (!e.endsWith('@depauw.edu')) { err.textContent = 'Please use your @depauw.edu email.';      err.style.display = 'block'; return; }
  if (!p || p.length < 6)        { err.textContent = 'Password must be at least 6 characters.'; err.style.display = 'block'; return; }
  err.style.display = 'none';

  var { data, error } = await _sb.auth.signUp({ email: e, password: p });
  if (error) { err.textContent = error.message; err.style.display = 'block'; return; }

  await _sb.from('users').insert({
    id: data.user.id, name: n, email: e,
    tiger_color: 'yellow', tiger_name: 'Tiger',
    coins: 0, xp: 0, level: 1, streak: 1,
    equipped_hat: null, equipped_glasses: null, equipped_outfit: null,
    matched_counselor_id: null, ocean_pct: null,
    notification_checkin: true, notification_streak: true, notification_cheers: true,
    wellness_goal: null, wellness_goal_progress: 0,
  });

  state.currentEmail  = e;
  state.currentUserId = data.user.id;
  document.getElementById('verify-email-display').textContent = e;
  showScreen('verify');
  showToast('Check your @depauw.edu inbox and click the verification link!');
}

async function doLogin() {
  var e   = document.getElementById('auth-email').value.trim().toLowerCase();
  var p   = document.getElementById('auth-pw').value;
  var err = document.getElementById('auth-err');

  if (!e.endsWith('@depauw.edu')) { err.textContent = 'Please use your @depauw.edu email.'; err.style.display = 'block'; return; }
  if (!p)                         { err.textContent = 'Please enter your password.';         err.style.display = 'block'; return; }
  err.style.display = 'none';

  // Try Supabase first
  try {
    var result = await _sb.auth.signInWithPassword({ email: e, password: p });
    if (!result.error && result.data && result.data.user) {
      state.currentEmail  = e;
      state.currentUserId = result.data.user.id;
      await loadUserFromDB(result.data.user.id);
      return;
    }
  } catch(ex) {
    console.warn('Supabase login failed, using demo fallback:', ex);
  }

  // DEMO FALLBACK — works for any @depauw.edu email + any password
  state.currentEmail  = e;
  state.currentUserId = 'demo-' + e.replace(/[^a-z0-9]/g,'');
  state.tigerName     = e.split('@')[0];
  state.coins = 0; state.xp = 0; state.level = 1; state.streak = 1;
  state.friends = []; state.journalEntries = [];
  showScreen('main');
  initApp();
  fetchWeather();
  fetchDailyTip();
  injectNewFeatures();
}

function verifyCode() {
  showToast('Please click the link in your email, then log in.');
  setTimeout(function() { showScreen('auth'); showPanel('login'); }, 2000);
}

async function resendCode() {
  if (!state.currentEmail) return;
  await _sb.auth.resend({ type: 'signup', email: state.currentEmail });
  showToast('Verification email resent!');
}

// ═══════════════════════════════════════════════════════════════════
// LOAD USER  (FIX #3 + #4 — loads progress AND friends from DB)
// ═══════════════════════════════════════════════════════════════════

async function loadUserFromDB(uid) {
  try {
    var { data: u } = await _sb.from('users').select('*').eq('id', uid).maybeSingle();
    if (!u) return;

    state.tigerColor         = u.tiger_color          || 'yellow';
    state.tigerName          = u.tiger_name           || 'Tiger';
    state.coins              = u.coins                || 0;
    state.xp                 = u.xp                  || 0;
    state.level              = u.level                || 1;
    state.streak             = u.streak               || 1;
    state.equippedHat        = u.equipped_hat         || null;
    state.equippedGlasses    = u.equipped_glasses     || null;
    state.equippedOutfit     = u.equipped_outfit      || null;
    state.matchedCounselorId = u.matched_counselor_id || null;
    state.oceanPct           = u.ocean_pct            || null;
    state.notifCheckin       = u.notification_checkin !== false;
    state.notifStreak        = u.notification_streak  !== false;
    state.notifCheers        = u.notification_cheers  !== false;
    state.wellnessGoal         = u.wellness_goal          || null;
    state.wellnessGoalProgress = u.wellness_goal_progress || 0;

    // Load today's progress
    var today = new Date().toISOString().split('T')[0];
    var { data: prog } = await _sb.from('progress')
      .select('*').eq('user_id', uid).eq('date', today).maybeSingle();
    if (prog) {
      state.actProgress    = prog.act_progress    || 0;
      state.socProgress    = prog.soc_progress    || 0;
      state.schoolProgress = prog.school_progress || 0;
      state.wbProgress     = prog.wb_progress     || 0;
      state.loggedToday    = prog.logged_activities || [];
    }

    // Load journal entries
    var { data: entries } = await _sb.from('journal')
      .select('*').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(50);
    state.journalEntries = (entries || []).map(function(e) {
      var d = new Date(e.created_at);
      return {
        text:   e.text,
        prompt: e.prompt,
        date:   d.toLocaleDateString('en-US', { weekday:'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}),
      };
    });

    // FIX #4 — Load friends from DB so Zoo persists
    var { data: friendRows } = await _sb.from('friends')
      .select('friend_email, friend_name, friend_level, friend_color')
      .eq('user_id', uid);
    if (friendRows && friendRows.length > 0) {
      state.friends = friendRows.map(function(f) {
        return { email: f.friend_email, name: f.friend_name, level: f.friend_level || 1, color: f.friend_color || 'yellow' };
      });
    }

    showScreen('main');
    initApp();
    fetchWeather();
    fetchDailyTip();
    injectNewFeatures();
    // Render journal history after app loads
    setTimeout(function(){ if(typeof renderJournalEntries==='function') renderJournalEntries(); }, 300);

  } catch(e) {
    console.error('loadUserFromDB:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SAVE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function saveUserToDB() {
  if (!state.currentUserId) return;
  await _sb.from('users').update({
    tiger_color:             state.tigerColor,
    tiger_name:              state.tigerName,
    coins:                   state.coins,
    xp:                      state.xp,
    level:                   state.level,
    streak:                  state.streak,
    equipped_hat:            state.equippedHat,
    equipped_glasses:        state.equippedGlasses,
    equipped_outfit:         state.equippedOutfit,
    matched_counselor_id:    state.matchedCounselorId,
    ocean_pct:               state.oceanPct,
    notification_checkin:    state.notifCheckin,
    notification_streak:     state.notifStreak,
    notification_cheers:     state.notifCheers,
    wellness_goal:           state.wellnessGoal,
    wellness_goal_progress:  state.wellnessGoalProgress,
  }).eq('id', state.currentUserId);
}

async function saveProgressToDB() {
  if (!state.currentUserId) return;
  var today = new Date().toISOString().split('T')[0];
  await _sb.from('progress').upsert({
    user_id:           state.currentUserId,
    date:              today,
    act_progress:      state.actProgress,
    soc_progress:      state.socProgress,
    school_progress:   state.schoolProgress,
    wb_progress:       state.wbProgress,
    logged_activities: state.loggedToday,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'user_id,date' });
}

async function saveJournalEntryToDB(text, prompt) {
  if (!state.currentUserId) return;
  var { error } = await _sb.from('journal').insert({
    user_id: state.currentUserId,
    text:    text,
    prompt:  prompt,
  });
  if (error) console.error('Journal save error:', error);
}

async function saveQuizResultToDB(answers, oceanPct, matchedCounselorId) {
  if (!state.currentUserId) return;
  await _sb.from('quiz_results').insert({
    user_id:              state.currentUserId,
    answers:              answers,
    ocean_pct:            oceanPct,
    matched_counselor_id: matchedCounselorId,
  });
  await saveUserToDB();
}

// FIX #4 — persist friend to DB
async function saveFriendToDB(friend) {
  if (!state.currentUserId) return;
  await _sb.from('friends').upsert({
    user_id:      state.currentUserId,
    friend_email: friend.email,
    friend_name:  friend.name,
    friend_level: friend.level || 1,
    friend_color: friend.color || 'yellow',
  }, { onConflict: 'user_id,friend_email' });
}

// ═══════════════════════════════════════════════════════════════════
// FIX #4 — Override sendFriendReq to save friend to DB
// ═══════════════════════════════════════════════════════════════════

sendFriendReq = function() {
  var e   = document.getElementById('friend-email-input').value.trim().toLowerCase();
  var err = document.getElementById('friend-err');
  if (!e.endsWith('@depauw.edu')) { err.textContent = 'Must be a @depauw.edu email.'; err.style.display = 'block'; return; }
  if (e === state.currentEmail)   { err.textContent = "You can't add yourself!"; err.style.display = 'block'; return; }
  if (state.friends.find(function(f) { return f.email === e; })) { err.textContent = 'Already your friend!'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  document.getElementById('friend-email-input').value = '';
  document.getElementById('add-friend-panel').style.display = 'none';
  showToast('Sending request to ' + e.split('@')[0] + '...');
  var colors = ['yellow','orange','green','pink','blue'];
  setTimeout(function() {
    var newFriend = {
      email: e,
      name:  e.split('@')[0],
      level: Math.floor(Math.random() * 5) + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    state.friends.push(newFriend);
    saveFriendToDB(newFriend);
    renderZoo();
    showToast(e.split('@')[0] + ' accepted your request!');
    spawnConfetti(8);
  }, 2000);
};

// ═══════════════════════════════════════════════════════════════════
// DAILY NOTE — Co-Star style motivational popup
// ═══════════════════════════════════════════════════════════════════

var _dailyNoteCache = null;
var _dailyNoteDateCache = null;

async function getDailyNote() {
  var btn = document.getElementById('insight-btn');
  var today = new Date().toDateString();

  // Same note all day (Co-Star style)
  if (_dailyNoteCache && _dailyNoteDateCache === today) {
    showDailyNotePopup(_dailyNoteCache);
    return;
  }

  if (btn) { btn.textContent = '✨ Reading the stars...'; btn.disabled = true; }

  var dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  var moods = ['reflective','grounded','expansive','tender','sharp','restless','luminous','steady'];
  var mood = moods[dayOfYear % moods.length];

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: 'Write a daily note in the style of Co-Star astrology app — poetic, specific, a little mysterious, but genuinely useful. The energy today is "' + mood + '". Write EXACTLY three short sections:\n\nDO: [one specific action, concrete]\nAVOID: [one specific thing to watch out for]\nREMEMBER: [one poetic truth, 1 sentence]\n\nBe cryptic but warm. No fluff. No emojis. Address "you" directly. Sound like a wise friend, not a horoscope.',
        }],
      }),
    });
    var data = await response.json();
    var text = data.content[0].text;
    _dailyNoteCache = text;
    _dailyNoteDateCache = today;
    showDailyNotePopup(text);
  } catch(err) {
    showDailyNotePopup('DO: Take one slow breath before your next task.\nAVOID: Comparing your timeline to anyone else\'s.\nREMEMBER: Small, consistent effort compounds into something unrecognizable.');
  }
  if (btn) { btn.textContent = '✨ Get a daily note'; btn.disabled = false; }
}

function showDailyNotePopup(text) {
  var existing = document.getElementById('daily-note-modal');
  if (existing) existing.remove();

  var doMatch    = text.match(/DO:\s*(.+?)(?=AVOID:|$)/s);
  var avoidMatch = text.match(/AVOID:\s*(.+?)(?=REMEMBER:|$)/s);
  var remMatch   = text.match(/REMEMBER:\s*(.+)/s);

  var overlay = document.createElement('div');
  overlay.id = 'daily-note-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .2s ease';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:18px;padding:26px 22px;width:100%;max-width:340px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,.12)';

  var date = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  card.innerHTML =
    '<div style="font-size:10px;font-weight:800;letter-spacing:.14em;color:#bbb;text-transform:uppercase;margin-bottom:20px">' + date + '</div>' +
    '<div style="margin-bottom:16px">' +
      '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;color:#3ECF00;text-transform:uppercase;margin-bottom:5px">Do</div>' +
      '<div style="font-size:15px;line-height:1.6;color:#111">' + (doMatch ? doMatch[1].trim() : '') + '</div>' +
    '</div>' +
    '<div style="margin-bottom:16px">' +
      '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;color:#FF6A00;text-transform:uppercase;margin-bottom:5px">Avoid</div>' +
      '<div style="font-size:15px;line-height:1.6;color:#111">' + (avoidMatch ? avoidMatch[1].trim() : '') + '</div>' +
    '</div>' +
    '<div style="margin-bottom:22px;padding-top:16px;border-top:1px solid #f0f0f0">' +
      '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;color:#aaa;text-transform:uppercase;margin-bottom:5px">Remember</div>' +
      '<div style="font-size:14px;line-height:1.7;color:#555;font-style:italic">' + (remMatch ? remMatch[1].trim() : '') + '</div>' +
    '</div>' +
    '<button onclick="document.getElementById(\'daily-note-modal\').remove()" style="width:100%;padding:12px;border-radius:50px;background:#f5f5f5;color:#333;border:none;font-size:14px;font-weight:700;cursor:pointer">Done</button>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// Keep old name as alias so nothing breaks
var getWeeklyInsight = getDailyNote;

// ═══════════════════════════════════════════════════════════════════
// INLINE CHAT (tiger page rectangle)
// ═══════════════════════════════════════════════════════════════════

var inlineChatHistory = [];
var inlineChatReady = false;

function initInlineChat() {
  if (inlineChatReady) return;
  inlineChatReady = true;

  // Build Facebook Messenger-style fixed chat widget
  var widget = document.createElement('div');
  widget.id = 'pawbot-widget';
  widget.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;display:flex;flex-direction:column;align-items:flex-end;gap:8px';

  // Chat window (starts open)
  var win = document.createElement('div');
  win.id = 'pawbot-win';
  win.style.cssText = 'width:300px;height:400px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;border:1px solid #e8e8e8;transition:all .25s cubic-bezier(.4,0,.2,1)';

  win.innerHTML =
    // Header
    '<div style="padding:11px 14px;background:#3ECF00;display:flex;align-items:center;gap:9px;flex-shrink:0">' +
      '<div style="width:32px;height:32px;background:rgba(255,255,255,.25);border-radius:50%;display:grid;place-items:center;font-size:18px;flex-shrink:0">🐯</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:13px;font-weight:800;color:#fff">PawBot</div>' +
        '<div style="font-size:10px;color:rgba(255,255,255,.85);font-weight:600">Always here for you</div>' +
      '</div>' +
      '<button onclick="togglePawbot()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:24px;height:24px;border-radius:50%;font-size:14px;cursor:pointer;display:grid;place-items:center;line-height:1">−</button>' +
    '</div>' +
    // Messages
    '<div id="chat-messages-inline" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:7px;background:#fafafa"></div>' +
    // Input
    '<div style="padding:8px 10px;border-top:1px solid #f0f0f0;display:flex;gap:6px;flex-shrink:0;background:#fff">' +
      '<input id="chat-input-inline" placeholder="Message PawBot..." style="flex:1;padding:8px 12px;border-radius:50px;border:1.5px solid #e8e8e8;font-size:13px;font-family:inherit;outline:none;background:#f5f5f5" onkeydown="if(event.key===\'Enter\')sendInlineChat()">' +
      '<button onclick="sendInlineChat()" style="width:32px;height:32px;border-radius:50%;background:#3ECF00;border:none;font-size:15px;cursor:pointer;color:#fff;flex-shrink:0;display:grid;place-items:center">↑</button>' +
    '</div>';

  // Toggle button (the green circle shown when collapsed)
  var fab = document.createElement('button');
  fab.id = 'pawbot-fab';
  fab.style.cssText = 'width:52px;height:52px;border-radius:50%;background:#3ECF00;border:none;font-size:26px;cursor:pointer;box-shadow:0 4px 16px rgba(62,207,0,.45);display:none;align-items:center;justify-content:center';
  fab.textContent = '🐯';
  fab.onclick = function() { togglePawbot(); };

  widget.appendChild(win);
  widget.appendChild(fab);
  document.body.appendChild(widget);

  appendInlineBubble('Hi! I\'m PawBot 🐯 How are you feeling today?', 'ai');
}

function togglePawbot() {
  var win = document.getElementById('pawbot-win');
  var fab = document.getElementById('pawbot-fab');
  if (!win || !fab) return;
  var isOpen = win.style.display !== 'none';
  win.style.display = isOpen ? 'none' : 'flex';
  fab.style.display = isOpen ? 'flex' : 'none';
}

async function sendInlineChat() {
  var input = document.getElementById('chat-input-inline');
  if (!input) return;
  var msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendInlineBubble(msg, 'user');
  inlineChatHistory.push({ role: 'user', content: msg });
  var thinkingId = appendInlineBubble('...', 'ai');
  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        system: 'You are PawBot, a warm supportive mental health companion for DePauw University students. Keep responses to 2 sentences max. Be empathetic and genuine. For serious concerns always mention DePauw Counseling Center at (765) 658-4268, Hoover Hall Mon-Fri 9am-4pm.',
        messages: inlineChatHistory.slice(-8),
      }),
    });
    var data = await response.json();
    var reply = data.content[0].text;
    inlineChatHistory.push({ role: 'assistant', content: reply });
    updateInlineBubble(thinkingId, reply);
  } catch(e) {
    updateInlineBubble(thinkingId, 'Having trouble connecting — try again!');
  }
}

function appendInlineBubble(text, role) {
  var list = document.getElementById('chat-messages-inline');
  if (!list) return null;
  var id = 'imsg-' + Date.now() + '-' + Math.random();
  var d = document.createElement('div');
  d.id = id;
  d.style.cssText = 'display:flex;justify-content:' + (role === 'user' ? 'flex-end' : 'flex-start');
  var bubble = document.createElement('div');
  bubble.style.cssText = 'max-width:82%;padding:8px 12px;font-size:13px;line-height:1.5;border-radius:' +
    (role === 'user' ? '14px 14px 3px 14px;background:#3ECF00;color:#fff' : '14px 14px 14px 3px;background:#fff;border:1.5px solid #E8DDB5;color:#111');
  bubble.textContent = text;
  d.appendChild(bubble);
  list.appendChild(d);
  list.scrollTop = list.scrollHeight;
  return id;
}

function updateInlineBubble(id, text) {
  if (!id) return;
  var el = document.getElementById(id);
  if (el) el.querySelector('div').textContent = text;
  var list = document.getElementById('chat-messages-inline');
  if (list) list.scrollTop = list.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════════
// FIX #9 — AI CHATBOT
// ═══════════════════════════════════════════════════════════════════

var chatHistory = [];

async function sendChatMessage() {
  var input = document.getElementById('chat-input');
  var msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendChatBubble(msg, 'user');
  chatHistory.push({ role: 'user', content: msg });
  var thinkingId = appendChatBubble('...', 'ai');
  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: 'You are PawBot, a warm supportive mental health companion for DePauw University students. Keep responses to 2-3 sentences. Be empathetic and genuine. For serious concerns always mention DePauw Counseling Center at (765) 658-4268 or Hoover Hall Mon-Fri 9am-4pm. You are NOT a therapist.',
        messages: chatHistory.slice(-8),
      }),
    });
    var data = await response.json();
    var reply = data.content[0].text;
    chatHistory.push({ role: 'assistant', content: reply });
    updateChatBubble(thinkingId, reply);
  } catch(e) {
    updateChatBubble(thinkingId, 'Sorry, having trouble connecting. Try again!');
  }
}

function appendChatBubble(text, role) {
  var list = document.getElementById('chat-messages');
  if (!list) return null;
  var id = 'msg-' + Date.now() + '-' + Math.random();
  var d = document.createElement('div');
  d.id = id;
  d.style.cssText = 'display:flex;justify-content:' + (role === 'user' ? 'flex-end' : 'flex-start') + ';margin-bottom:8px';
  var bubble = document.createElement('div');
  bubble.style.cssText = 'max-width:80%;padding:9px 13px;font-size:13px;line-height:1.5;border-radius:' +
    (role === 'user' ? '16px 16px 4px 16px;background:#3ECF00;color:#fff' : '16px 16px 16px 4px;background:#fff;border:1px solid #E8DDB5;color:#111');
  bubble.textContent = text;
  d.appendChild(bubble);
  list.appendChild(d);
  list.scrollTop = list.scrollHeight;
  return id;
}

function updateChatBubble(id, text) {
  if (!id) return;
  var el = document.getElementById(id);
  if (el) el.querySelector('div').textContent = text;
  var list = document.getElementById('chat-messages');
  if (list) list.scrollTop = list.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════════
// WEATHER + TIPS
// ═══════════════════════════════════════════════════════════════════

async function fetchWeather() {
  var el = document.getElementById('weather-widget');
  if (!el) return;
  try {
    var res  = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Greencastle,IN,US&appid=' + WEATHER_API_KEY + '&units=imperial');
    var data = await res.json();
    var temp = Math.round(data.main.temp), feels = Math.round(data.main.feels_like);
    var cond = data.weather[0].description, icon = data.weather[0].icon;
    el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;background:#FFF8D6;border-radius:12px;padding:8px 12px;border:1.5px solid #F5C400"><img src="https://openweathermap.org/img/wn/' + icon + '.png" width="36" height="36"><div><div style="font-size:15px;font-weight:800">' + temp + '°F <span style="font-size:12px;color:#888;font-weight:500">feels like ' + feels + '°F</span></div><div style="font-size:12px;color:#666;text-transform:capitalize">' + cond + ' · Greencastle, IN</div></div></div>';
  } catch(e) { console.warn('Weather fetch failed:', e); }
}

async function fetchDailyTip() {
  var el = document.getElementById('daily-tip');
  if (!el) return;
  var cached = localStorage.getItem('pc_tip'), cachedAt = parseInt(localStorage.getItem('pc_tip_ts') || '0');
  if (cached && Date.now() - cachedAt < 86400000) { renderTip(el, cached); return; }
  try {
    var res = await fetch('https://api.api-ninjas.com/v1/facts?limit=1', { headers: { 'X-Api-Key': NINJAS_API_KEY } });
    var data = await res.json();
    var tip = (data[0] && data[0].fact) ? data[0].fact : 'Small steps every day lead to big changes.';
    localStorage.setItem('pc_tip', tip); localStorage.setItem('pc_tip_ts', Date.now().toString());
    renderTip(el, tip);
  } catch(e) { renderTip(el, 'Take a deep breath. You\'re doing great.'); }
}

function renderTip(el, tip) {
  el.innerHTML = '<div style="background:#F0EAFF;border-radius:12px;padding:11px 14px;border-left:4px solid #7C3AFF;margin-bottom:10px"><div style="font-size:10px;font-weight:800;color:#7C3AFF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Daily Tip</div><div style="font-size:13px;line-height:1.6;color:#333">' + tip + '</div></div>';
}

// ═══════════════════════════════════════════════════════════════════
// WIRE-UPS
// ═══════════════════════════════════════════════════════════════════

var _origAddCoins = addCoins;
addCoins = function(n) { _origAddCoins(n); saveUserToDB(); };

var _origSaveJournal = saveJournal;
saveJournal = function() {
  var textEl = document.getElementById('journal-text') || document.getElementById('journal-input');
  var text   = textEl ? textEl.value.trim() : '';
  var prompt = state.currentPrompt || '';
  _origSaveJournal();
  if (text.length >= 5) saveJournalEntryToDB(text, prompt);
};

var _origLogActivity = logActivity;
logActivity = function(item, el) { _origLogActivity(item, el); saveProgressToDB(); };

var _origShowB5Results = showB5Results;
showB5Results = function() {
  _origShowB5Results();
  if (state.oceanPct && state.matchedCounselorId !== null)
    saveQuizResultToDB(state.quizAnswers, state.oceanPct, state.matchedCounselorId);
};

if (typeof equipItem === 'function') {
  var _origEquipItem = equipItem;
  equipItem = function(id) { _origEquipItem(id); saveUserToDB(); };
}

// ═══════════════════════════════════════════════════════════════════
// AUTO SIGN-IN
// ═══════════════════════════════════════════════════════════════════

_sb.auth.getSession().then(function(result) {
  var session = result.data.session;
  if (session && session.user) {
    state.currentEmail  = session.user.email;
    state.currentUserId = session.user.id;
    loadUserFromDB(session.user.id);
  }
});

// ═══════════════════════════════════════════════════════════════════
// INJECT NEW FEATURES into DOM after initApp()
// ═══════════════════════════════════════════════════════════════════

function injectNewFeatures() {

  // FIX #2 — Sign out button next to streak badge
  var streakBadge = document.querySelector('.streak-badge');
  if (streakBadge && !document.getElementById('signout-btn')) {
    var soBtn = document.createElement('button');
    soBtn.id = 'signout-btn';
    soBtn.textContent = 'Sign out';
    soBtn.style.cssText = 'padding:5px 12px;border-radius:50px;border:1.5px solid #ccc;background:transparent;font-size:11px;font-weight:700;color:#888;cursor:pointer;margin-left:6px';
    soBtn.onclick = signOut;
    streakBadge.parentNode.insertBefore(soBtn, streakBadge.nextSibling);
  }

  // FIX #5 — Invite buttons: patch renderZoo to add them
  var _origRenderZoo = renderZoo;
  renderZoo = function() {
    _origRenderZoo();
    setTimeout(function() {
      var fl = document.getElementById('zoo-friends-list');
      if (!fl) return;
      fl.querySelectorAll('.lb-row').forEach(function(row, i) {
        if (row.querySelector('.invite-btn')) return;
        var f = state.friends[i];
        if (!f) return;
        var inv = document.createElement('button');
        inv.className = 'invite-btn';
        inv.textContent = 'Invite';
        inv.style.cssText = 'background:#FFF3C4;color:#B08000;border:1.5px solid #F5C400;padding:5px 10px;border-radius:50px;font-size:11px;font-weight:700;cursor:pointer;margin-left:6px';
        inv.onclick = (function(friend) { return function() { showInviteMenu(friend); }; })(f);
        row.appendChild(inv);
      });
    }, 60);
  };

  // FIX #7 — Rename button under tiger name
  var nameDisplay = document.getElementById('tiger-name-display');
  if (nameDisplay && !document.getElementById('rename-btn')) {
    var renameBtn = document.createElement('button');
    renameBtn.id = 'rename-btn';
    renameBtn.textContent = 'Rename';
    renameBtn.style.cssText = 'display:block;margin:2px auto 0;padding:2px 8px;border-radius:50px;border:1px solid #ccc;background:transparent;font-size:9px;font-weight:700;color:#aaa;cursor:pointer';
    renameBtn.onclick = function() {
      var n = prompt('New name for your tiger:', state.tigerName);
      if (n && n.trim()) {
        state.tigerName = n.trim();
        document.getElementById('tiger-name-display').textContent = state.tigerName;
        saveUserToDB();
        showToast('Tiger renamed to ' + state.tigerName + '!');
      }
    };
    nameDisplay.parentNode.insertBefore(renameBtn, nameDisplay.nextSibling);
  }

  // Inject settings + chatbot panels
  if (!document.getElementById('settings-panel')) injectSettingsPanel();
  if (!document.getElementById('chatbot-panel'))  injectChatbot();

  // Init inline chat
  setTimeout(initInlineChat, 300);

  // Floating action buttons (chat + settings)
  if (!document.getElementById('fab-wrap')) {
    var fabWrap = document.createElement('div');
    fabWrap.id = 'fab-wrap';
    fabWrap.style.cssText = 'position:fixed;bottom:80px;right:14px;display:flex;flex-direction:column;gap:8px;z-index:200';

    var chatFab = document.createElement('button');
    chatFab.innerHTML = '💬';
    chatFab.title = '24/7 Support';
    chatFab.style.cssText = 'width:46px;height:46px;border-radius:50%;background:#3ECF00;border:none;font-size:20px;cursor:pointer;box-shadow:0 3px 12px rgba(62,207,0,.4)';
    chatFab.onclick = function() { togglePanel('chatbot-panel'); };

    var settingsFab = document.createElement('button');
    settingsFab.innerHTML = '⚙️';
    settingsFab.title = 'Settings';
    settingsFab.style.cssText = 'width:46px;height:46px;border-radius:50%;background:#fff;border:1.5px solid #E8DDB5;font-size:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1)';
    settingsFab.onclick = function() { togglePanel('settings-panel'); };

    fabWrap.appendChild(chatFab);
    fabWrap.appendChild(settingsFab);
    document.getElementById('app').appendChild(fabWrap);
  }
}

// ═══════════════════════════════════════════════════════════════════
// FIX #5 — Invite menu
// ═══════════════════════════════════════════════════════════════════

function showInviteMenu(friend) {
  var existing = document.getElementById('invite-modal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'invite-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999;display:flex;align-items:flex-end;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:#fff;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px';
  sheet.innerHTML = '<div style="font-size:16px;font-weight:800;margin-bottom:4px">Invite ' + friend.name + '</div><div style="font-size:13px;color:#888;margin-bottom:16px">Pick an activity</div>';
  ['Gym workout', 'Study session', 'Hangout / chill'].forEach(function(act) {
    var btn = document.createElement('button');
    btn.textContent = act;
    btn.style.cssText = 'display:block;width:100%;padding:13px;margin-bottom:8px;border-radius:12px;border:1.5px solid #E8DDB5;background:#FFFBEC;font-size:14px;font-weight:700;cursor:pointer;text-align:left';
    btn.onclick = function() { overlay.remove(); showToast('Invited ' + friend.name + ' to ' + act + '!'); spawnConfetti(6); };
    sheet.appendChild(btn);
  });
  var cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.cssText = 'display:block;width:100%;padding:12px;border-radius:12px;border:none;background:#f0f0f0;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px';
  cancel.onclick = function() { overlay.remove(); };
  sheet.appendChild(cancel);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════════════════════
// FIX #6 + #7 + #8 — Settings panel
// ═══════════════════════════════════════════════════════════════════

function injectSettingsPanel() {
  var panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.style.cssText = 'display:none;position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.4);align-items:flex-end;justify-content:center';
  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:#FFFBEC;border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto';
  sheet.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">' +
      '<div style="font-size:18px;font-weight:900">Settings</div>' +
      '<button onclick="togglePanel(\'settings-panel\')" style="border:none;background:transparent;font-size:22px;cursor:pointer;color:#888">×</button>' +
    '</div>' +
    '<div style="font-size:12px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Tiger name</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:18px">' +
      '<input id="rename-input" value="' + (state.tigerName || 'Tiger') + '" style="flex:1;padding:10px 12px;border-radius:10px;border:1.5px solid #E8DDB5;font-size:14px;background:#fff">' +
      '<button onclick="applyRename()" style="padding:10px 16px;border-radius:10px;background:#3ECF00;color:#fff;border:none;font-weight:800;cursor:pointer">Save</button>' +
    '</div>' +
    '<div style="font-size:12px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Notifications</div>' +
    makeToggleRow('notif-checkin', 'Daily check-in reminder', state.notifCheckin !== false) +
    makeToggleRow('notif-streak',  'Streak alert',            state.notifStreak  !== false) +
    makeToggleRow('notif-cheers',  'Friend cheers',           state.notifCheers  !== false) +
    '<div style="font-size:12px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin:18px 0 10px">Weekly wellness goal</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' +
      makeGoalBtn('3 walks this week') + makeGoalBtn('2 study sessions') +
      makeGoalBtn('Journal every day') + makeGoalBtn('Hit the gym 2x') +
    '</div>' +
    '<div id="current-goal-display" style="font-size:13px;color:#3ECF00;font-weight:700;margin-bottom:12px">' +
      (state.wellnessGoal ? 'Current: ' + state.wellnessGoal : 'No goal set yet') +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">' +
      '<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#E8DDB5" stroke-width="7"/>' +
      '<circle id="goal-ring" cx="32" cy="32" r="26" fill="none" stroke="#3ECF00" stroke-width="7" stroke-linecap="round"' +
      ' stroke-dasharray="163.4" stroke-dashoffset="' + (163.4 - 163.4 * (state.wellnessGoalProgress || 0) / 100) + '"' +
      ' transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="37" text-anchor="middle" font-size="14" font-weight="800" fill="#111" font-family="sans-serif">' + (state.wellnessGoalProgress || 0) + '%</text></svg>' +
      '<div><div style="font-size:13px;font-weight:700;margin-bottom:6px">Goal progress</div>' +
      '<input type="range" min="0" max="100" step="1" value="' + (state.wellnessGoalProgress || 0) + '" id="goal-slider" style="width:140px" oninput="updateGoalProgress(this.value)"></div>' +
    '</div>' +
    '<button onclick="saveSettings()" style="display:block;width:100%;padding:13px;border-radius:12px;background:#3ECF00;color:#fff;border:none;font-size:15px;font-weight:800;cursor:pointer">Save settings</button>';
  panel.appendChild(sheet);
  panel.onclick = function(e) { if (e.target === panel) togglePanel('settings-panel'); };
  document.getElementById('app').appendChild(panel);
}

function makeToggleRow(id, label, checked) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #E8DDB5">' +
    '<span style="font-size:14px;font-weight:600">' + label + '</span>' +
    '<label style="position:relative;display:inline-block;width:42px;height:24px;cursor:pointer">' +
      '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' style="opacity:0;width:0;height:0" onchange="syncToggle(\'' + id + '\')">' +
      '<span id="' + id + '-track" style="position:absolute;inset:0;background:' + (checked ? '#3ECF00' : '#ccc') + ';border-radius:12px;transition:.2s"></span>' +
      '<span id="' + id + '-thumb" style="position:absolute;top:3px;left:' + (checked ? '21px' : '3px') + ';width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s"></span>' +
    '</label>' +
  '</div>';
}

function syncToggle(id) {
  var cb = document.getElementById(id);
  var track = document.getElementById(id + '-track');
  var thumb = document.getElementById(id + '-thumb');
  if (track) track.style.background = cb.checked ? '#3ECF00' : '#ccc';
  if (thumb) thumb.style.left = cb.checked ? '21px' : '3px';
}

function makeGoalBtn(label) {
  var active = state.wellnessGoal === label;
  return '<button onclick="pickGoal(\'' + label.replace(/'/g, "\\'") + '\')" style="padding:10px;border-radius:10px;border:2px solid ' +
    (active ? '#3ECF00' : '#E8DDB5') + ';background:' + (active ? '#e6fad6' : '#fff') +
    ';font-size:12px;font-weight:700;cursor:pointer;text-align:left">' + label + '</button>';
}

function pickGoal(val) {
  state.wellnessGoal = val;
  var d = document.getElementById('current-goal-display');
  if (d) d.textContent = 'Current: ' + val;
  document.querySelectorAll('#settings-panel button[onclick^="pickGoal"]').forEach(function(b) {
    var active = b.textContent.trim() === val;
    b.style.borderColor = active ? '#3ECF00' : '#E8DDB5';
    b.style.background  = active ? '#e6fad6' : '#fff';
  });
}

function updateGoalProgress(val) {
  state.wellnessGoalProgress = parseInt(val);
  var ring = document.getElementById('goal-ring');
  if (ring) ring.setAttribute('stroke-dashoffset', (163.4 - 163.4 * val / 100).toFixed(1));
  var txt = document.querySelector('#settings-panel svg text');
  if (txt) txt.textContent = val + '%';
}

function applyRename() {
  var inp = document.getElementById('rename-input');
  if (!inp || !inp.value.trim()) return;
  state.tigerName = inp.value.trim();
  var nd = document.getElementById('tiger-name-display');
  if (nd) nd.textContent = state.tigerName;
  showToast('Tiger renamed to ' + state.tigerName + '!');
}

function saveSettings() {
  var ci = document.getElementById('notif-checkin');
  var si = document.getElementById('notif-streak');
  var ch = document.getElementById('notif-cheers');
  state.notifCheckin = ci ? ci.checked : true;
  state.notifStreak  = si ? si.checked : true;
  state.notifCheers  = ch ? ch.checked : true;
  applyRename();
  saveUserToDB();
  togglePanel('settings-panel');
  showToast('Settings saved!');
}

// ═══════════════════════════════════════════════════════════════════
// FIX #9 — Chatbot panel
// ═══════════════════════════════════════════════════════════════════

function injectChatbot() {
  var panel = document.createElement('div');
  panel.id = 'chatbot-panel';
  panel.style.cssText = 'display:none;position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.4);align-items:flex-end;justify-content:center';
  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:#FFFBEC;border-radius:20px 20px 0 0;width:100%;max-width:480px;height:70vh;display:flex;flex-direction:column';
  sheet.innerHTML =
    '<div style="padding:14px 16px;border-bottom:1.5px solid #E8DDB5;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">' +
      '<div><div style="font-size:16px;font-weight:900">PawBot</div><div style="font-size:11px;color:#3ECF00;font-weight:700">24/7 mental health support</div></div>' +
      '<button onclick="togglePanel(\'chatbot-panel\')" style="border:none;background:transparent;font-size:22px;cursor:pointer;color:#888">×</button>' +
    '</div>' +
    '<div id="chat-messages" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column"></div>' +
    '<div style="padding:10px 12px;border-top:1.5px solid #E8DDB5;display:flex;gap:8px;flex-shrink:0">' +
      '<input id="chat-input" placeholder="How are you feeling?" style="flex:1;padding:10px 12px;border-radius:50px;border:1.5px solid #E8DDB5;font-size:14px;background:#fff" onkeydown="if(event.key===\'Enter\')sendChatMessage()">' +
      '<button onclick="sendChatMessage()" style="width:40px;height:40px;border-radius:50%;background:#3ECF00;border:none;font-size:18px;cursor:pointer;color:#fff;font-weight:900">↑</button>' +
    '</div>';
  panel.appendChild(sheet);
  panel.onclick = function(e) { if (e.target === panel) togglePanel('chatbot-panel'); };
  document.getElementById('app').appendChild(panel);
  setTimeout(function() {
    appendChatBubble('Hi! I\'m PawBot 🐯 I\'m here 24/7. How are you feeling today?', 'ai');
  }, 400);
}

// ─────────────────────────────────────────────────────────────────
// SHARED HELPER
// ─────────────────────────────────────────────────────────────────
function togglePanel(id) {
  var p = document.getElementById(id);
  if (!p) return;
  var hidden = p.style.display === 'none' || p.style.display === '';
  p.style.display = hidden ? 'flex' : 'none';
}
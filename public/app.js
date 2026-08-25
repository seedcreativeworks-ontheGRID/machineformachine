let dishes = [
  {id:1, name:"Fire-Grilled Chicken Skewers", mins:20,
    ingredients:["chicken, cut into chunks","skewers or green branches","salt","wild herbs/citrus if available"],
    steps:[
      {text:"Skewer chicken chunks tightly, season with salt & any herbs or citrus", seconds:180},
      {text:"Grill over hot coals, turning every 3-4 min", seconds:720},
      {text:"Move to cooler embers, finish through until juices run clear", seconds:300}
    ]},
  {id:2, name:"Charred Island Vegetables", mins:15,
    ingredients:["mixed island vegetables, cut into large pieces","salt","oil or fat if available"],
    steps:[
      {text:"Cut vegetables into large, even pieces", seconds:180},
      {text:"Toss with oil and salt", seconds:60},
      {text:"Char on grill or hot stone, turning occasionally until edges blacken", seconds:660}
    ]},
  {id:3, name:"Seared Catch of the Day", mins:13,
    ingredients:["fresh-caught seafood, cleaned and filleted","salt","citrus or greens if available"],
    steps:[
      {text:"Pat fish dry, season with salt", seconds:120},
      {text:"Sear skin-side down over the hottest part of the fire", seconds:180},
      {text:"Flip and finish searing until it flakes easily", seconds:300},
      {text:"Rest briefly, finish with citrus or greens if available", seconds:180}
    ]},
];
let nextId = 4;
let totalSeconds = 30*60;
let remaining = totalSeconds;
let running = false;
let timerHandle = null;
let audioCtx = null;

function beep(freq, dur){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  }catch(e){}
}

function fmt(s){
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s/60);
  const sec = s%60;
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}

function renderTracks(){
  const el = document.getElementById('tracks');
  el.innerHTML = '';
  const sorted = [...dishes].sort((a,b)=>b.mins - a.mins);
  sorted.forEach((d, idx) => {
    if(!d.manualChecked || d.manualChecked.length !== (d.steps||[]).length){
      d.manualChecked = (d.steps||[]).map(()=>false);
    }
    if(typeof d.collapsed !== 'boolean') d.collapsed = false;

    const startOffset = Math.max(0, totalSeconds - d.mins*60); // elapsed-time when it should start
    const div = document.createElement('div');
    div.className = 'track hud-panel' + (d.collapsed ? ' collapsed' : '');
    div.id = 'track-'+d.id;
    const ingredientsHtml = (d.ingredients||[]).map(i=>`<li>${i}</li>`).join('');
    const stepsHtml = (d.steps||[]).map((s,i)=>{
      const checked = d.manualChecked[i];
      return `<li class="${checked ? 'manual-done' : ''}" data-dish-id="${d.id}" data-step-index="${i}">
        <span class="step-check">${checked ? '☑' : '☐'}</span>
        <span class="step-time">${fmt(s.seconds)}</span>
        <span class="step-text">${s.text}</span>
      </li>`;
    }).join('');
    div.innerHTML = `
      <div class="track-top">
        <button class="track-collapse-btn" data-collapse-id="${d.id}" title="expand/collapse">
          <span class="chev">▾</span>
        </button>
        <div class="track-name"><span class="track-num">${String(idx+1).padStart(2,'0')}</span> ${d.name}</div>
        <div class="track-status" id="status-${d.id}">STANDBY</div>
        ${!running ? `<button class="track-remove" data-id="${d.id}" title="remove">✕</button>` : ''}
      </div>
      <div class="track-bottom">
        <div class="track-clock" id="clock-${d.id}">${fmt(d.mins*60)}</div>
        <div class="track-progress"><div class="track-progress-fill" id="fill-${d.id}"></div></div>
      </div>
      <div class="track-details" id="details-${d.id}">
        <div class="track-details-inner">
          <div>
            <button class="ingredients-toggle" data-ing-toggle="${d.id}" type="button">
              <span class="chev">▸</span> INGREDIENTS
              <span class="ingredients-count">${(d.ingredients||[]).length}</span>
            </button>
            <div class="ingredients-content" id="ingcontent-${d.id}">
              <ul class="ingredient-list">${ingredientsHtml || '<li>—</li>'}</ul>
            </div>
          </div>
          <div>
            <div class="detail-block-label">METHOD — TAP TO CHECK OFF</div>
            <ol class="steps-list">${stepsHtml || '<li>—</li>'}</ol>
          </div>
        </div>
      </div>
    `;
    el.appendChild(div);
  });
  document.querySelectorAll('.track-remove').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      dishes = dishes.filter(d=>d.id!==id);
      renderTracks();
      renderTicker(0);
    });
  });
  document.querySelectorAll('.track-collapse-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = parseInt(e.currentTarget.dataset.collapseId);
      const dish = dishes.find(d=>d.id===id);
      const trackEl = document.getElementById('track-'+id);
      if(dish) dish.collapsed = !dish.collapsed;
      if(trackEl) trackEl.classList.toggle('collapsed');
    });
  });
  document.querySelectorAll('.steps-list li').forEach(li=>{
    li.addEventListener('click', (e)=>{
      const id = parseInt(li.dataset.dishId);
      const i = parseInt(li.dataset.stepIndex);
      const dish = dishes.find(d=>d.id===id);
      if(!dish) return;
      dish.manualChecked[i] = !dish.manualChecked[i];
      li.classList.toggle('manual-done', dish.manualChecked[i]);
      li.querySelector('.step-check').textContent = dish.manualChecked[i] ? '☑' : '☐';
    });
  });
  document.querySelectorAll('.ingredients-toggle').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = parseInt(btn.dataset.ingToggle);
      const content = document.getElementById('ingcontent-'+id);
      const isOpen = content.classList.toggle('open');
      btn.classList.toggle('open', isOpen);
    });
  });
}

function currentStepFor(d, dishElapsed){
  const steps = d.steps && d.steps.length ? d.steps : [{text:'Cook', seconds:d.mins*60}];
  let cum = 0;
  for(const s of steps){
    if(dishElapsed < cum + s.seconds){
      return { text: s.text, remaining: (cum + s.seconds) - dishElapsed };
    }
    cum += s.seconds;
  }
  const last = steps[steps.length-1];
  return { text: last.text, remaining: 0 };
}

function renderTicker(elapsed){
  const el = document.getElementById('tickerList');
  if(!el) return;
  const sorted = [...dishes].sort((a,b)=>b.mins - a.mins);
  if(sorted.length === 0){
    el.innerHTML = `<div class="ticker-row standby"><div class="ticker-row-left"><div class="ticker-row-head"><div class="ticker-dish-name">—</div></div><div class="ticker-hero"><div class="ticker-hero-left"><div class="ticker-hero-task">Add a dish to begin</div></div></div></div></div>`;
    return;
  }
  el.innerHTML = sorted.map(d=>{
    const dur = d.mins*60;
    const startOffset = Math.max(0, totalSeconds - dur);
    const steps = d.steps && d.steps.length ? d.steps : [{text:'Cook', seconds:dur}];

    let rowClass, dishElapsed;
    let heroLabel, heroTask, heroTimeSecs, heroTimeText, urgent = false;

    if(elapsed < startOffset){
      rowClass = 'standby';
      dishElapsed = -1; // sentinel: nothing started
      const toStart = startOffset - elapsed;
      heroLabel = 'STANDBY — NOTHING TO DO YET';
      heroTask = 'First up: ' + steps[0].text;
      heroTimeSecs = toStart;
      heroTimeText = fmt(toStart);
      urgent = toStart <= 10;
    } else if(elapsed >= startOffset && elapsed < totalSeconds){
      rowClass = 'active';
      dishElapsed = elapsed - startOffset;
      const cur = currentStepFor(d, dishElapsed);
      heroLabel = 'DO THIS NOW';
      heroTask = cur.text;
      heroTimeSecs = cur.remaining;
      heroTimeText = fmt(cur.remaining);
      urgent = cur.remaining <= 10;
    } else {
      rowClass = 'done';
      dishElapsed = dur; // everything done
      heroLabel = 'READY';
      heroTask = 'Plate and hold — done';
      heroTimeSecs = 0;
      heroTimeText = '✓';
      urgent = false;
    }

    let cum = 0;
    const stepsHtml = steps.map(s=>{
      const stepStart = cum, stepEnd = cum + s.seconds;
      cum = stepEnd;
      let cls, mark, extra;
      const durTag = `<span class="step-duration">${fmt(s.seconds)}</span>`;
      if(dishElapsed < 0){
        cls = 'upcoming'; mark = '○'; extra = durTag;
      } else if(dishElapsed >= stepEnd){
        cls = 'done'; mark = '✓'; extra = durTag;
      } else if(dishElapsed >= stepStart && dishElapsed < stepEnd){
        cls = 'current'; mark = '▶';
        extra = `<span class="step-countdown">${fmt(stepEnd - dishElapsed)}</span>`;
      } else {
        cls = 'upcoming'; mark = '○'; extra = durTag;
      }
      return `<li class="${cls}"><span class="mark">${mark}</span><span class="step-text-inline">${s.text}</span>${extra}</li>`;
    }).join('');

    return `<div class="ticker-row ${rowClass}">
      <div class="ticker-row-left">
        <div class="ticker-row-head">
          <div class="ticker-dish-name">${d.name.toUpperCase()}</div>
        </div>
        <div class="ticker-hero${urgent ? ' urgent' : ''}">
          <div class="ticker-hero-left">
            <div class="ticker-hero-label">${heroLabel}</div>
            <div class="ticker-hero-task">${heroTask}</div>
          </div>
          <div class="ticker-hero-time">${heroTimeText}</div>
        </div>
        <div class="ticker-steps-caption">FULL SEQUENCE</div>
        <ul class="ticker-steps">${stepsHtml}</ul>
      </div>
    </div>`;
  }).join('');
}

function tick(){
  remaining -= 1;
  const elapsed = totalSeconds - remaining;

  const mc = document.getElementById('masterClock');
  mc.textContent = fmt(remaining);
  document.getElementById('masterBar').style.width = (100*elapsed/totalSeconds)+'%';
  renderTicker(elapsed);

  if(remaining <= 30 && remaining > 0){
    mc.classList.add('critical');
  }

  dishes.forEach(d=>{
    const dur = d.mins*60;
    const startOffset = Math.max(0, totalSeconds - dur);
    const track = document.getElementById('track-'+d.id);
    const statusEl = document.getElementById('status-'+d.id);
    const clockEl = document.getElementById('clock-'+d.id);
    const fillEl = document.getElementById('fill-'+d.id);
    if(!track) return;

    if(elapsed < startOffset){
      // standby, counting down to ignition
      const toStart = startOffset - elapsed;
      track.className = 'track hud-panel' + (track.classList.contains('collapsed') ? ' collapsed' : '');
      statusEl.textContent = 'IGNITE IN';
      clockEl.textContent = fmt(toStart);
      fillEl.style.width = '0%';
    } else if(elapsed >= startOffset && elapsed < totalSeconds){
      const dishElapsed = elapsed - startOffset;
      const dishRemaining = dur - dishElapsed;
      if(track.className.indexOf('active')===-1){
        track.className = 'track hud-panel hud-amber active' + (track.classList.contains('collapsed') ? ' collapsed' : '');
        statusEl.textContent = 'COOKING';
        beep(880, 0.25);
      }
      clockEl.textContent = fmt(dishRemaining);
      fillEl.style.width = (100*dishElapsed/dur)+'%';
    } else {
      if(track.className.indexOf('done')===-1){
        track.className = 'track hud-panel hud-green done' + (track.classList.contains('collapsed') ? ' collapsed' : '');
        statusEl.textContent = 'READY';
        clockEl.textContent = '00:00';
        beep(1400, 0.2);
      }
    }
  });

  if(remaining <= 0){
    stop();
    document.getElementById('masterSub').textContent = 'SERVE NOW';
    beep(600,0.15);
    setTimeout(()=>beep(600,0.15), 250);
    setTimeout(()=>beep(900,0.35), 500);
  } else {
    document.getElementById('masterSub').textContent = 'IN PROGRESS — HOLD THE LINE';
  }
}

function start(){
  if(dishes.length===0){ alert('Add at least one dish first.'); return; }
  totalSeconds = Math.max(60, parseInt(document.getElementById('totalMins').value||30)*60);
  remaining = totalSeconds;
  running = true;
  document.getElementById('masterClock').classList.remove('critical');
  renderTracks();
  renderTicker(0);
  document.getElementById('tickerPanel').classList.add('expanded');
  document.getElementById('tickerCaption').textContent = '— sequence live';
  document.getElementById('engageBtn').disabled = true;
  document.getElementById('totalMins').disabled = true;
  document.querySelectorAll('.preset-btn').forEach(b=> b.disabled = true);
  document.getElementById('addDishBtn').disabled = true;
  timerHandle = setInterval(tick, 1000);
  document.getElementById('masterSub').textContent = 'SEQUENCE ENGAGED';
}

function stop(){
  running = false;
  clearInterval(timerHandle);
  document.getElementById('engageBtn').disabled = false;
  document.getElementById('totalMins').disabled = false;
  document.querySelectorAll('.preset-btn').forEach(b=> b.disabled = false);
  document.getElementById('addDishBtn').disabled = false;
}

function reset(){
  stop();
  remaining = totalSeconds;
  document.getElementById('masterClock').classList.remove('critical');
  document.getElementById('masterClock').textContent = fmt(totalSeconds);
  document.getElementById('masterBar').style.width = '0%';
  document.getElementById('masterSub').textContent = 'STANDBY — SET DISHES AND ENGAGE';
  renderTracks();
  renderTicker(0);
  document.getElementById('tickerPanel').classList.remove('expanded');
  document.getElementById('tickerCaption').textContent = '— tap to view';
}

document.getElementById('engageBtn').addEventListener('click', start);
document.getElementById('openDsBtn').addEventListener('click', ()=>{
  document.getElementById('mainView').style.display = 'none';
  document.getElementById('dsView').style.display = 'block';
  window.scrollTo(0,0);
});
document.getElementById('closeDsBtn').addEventListener('click', ()=>{
  document.getElementById('dsView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';
  window.scrollTo(0,0);
});
document.getElementById('resetBtn').addEventListener('click', reset);
document.getElementById('tickerToggle').addEventListener('click', ()=>{
  document.getElementById('tickerPanel').classList.toggle('expanded');
});
document.getElementById('addDishBtn').addEventListener('click', ()=>{
  const nameInput = document.getElementById('newName');
  const minsInput = document.getElementById('newMins');
  const ingInput = document.getElementById('newIngredients');
  const instrInput = document.getElementById('newInstructions');
  const name = nameInput.value.trim();
  const mins = parseInt(minsInput.value);
  if(!name || !mins || mins<1){ alert('Give the dish a name and a cook time in minutes.'); return; }
  const ingredients = ingInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  const instructions = instrInput.value.trim();
  const steps = [{text: instructions || 'Cook as needed', seconds: mins*60}];
  dishes.push({id:nextId++, name, mins, ingredients, steps});
  nameInput.value=''; minsInput.value=''; ingInput.value=''; instrInput.value='';
  renderTracks();
  renderTicker(0);
});
function setTimeframe(mins){
  mins = Math.max(1, mins);
  totalSeconds = mins*60;
  remaining = totalSeconds;
  document.getElementById('totalMins').value = mins;
  document.getElementById('masterClock').textContent = fmt(totalSeconds);
  document.querySelectorAll('.preset-btn').forEach(b=>{
    b.classList.toggle('active-preset', parseInt(b.dataset.preset) === mins);
  });
  renderTracks();
  renderTicker(0);
}

document.getElementById('totalMins').addEventListener('change', (e)=>{
  setTimeframe(parseInt(e.target.value || 30));
});
document.querySelectorAll('.preset-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    setTimeframe(parseInt(btn.dataset.preset));
  });
});

/* ===== GALLEY AI ASSISTANT ===== */
const aiLog = document.getElementById('aiLog');
const aiInput = document.getElementById('aiInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiMicBtn = document.getElementById('aiMicBtn');

function aiAddMessage(text, who){
  const div = document.createElement('div');
  div.className = 'ai-msg ' + (who === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
  div.textContent = text;
  aiLog.appendChild(div);
  aiLog.scrollTop = aiLog.scrollHeight;
  return div;
}

function buildKitchenContext(){
  const elapsed = totalSeconds - remaining;
  const dishLines = dishes.map(d=>{
    const dur = d.mins*60;
    const startOffset = Math.max(0, totalSeconds - dur);
    let state = 'not started';
    if(running){
      if(elapsed >= startOffset && elapsed < totalSeconds) state = 'currently cooking';
      else if(elapsed >= totalSeconds) state = 'done';
    }
    const ing = (d.ingredients||[]).join(', ') || 'none listed';
    return `- ${d.name} (${d.mins} min total, status: ${state}). Ingredients: ${ing}.`;
  }).join('\n');
  return `Total time available: ${Math.round(totalSeconds/60)} min. Timer running: ${running}. Time remaining: ${fmt(remaining)}.\nDishes:\n${dishLines || 'none added yet'}`;
}

async function aiSend(text){
  text = text.trim();
  if(!text) return;
  aiAddMessage(text, 'user');
  aiInput.value = '';
  aiSendBtn.disabled = true;
  const loadingEl = document.createElement('div');
  loadingEl.className = 'ai-msg ai-msg-loading';
  loadingEl.textContent = 'THINKING...';
  aiLog.appendChild(loadingEl);
  aiLog.scrollTop = aiLog.scrollHeight;

  try{
    const context = buildKitchenContext();
    const apiBase = (window.GALLEY_CONFIG && window.GALLEY_CONFIG.apiBase) || "";
    const response = await fetch(`${apiBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, context })
    });
    const data = await response.json();
    loadingEl.remove();
    if(!response.ok){
      throw new Error(data.error || 'Request failed');
    }
    aiAddMessage(data.reply || "Couldn't get a clear answer — try rephrasing.", 'bot');
  } catch(err){
    loadingEl.remove();
    aiAddMessage("Signal's down — can't reach the assistant right now. Try again in a moment.", 'bot');
  } finally {
    aiSendBtn.disabled = false;
  }
}

aiSendBtn.addEventListener('click', ()=> aiSend(aiInput.value));
aiInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') aiSend(aiInput.value);
});

// Voice input
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
if(SpeechRecognitionCtor){
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = ()=>{
    listening = true;
    aiMicBtn.classList.add('listening');
  };
  recognition.onend = ()=>{
    listening = false;
    aiMicBtn.classList.remove('listening');
  };
  recognition.onerror = ()=>{
    listening = false;
    aiMicBtn.classList.remove('listening');
  };
  recognition.onresult = (event)=>{
    const transcript = event.results[0][0].transcript;
    aiInput.value = transcript;
    aiSend(transcript);
  };

  aiMicBtn.addEventListener('click', ()=>{
    if(listening){
      recognition.stop();
    } else {
      try{ recognition.start(); }catch(e){}
    }
  });
} else {
  aiMicBtn.addEventListener('click', ()=>{
    aiAddMessage("Voice input isn't supported in this browser — type your question instead.", 'bot');
  });
}

/* ===== HOW-TO-USE NARRATION — docked player rail ===== */
(function setupHowtoPlayer(){
  const howtoRail = document.getElementById('howtoRail');
  const howtoAudio = document.getElementById('howtoAudio');
  const howtoToggle = document.getElementById('howtoToggle');
  const howtoIcon = document.getElementById('howtoIcon');
  const howtoSkipback = document.getElementById('howtoSkipback');
  const howtoScrub = document.getElementById('howtoScrub');
  const howtoTime = document.getElementById('howtoTime');

  // Guard against a stale cached app.js/index.html pairing after a deploy —
  // if any expected element is missing, skip wiring instead of throwing
  // and silently aborting every script below this point.
  if(!howtoRail || !howtoAudio || !howtoToggle || !howtoIcon || !howtoSkipback || !howtoScrub || !howtoTime){
    console.warn('Galley OS: how-to-use player markup missing or out of date — skipping. Try a hard refresh.');
    return;
  }

  const PLAY_ICON = '<polygon points="6,4 20,12 6,20"></polygon>';
  const PAUSE_ICON = '<rect x="5" y="4" width="5" height="16"></rect><rect x="14" y="4" width="5" height="16"></rect>';

  function fmtHowto(s){
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
  }

  function setDisabled(){
    howtoRail.classList.add('disabled');
    howtoRail.classList.remove('playing');
    howtoToggle.disabled = true;
    howtoSkipback.disabled = true;
    howtoScrub.disabled = true;
  }

  howtoToggle.addEventListener('click', ()=>{
    if(howtoAudio.paused){
      howtoAudio.play().catch(setDisabled);
    } else {
      howtoAudio.pause();
    }
  });
  howtoSkipback.addEventListener('click', ()=>{
    howtoAudio.currentTime = Math.max(0, howtoAudio.currentTime - 10);
  });
  howtoScrub.addEventListener('input', ()=>{
    if(howtoAudio.duration) howtoAudio.currentTime = (howtoScrub.value/100) * howtoAudio.duration;
  });

  howtoAudio.addEventListener('play', ()=>{
    howtoRail.classList.add('playing');
    howtoIcon.innerHTML = PAUSE_ICON;
  });
  howtoAudio.addEventListener('pause', ()=>{
    howtoRail.classList.remove('playing');
    howtoIcon.innerHTML = PLAY_ICON;
  });
  howtoAudio.addEventListener('ended', ()=>{
    howtoScrub.value = 0;
    howtoTime.textContent = '0:00';
  });
  howtoAudio.addEventListener('timeupdate', ()=>{
    howtoTime.textContent = fmtHowto(howtoAudio.currentTime);
    if(howtoAudio.duration) howtoScrub.value = (howtoAudio.currentTime / howtoAudio.duration) * 100;
  });
  howtoAudio.addEventListener('error', setDisabled);
})();

renderTracks();
document.getElementById('masterClock').textContent = fmt(totalSeconds);
renderTicker(0);

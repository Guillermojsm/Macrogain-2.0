document.addEventListener('DOMContentLoaded', function() {
  // ====== Estado global ======
  const objetivoBtns = document.querySelectorAll('.objetivo-btn');
  let objetivoSeleccionado = 'definicion'; // por defecto
  let pesoChart = null;

  // ====== Tabs ======
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabs = document.querySelectorAll('.tab-content');
  tabBtns.forEach(b => b.addEventListener('click', () => {
    tabBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const id = b.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'progreso-tab') {
      initProgresoUI();
    }
  }));

  // ====== Objetivo UI ======
  objetivoBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      objetivoBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      objetivoSeleccionado = this.dataset.objetivo;
      localStorage.setItem('objetivo', objetivoSeleccionado);
      // Re-evaluar alertas si estamos en progreso
      if (document.getElementById('progreso-tab').classList.contains('active')) {
        renderProgreso();
      }
    });
  });

  // ====== Tema ======
  const themeBtn = document.getElementById("theme-toggle");
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }
  themeBtn.addEventListener("click", function () {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    this.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  // ====== Persistencia de campos básicos ======
  ['sexo','peso','altura','edad','actividad'].forEach(id => {
    const el = document.getElementById(id);
    const saved = localStorage.getItem('form_'+id);
    if (saved !== null) el.value = saved;
    el.addEventListener('input', () => localStorage.setItem('form_'+id, el.value));
  });
  // Objetivo guardado
  const savedObj = localStorage.getItem('objetivo');
  if (savedObj) {
    objetivoSeleccionado = savedObj;
    objetivoBtns.forEach(b => b.classList.toggle('active', b.dataset.objetivo === savedObj));
  }

  // Enter para calcular
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.getElementById('calc-tab').classList.contains('active')) calcular(); });

  // ====== "Base de datos" local ======
  const DB_KEY = 'macrocalc_db_v1';
  function getDB() {
    try { return JSON.parse(localStorage.getItem(DB_KEY)) || { users: {}, current: null }; }
    catch { return { users: {}, current: null }; }
  }
  function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  function currentUser() {
    const db = getDB();
    if (!db.current) return null;
    return db.users[db.current] || null;
  }

  function setCurrent(email) {
    const db = getDB();
    db.current = email;
    saveDB(db);
  }

  function upsertUser(u) {
    const db = getDB();
    db.users[u.email] = u;
    saveDB(db);
  }

  // ====== Auth (demo local) ======
  const btnRegistrar = document.getElementById('btnRegistrar');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnGuardarPerfil = document.getElementById('btnGuardarPerfil');

  if (btnRegistrar) {
    btnRegistrar.addEventListener('click', () => {
      const nombre = (document.getElementById('reg_nombre').value || '').trim();
      const email = (document.getElementById('reg_email').value || '').toLowerCase().trim();
      const pass = document.getElementById('reg_pass').value || '';
      if (!nombre || !email || pass.length < 6) {
        alert('Completa nombre, email y contraseña (mín. 6).');
        return;
        }
      const db = getDB();
      if (db.users[email]) { alert('Ese email ya está registrado.'); return; }
      const user = {
        name: nombre, email, pass, // DEMO: no seguro
        perfil: { sexo: 'hombre', altura: null, edad: null },
        progreso: [] // {date: 'YYYY-MM-DD', weight: 70.2}
      };
      upsertUser(user);
      setCurrent(email);
      hydrateCuentaUI();
      // Llevar al tab de cuenta
      document.querySelector('[data-tab="cuenta-tab"]').click();
      alert('Cuenta creada. ¡Bienvenido/a!');
    });
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const email = (document.getElementById('log_email').value || '').toLowerCase().trim();
      const pass = document.getElementById('log_pass').value || '';
      const db = getDB();
      const u = db.users[email];
      if (!u || u.pass !== pass) { alert('Credenciales incorrectas.'); return; }
      setCurrent(email);
      hydrateCuentaUI();
      initProgresoUI();
      // Completar calculadora con perfil y último peso
      applyProfileToCalculator();
      document.querySelector('[data-tab="progreso-tab"]').click();
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      const db = getDB();
      db.current = null;
      saveDB(db);
      hydrateCuentaUI();
      initProgresoUI();
      alert('Sesión cerrada.');
    });
  }

  if (btnGuardarPerfil) {
    btnGuardarPerfil.addEventListener('click', () => {
      const u = currentUser(); if (!u) return;
      u.perfil.sexo = document.getElementById('perfil_sexo').value;
      u.perfil.altura = numberOrNull(document.getElementById('perfil_altura').value);
      u.perfil.edad = numberOrNull(document.getElementById('perfil_edad').value);
      upsertUser(u);
      // Sincronizar con calculadora
      applyProfileToCalculator();
      alert('Perfil guardado.');
    });
  }

  // ====== Cuenta UI ======
  function hydrateCuentaUI() {
    const u = currentUser();
    const noActiva = document.getElementById('cuentaNoActiva');
    const activa = document.getElementById('cuentaActiva');
    const estado = document.getElementById('estado-cuenta');
    const btnAdd = document.getElementById('btnAgregarProgreso');
    if (!noActiva) return;

    if (u) {
      noActiva.style.display = 'none';
      activa.style.display = 'block';
      document.getElementById('cuentaNombre').textContent = u.name;
      document.getElementById('cuentaEmail').textContent = u.email;
      document.getElementById('perfil_sexo').value = u.perfil.sexo || 'hombre';
      document.getElementById('perfil_altura').value = u.perfil.altura ?? '';
      document.getElementById('perfil_edad').value = u.perfil.edad ?? '';
      if (estado) estado.style.display = 'none';
      if (btnAdd) btnAdd.disabled = false;
    } else {
      noActiva.style.display = 'block';
      activa.style.display = 'none';
      if (estado) estado.style.display = 'flex';
      if (btnAdd) btnAdd.disabled = true;
    }
  }

  hydrateCuentaUI();

  // ====== Progreso UI ======
  function initProgresoUI() {
    // Fecha por defecto a hoy
    const f = document.getElementById('fechaProgreso');
    if (f && !f.value) f.value = todayStr();

    const est = document.getElementById('fechaEstimacion');
    if (est && !est.value) est.value = todayStr(7); // por defecto una semana adelante

    renderProgreso();
  }

  function renderProgreso() {
    const u = currentUser();
    const mensaje = document.getElementById('mensaje-ritmo');
    if (!u) {
      if (pesoChart) { pesoChart.destroy(); pesoChart = null; }
      if (mensaje) mensaje.style.display = 'none';
      return;
    }
    // Ordenar historial y pintar
    const hist = [...(u.progreso || [])].sort((a,b) => (a.date < b.date ? -1 : 1));
    drawChart(hist);
    // Evaluar ritmo y alertas
    const evalRitmo = trendStats(hist);
    if (mensaje) {
      if (!evalRitmo) {
        mensaje.style.display = 'none';
      } else {
        const { kgPerWeek, pctPerWeek } = evalRitmo;
        const msg = buildRateMessage(pctPerWeek, kgPerWeek, objetivoSeleccionado, lastWeight(hist));
        mensaje.innerHTML = msg.html;
        mensaje.className = 'notice ' + msg.level;
        mensaje.style.display = 'block';
      }
    }
  }

  // Botón agregar progreso
  const btnAgregarProgreso = document.getElementById('btnAgregarProgreso');
  if (btnAgregarProgreso) {
    btnAgregarProgreso.addEventListener('click', () => {
      const u = currentUser(); if (!u) return;
      const fecha = document.getElementById('fechaProgreso').value;
      const peso = parseFloat(document.getElementById('pesoProgreso').value);
      if (!fecha || isNaN(peso) || peso <= 0) { alert('Completa fecha y peso válido.'); return; }
      // Insertar o actualizar ese día
      const i = u.progreso.findIndex(p => p.date === fecha);
      if (i >= 0) u.progreso[i].weight = peso; else u.progreso.push({ date: fecha, weight: peso });
      upsertUser(u);
      // Autocompletar calculadora y recalcular
      document.getElementById('peso').value = peso;
      localStorage.setItem('form_peso', peso);
      // Si hay datos suficientes, autocompletar sexo/altura/edad del perfil
      applyProfileToCalculator();
      // Calcular si ya hay entradas completas
      calcular(true);
      // Refrescar progreso
      renderProgreso();
      alert('Registro guardado.');
    });
  }

  // Estimación de peso a fecha
  const fechaEstimacion = document.getElementById('fechaEstimacion');
  const resultadoEstimacion = document.getElementById('resultadoEstimacion');
  if (fechaEstimacion) {
    fechaEstimacion.addEventListener('input', () => {
      const u = currentUser(); if (!u) { resultadoEstimacion.value = '—'; return; }
      const hist = [...(u.progreso||[])].sort((a,b)=>a.date<b.date?-1:1);
      if (hist.length < 2) { resultadoEstimacion.value = 'Insuf. datos'; return; }
      const est = estimateWeightAt(new Date(fechaEstimacion.value), hist);
      if (!est) { resultadoEstimacion.value = '—'; return; }
      resultadoEstimacion.value = `${est.weight.toFixed(2)} kg  (±${est.error.toFixed(2)} kg)`;
    });
  }

  // ====== Funciones utilitarias ======
  function todayStr(offsetDays = 0) {
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0,10);
  }

  function numberOrNull(v) {
    const n = parseFloat(v); return isNaN(n) ? null : n;
  }

  function lastWeight(hist) {
    if (!hist || !hist.length) return null;
    return hist[hist.length - 1].weight;
  }

  function applyProfileToCalculator() {
    const u = currentUser(); if (!u) return;
    if (u.profilSyncedOnce) return; // aplicada al menos una vez
    if (u.perfil?.sexo) document.getElementById('sexo').value = u.perfil.sexo;
    if (u.perfil?.altura) document.getElementById('altura').value = u.perfil.altura, localStorage.setItem('form_altura', u.perfil.altura);
    if (u.perfil?.edad) document.getElementById('edad').value = u.perfil.edad, localStorage.setItem('form_edad', u.perfil.edad);
    const lw = lastWeight(u.progreso);
    if (lw) document.getElementById('peso').value = lw, localStorage.setItem('form_peso', lw);
    u.profilSyncedOnce = true; upsertUser(u);
  }

  // ====== Gráfica ======
  function drawChart(hist) {
    const ctx = document.getElementById('pesoChart');
    if (!ctx) return;
    if (pesoChart) { pesoChart.destroy(); pesoChart = null; }

    const labels = hist.map(p => p.date);
    const data = hist.map(p => p.weight);

    const canvas = ctx.getContext('2d');
    const gradient = canvas.createLinearGradient(0,0,0,220);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');

    pesoChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Peso (kg)',
          data,
          tension: 0.3,
          borderColor: getComputedStyle(document.body).classList?.contains('dark') ? '#38bdf8' : '#475569',
          backgroundColor: gradient,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)} kg` } }
        },
        scales: {
          x: { ticks: { maxRotation: 0 }, grid: { display: false } },
          y: { grid: { color: 'rgba(100,116,139,0.2)' } }
        }
      }
    });
  }

  // ====== Tendencia y estimación ======
  // Regresión lineal simple (x = días desde primera medición, y = peso)
  function trendStats(hist) {
    if (!hist || hist.length < 2) return null;
    const x = hist.map(p => (new Date(p.date) - new Date(hist[0].date)) / (1000*3600*24));
    const y = hist.map(p => p.weight);
    const n = x.length;
    const sum = arr => arr.reduce((a,b)=>a+b,0);
    const xbar = sum(x)/n, ybar = sum(y)/n;
    let sxx=0, sxy=0, sse=0;
    for (let i=0;i<n;i++){ sxx+=(x[i]-xbar)**2; sxy+=(x[i]-xbar)*(y[i]-ybar); }
    if (sxx === 0) return null;
    const b = sxy / sxx;         // kg/día
    const a = ybar - b * xbar;   // intercepto
    // error estándar simple
    for (let i=0;i<n;i++){ sse += (y[i] - (a + b*x[i]))**2; }
    const sigma = Math.sqrt(sse / (n-2)) || 0;

    const kgPerWeek = b * 7;
    const pctPerWeek = (kgPerWeek / y[y.length-1]) * 100;
    return { a, b, kgPerWeek, pctPerWeek, sigma };
  }

  function estimateWeightAt(date, hist) {
    const stats = trendStats(hist);
    if (!stats) return null;
    const { a, b, sigma } = stats;
    const x = (date - new Date(hist[0].date)) / (1000*3600*24);
    const weight = a + b*x;
    // margen simple ~ 2*sigma como banda
    return { weight, error: Math.min(5, Math.max(0.5, sigma*2)) };
  }

  // ====== Reglas y mensajes ======
  function getGoalThresholds(obj) {
    if (obj === 'volumen') return { min: 0.25, max: 0.5 }; // %/sem
    if (obj === 'definicion') return { min: 0.5, max: 1.0 };
    return { min: -0.25, max: 0.25 }; // mantenimiento
  }

  function buildRateMessage(pctPerWeek, kgPerWeek, objetivo, currentW) {
    const thr = getGoalThresholds(objetivo);
    const abs = Math.abs(pctPerWeek);
    let html = '';
    let level = 'info';

    if (objetivo === 'volumen') {
      if (pctPerWeek > thr.max) {
        html = `<i class="fas fa-triangle-exclamation"></i> Estás ganando peso a ${pctPerWeek.toFixed(2)}%/sem (${kgPerWeek.toFixed(2)} kg/sem), por encima de lo recomendado (${thr.min}–${thr.max}%/sem). Podrías estar acumulando grasa extra.`;
        level = 'warn';
      } else if (pctPerWeek < thr.min) {
        html = `<i class="fas fa-circle-info"></i> Ritmo de volumen bajo (${pctPerWeek.toFixed(2)}%/sem). Si te sientes bien, ok; si buscas acelerar, aumenta ligeramente calorías.`;
        level = 'info';
      } else {
        html = `<i class="fas fa-check-circle"></i> Ritmo de volumen dentro de lo recomendado (${pctPerWeek.toFixed(2)}%/sem).`;
        level = 'ok';
      }
    } else if (objetivo === 'definicion') {
      if (abs > thr.max) {
        html = `<i class="fas fa-triangle-exclamation"></i> Pérdida rápida: ${pctPerWeek.toFixed(2)}%/sem (${kgPerWeek.toFixed(2)} kg/sem). Riesgo de perder masa magra. Considera reducir el déficit.`;
        level = 'warn';
      } else if (abs < thr.min) {
        html = `<i class="fas fa-circle-info"></i> Pérdida lenta (${pctPerWeek.toFixed(2)}%/sem). Si el progreso es sostenible y te sientes bien, está ok; si quieres acelerar, aumenta ligeramente el déficit.`;
        level = 'info';
      } else {
        html = `<i class="fas fa-check-circle"></i> Ritmo de definición adecuado (${pctPerWeek.toFixed(2)}%/sem).`;
        level = 'ok';
      }
    } else { // mantenimiento
      if (abs > 0.25) {
        html = `<i class="fas fa-bell"></i> Estás variando ${pctPerWeek.toFixed(2)}%/sem (${kgPerWeek.toFixed(2)} kg/sem). Ajusta calorías/actividad para volver a mantenimiento.`;
        level = 'warn';
      } else {
        html = `<i class="fas fa-check-circle"></i> Peso estable dentro del rango de mantenimiento (±0.25%/sem).`;
        level = 'ok';
      }
    }

    // Fuente resumida
    const refs = `
      <div class="muted" style="margin-top:6px;">
        Fuentes: Iraki et al. 2019 (off-season: +0.25–0.5%/sem); Garthe et al. 2011 (pérdida lenta ≈0.7%/sem preserva FFM); Roberts/Helms et al. 2020 (≤0.5–1%/sem).
      </div>
    `;
    return { html: html + refs, level };
  }

  // ====== CALCULADORA EXISTENTE (con pequeño ajuste) ======
  window.calcular = function(silencioso=false) {
    const sexo = document.getElementById("sexo").value;
    const peso = parseFloat(document.getElementById("peso").value);
    const altura = parseFloat(document.getElementById("altura").value);
    const edad = parseFloat(document.getElementById("edad").value);
    const actividad = parseFloat(document.getElementById("actividad").value);

    if (isNaN(peso) || isNaN(altura) || isNaN(edad) ||
        peso <= 0 || altura <= 0 || edad <= 0) {
      if (!silencioso) mostrarError("Por favor, rellena todos los campos con valores válidos.");
      return;
    }

    // ==== CALCULO TMB ====
    let TMB = (10 * peso) + (6.25 * altura) - (5 * edad);
    if (sexo === "hombre") TMB += 5; else TMB -= 161;

    // Calorías base
    let calorias = TMB * actividad;

    let descripcionObjetivo;
    if (objetivoSeleccionado === "volumen") {
      calorias *= 1.15;
      descripcionObjetivo = "Volumen (Superávit 15%)";
    } else if (objetivoSeleccionado === "definicion") {
      calorias *= 0.80;
      descripcionObjetivo = "Definición (Déficit 20%)";
    } else {
      descripcionObjetivo = "Mantenimiento";
    }

    // ==== MACROS (prote 2 g/kg; grasas 25%) ====
    const proteinas = Math.round(peso * 2);
    const kcal_prot = proteinas * 4;
    const grasas = Math.round((0.25 * calorias) / 9);
    const kcal_grasas = grasas * 9;
    const kcal_carbos = calorias - (kcal_prot + kcal_grasas);

    // Clamp carbos
    const carbos = Math.max(0, Math.round(kcal_carbos / 4));
    const kcal_carbos_aj = carbos * 4;

    mostrarResultados(calorias, proteinas, kcal_prot, grasas, kcal_grasas, carbos, kcal_carbos_aj, descripcionObjetivo);
  }

  function mostrarResultados(cal, prot, kcal_prot, grasa, kcal_grasa, carb, kcal_carb, objetivo) {
    const div = document.getElementById("resultados");
    div.innerHTML = `
      <h2><i class="fas fa-chart-pie"></i> Resultados</h2>
      <p><strong>Objetivo:</strong> ${objetivo}</p>

      <div class="calories-total">
        <h3>Total</h3>
        <div class="amount">${Math.round(cal)} kcal</div>
      </div>

      <div class="macro-grid">
        <div class="macro-card">
          <h3><i class="fas fa-drumstick-bite"></i> Proteínas</h3>
          <div class="amount">${prot} g</div>
          <div class="calories">${kcal_prot} kcal</div>
        </div>

        <div class="macro-card">
          <h3><i class="fas fa-seedling"></i> Grasas</h3>
          <div class="amount">${grasa} g</div>
          <div class="calories">${kcal_grasa} kcal</div>
        </div>

        <div class="macro-card">
          <h3><i class="fas fa-bread-slice"></i> Carbohidratos</h3>
          <div class="amount">${carb} g</div>
          <div class="calories">${Math.round(kcal_carb)} kcal</div>
        </div>
      </div>

      <div style="margin-top: 20px; padding: 15px; background: rgba(100, 116, 139, 0.1); border-radius: 10px; text-align: center;">
        <small style="color: #475569;">
          <i class="fas fa-info-circle"></i> Distribución:
          ${Math.round((kcal_prot/cal)*100)}% proteínas,
          ${Math.round((kcal_grasa/cal)*100)}% grasas,
          ${Math.round((kcal_carb/cal)*100)}% carbohidratos
        </small>
      </div>
    `;
    div.classList.add("show");
    div.scrollIntoView({behavior:"smooth"});
  }

  function mostrarError(msg) {
    const div = document.getElementById("resultados");
    div.innerHTML = `<div class="error-callout">⚠️ ${msg}</div>`;
    div.classList.add("show");
  }

  // Inicializar progreso si se entra directo al tab
  if (document.getElementById('progreso-tab').classList.contains('active')) {
    initProgresoUI();
  }

  // Sincronizar estado cuenta al cargar
  hydrateCuentaUI();
});
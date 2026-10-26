/* CAF ° — configuração Supabase em config.js; não coloque service_role no navegador. */
const CONFIG = window.CAF_CONFIG || {};
const SUPABASE_URL = CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY || "";
const hasConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const db = hasConfig ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 2 } }
}) : null;

const state = { atendimento: null, qualidade: null, satisfacao: null, rows: [], realtimeChannel: null };
const $ = (id) => document.getElementById(id);
const questionLabels = [
  { key: "atendimento", label: "1. Atendimento CAF" },
  { key: "qualidade", label: "2. Qualidade e prazos" },
  { key: "satisfacao", label: "4. Satisfação geral" }
];

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === tab.dataset.view));
  if (tab.dataset.view === "dashboardView") loadDashboard();
}));

document.querySelectorAll("[data-rating]").forEach((group) => {
  group.querySelectorAll(".rating").forEach((button) => button.addEventListener("click", () => {
    const key = group.dataset.rating;
    state[key] = Number(button.dataset.value);
    group.querySelectorAll(".rating").forEach((item) => {
      const selected = Number(item.dataset.value) <= state[key];
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-checked", String(Number(item.dataset.value) === state[key]));
    });
    group.dataset.selected = String(state[key]);
  }));
});
$("comentario").addEventListener("input", (event) => $("charCount").textContent = event.target.value.length);
$("refreshButton").addEventListener("click", loadDashboard);
$("periodFilter").addEventListener("change", loadDashboard);

function setConnection(text, online = false) {
  $("connectionStatus").textContent = text;
  const dot = document.querySelector(".top-status .status-dot");
  dot.style.background = online ? "#17d69a" : "#f6b84a";
  dot.style.boxShadow = online ? "0 0 0 4px #17d69a1c" : "0 0 0 4px #f6b84a1c";
}
function showToast(message) {
  const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}
function formMessage(message, type) {
  const node = $("formMessage"); node.textContent = message; node.className = `form-message ${type || ""}`;
}
function getLocalDay(date = new Date()) {
  const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, "0"), day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function validConfig() {
  if (!db) {
    setConnection("Configure o Supabase", false);
    formMessage("O formulário ainda não está conectado. Configure SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js e publique novamente.", "error");
    return false;
  }
  return true;
}

$("surveyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.atendimento || !state.qualidade || !$('surveyForm').querySelector('input[name="satisfacao"]:checked')) {
    formMessage("Responda às perguntas 1, 2 e 4 antes de enviar.", "error"); return;
  }
  if (!validConfig()) return;
  const submit = $("submitButton"); submit.disabled = true; submit.textContent = "Enviando…";
  const payload = {
    atendimento: state.atendimento,
    qualidade: state.qualidade,
    comentario: $("comentario").value.trim() || null,
    satisfacao: Number($('surveyForm').querySelector('input[name="satisfacao"]:checked').value)
  };
  try {
    const { error } = await db.from("CAF_respostas").insert(payload);
    if (error) throw error;
    state.atendimento = null; state.qualidade = null;
    document.querySelectorAll(".rating").forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-checked", "false"); });
    $("surveyForm").reset(); $("charCount").textContent = "0";
    formMessage("Obrigado! Sua resposta foi registrada com sucesso e de forma anônima.", "success");
    showToast("Resposta enviada com sucesso.");
    if ($("dashboardView").classList.contains("active")) await loadDashboard();
  } catch (error) {
    console.error(error);
    formMessage("Não foi possível enviar agora. Verifique a conexão e tente novamente.", "error");
  } finally {
    submit.disabled = false; submit.innerHTML = 'Enviar respostas <span>→</span>';
  }
});

function selectedPeriod() {
  const value = $("periodFilter").value;
  if (value === "all") return null;
  const date = new Date(); date.setDate(date.getDate() - Number(value) + 1); date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
async function rpc(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data;
}
async function loadDashboard() {
  if (!db) {
    $("dashboardMessage").textContent = "Dashboard demonstrativo indisponível até configurar o Supabase.";
    $("kpiResponses").textContent = "—"; $("kpiAverage").textContent = "—"; $("kpiPositive").textContent = "—"; $("kpiToday").textContent = "—";
    $("questionBreakdown").innerHTML = '<p class="empty-state">Configure o Supabase para carregar os indicadores reais.</p>';
    $("trendChart").innerHTML = '<p class="empty-state">Sem conexão com a base de dados.</p>';
    $("recentRows").innerHTML = '<tr><td colspan="4">Dados indisponíveis.</td></tr>';
    return;
  }
  $("dashboardMessage").textContent = "Atualizando indicadores…";
  try {
    const fromDate = selectedPeriod();
    const [summary, trend, recent] = await Promise.all([
      rpc("CAF_dashboard_summary", { p_from: fromDate }),
      rpc("CAF_daily_trend", { p_from: fromDate }),
      rpc("CAF_recent_ratings", { p_limit: 8, p_from: fromDate })
    ]);
    renderSummary(summary); renderTrend(trend || []); renderRecent(recent || []);
    renderBreakdown(summary);
    $("dashboardMessage").textContent = `Dados atualizados · ${Number(summary?.total || 0)} resposta(s) no período selecionado.`;
    $("lastUpdated").textContent = `Última atualização: ${new Date().toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"})}`;
    setConnection("Sistema online", true);
  } catch (error) {
    console.error(error);
    $("dashboardMessage").textContent = "Não foi possível carregar os indicadores. Confira a configuração e as funções SQL do Supabase.";
  }
}
function renderSummary(s = {}) {
  $("kpiResponses").textContent = Number(s.total || 0).toLocaleString("pt-BR");
  $("kpiAverage").textContent = s.media_geral == null ? "—" : Number(s.media_geral).toLocaleString("pt-BR", {minimumFractionDigits:1,maximumFractionDigits:1});
  $("kpiPositive").textContent = s.percentual_satisfeitos == null ? "—" : `${Number(s.percentual_satisfeitos).toLocaleString("pt-BR",{maximumFractionDigits:1})}%`;
  $("kpiToday").textContent = Number(s.hoje || 0).toLocaleString("pt-BR");
}
function renderBreakdown(s = {}) {
  const values = [
    { label: "Atendimento CAF", value: s.media_atendimento },
    { label: "Qualidade e prazos", value: s.media_qualidade },
    { label: "Satisfação geral", value: s.media_satisfacao }
  ];
  $("questionBreakdown").innerHTML = values.map((item) => {
    const value = item.value == null ? null : Number(item.value);
    const pct = value == null ? 0 : Math.max(0, Math.min(100, value / 5 * 100));
    return `<div class="breakdown-item"><div class="breakdown-top"><span>${item.label}</span><strong>${value == null ? "—" : value.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})} / 5</strong></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
  }).join("");
}
function renderTrend(rows) {
  if (!rows.length) { $("trendChart").innerHTML = '<p class="empty-state">Ainda não há respostas para este período.</p>'; return; }
  const data = rows.slice(-14), width = 640, height = 205, pad = {l:34,r:15,t:15,b:30};
  const x = (i) => pad.l + i * (width - pad.l - pad.r) / Math.max(data.length - 1, 1);
  const y = (v) => pad.t + (5 - Number(v || 0)) * (height - pad.t - pad.b) / 5;
  const grid = [1,2,3,4,5].map(v => `<line x1="${pad.l}" y1="${y(v)}" x2="${width-pad.r}" y2="${y(v)}" stroke="#e7eef7" stroke-width="1"/><text x="${pad.l-9}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#8292a8">${v}</text>`).join("");
  const points = data.map((d,i) => `${x(i)},${y(d.media)}`).join(" ");
  const area = `${pad.l},${height-pad.b} ${points} ${x(data.length-1)},${height-pad.b}`;
  const circles = data.map((d,i) => `<circle cx="${x(i)}" cy="${y(d.media)}" r="4" fill="#0967e8" stroke="white" stroke-width="2"><title>${escapeHtml(d.dia)}: ${Number(d.media).toFixed(1)}</title></circle>`).join("");
  const labels = data.map((d,i) => (i % Math.ceil(data.length/7) === 0 || i === data.length-1) ? `<text x="${x(i)}" y="${height-8}" text-anchor="middle" font-size="10" fill="#8292a8">${escapeHtml(String(d.dia).slice(5).replace("-","/"))}</text>` : "").join("");
  $("trendChart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico da evolução diária da satisfação">${grid}<polygon points="${area}" fill="#0967e8" opacity=".08"/><polyline points="${points}" fill="none" stroke="#0967e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels}</svg>`;
}
function renderRecent(rows) {
  if (!rows.length) { $("recentRows").innerHTML = '<tr><td colspan="4">Ainda não há respostas neste período.</td></tr>'; return; }
  $("recentRows").innerHTML = rows.map(row => `<tr><td>${escapeHtml(formatDate(row.criado_em))}</td><td>${Number(row.atendimento)}/5</td><td>${Number(row.qualidade)}/5</td><td>${Number(row.satisfacao)}/5</td></tr>`).join("");
}
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
async function startRealtime() {
  if (!db) return;
  try {
    state.realtimeChannel = db.channel("CAF-dashboard-public")
      .on("postgres_changes", {event:"INSERT",schema:"public",table:"CAF_respostas"}, () => {
        if ($("dashboardView").classList.contains("active")) loadDashboard();
        showToast("Novas respostas recebidas. Dashboard atualizado.");
      }).subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("Sistema online · tempo real", true);
      });
  } catch (error) { console.warn("Realtime indisponível", error); }
}
if (hasConfig) { setConnection("Conectando…", false); startRealtime(); }
else { setConnection("Configure o Supabase", false); }
loadDashboard();

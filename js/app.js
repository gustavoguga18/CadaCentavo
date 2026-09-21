const sb = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

const cats = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Lazer",
  "Saúde",
  "Educação",
  "Compras",
  "Assinaturas",
  "Contas",
  "Outros"
];

let user = null;
let tx = [];
let goals = [];
let goalMovements = [];
let selectedMonth = new Date().toISOString().slice(0, 7);
let selectedGoal = null;

const $ = id => document.getElementById(id);

const money = value =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const dateBR = value =>
  new Date(value + "T12:00:00").toLocaleDateString("pt-BR");

const dateTimeBR = value =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );

function msg(el, text, ok = false) {
  if (!el) return;

  el.textContent = text;
  el.style.color = ok ? "#12b76a" : "#f04438";
}

function open(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

function close(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}

function page(p) {
  document
    .querySelectorAll(".page")
    .forEach(x => x.classList.add("hidden"));

  const target = $(`${p}-page`);

  if (target) {
    target.classList.remove("hidden");
  }

  document
    .querySelectorAll(".nav")
    .forEach(x =>
      x.classList.toggle("active", x.dataset.page === p)
    );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function initMonths() {
  const select = $("month-filter");

  if (!select) return;

  select.innerHTML = "";

  const now = new Date();

  for (let i = 0; i < 13; i++) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    const value = d.toISOString().slice(0, 7);

    const label = d.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });

    const option = document.createElement("option");

    option.value = value;
    option.textContent =
      label.charAt(0).toUpperCase() + label.slice(1);

    select.appendChild(option);
  }

  select.value = selectedMonth;
}

function fillCats() {
  const select = $("tx-category");

  if (!select) return;

  select.innerHTML = cats
    .map(c => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join("");
}

/* =========================
   CARREGAR DADOS
========================= */

async function load() {
  const [
    transactionsResult,
    goalsResult,
    movementsResult
  ] = await Promise.all([
    sb
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),

    sb
      .from("goals")
      .select("*")
      .order("created_at", { ascending: false }),

    sb
      .from("goal_movements")
      .select("*")
      .order("created_at", { ascending: false })
  ]);

  if (transactionsResult.error) {
    throw transactionsResult.error;
  }

  if (goalsResult.error) {
    throw goalsResult.error;
  }

  if (movementsResult.error) {
    throw movementsResult.error;
  }

  tx = transactionsResult.data || [];
  goals = goalsResult.data || [];
  goalMovements = movementsResult.data || [];

  render();
}

/* =========================
   RENDER PRINCIPAL
========================= */

function render() {
  const mtx = tx.filter(
    t => String(t.date).slice(0, 7) === selectedMonth
  );

  const inc = mtx
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const exp = mtx
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  if ($("balance")) {
    $("balance").textContent = money(inc - exp);
  }

  if ($("income")) {
    $("income").textContent = money(inc);
  }

  if ($("expense")) {
    $("expense").textContent = money(exp);
  }

  if ($("transaction-count")) {
    $("transaction-count").textContent = mtx.length;
  }

  if ($("balance-status")) {
    $("balance-status").textContent =
      inc - exp >= 0
        ? "Saldo positivo neste mês"
        : "Atenção: despesas acima das entradas";
  }

  renderCategories(mtx);
  renderRecent(mtx);
  renderTable();
  renderGoals();
}

/* =========================
   CATEGORIAS
========================= */

function renderCategories(mtx) {
  const map = {};

  mtx
    .filter(t => t.type === "expense")
    .forEach(t => {
      map[t.category] =
        (map[t.category] || 0) + Number(t.amount);
    });

  const arr = Object.entries(map).sort(
    (a, b) => b[1] - a[1]
  );

  const max = Math.max(
    ...arr.map(x => x[1]),
    1
  );

  if (!$("category-list")) return;

  $("category-list").innerHTML = arr.length
    ? arr
        .map(
          ([category, value]) => `
            <div class="cat-row">
              <span>${esc(category)}</span>

              <div class="bar">
                <i style="width:${(value / max) * 100}%"></i>
              </div>

              <strong>${money(value)}</strong>
            </div>
          `
        )
        .join("")
    : `<p class="muted">Nenhuma despesa neste mês.</p>`;
}

/* =========================
   RECENTES
========================= */

function renderRecent(mtx) {
  const recent = mtx.slice(0, 5);

  if (!$("recent-list")) return;

  $("recent-list").innerHTML = recent.length
    ? recent.map(row).join("")
    : `<p class="muted">Nenhum lançamento neste mês.</p>`;
}

function row(t) {
  return `
    <div class="tx-row">
      <div>
        <div class="tx-title">
          ${esc(t.description)}
        </div>

        <div class="tx-meta">
          ${esc(t.category)}
          ·
          ${dateBR(t.date)}
          ·
          ${esc(t.payment_method || "—")}
        </div>
      </div>

      <strong class="${t.type}">
        ${t.type === "income" ? "+" : "−"}
        ${money(t.amount)}
      </strong>
    </div>
  `;
}

/* =========================
   TABELA
========================= */

function renderTable() {
  if (!$("transactions-table")) return;

  const q = (
    $("search")?.value || ""
  ).toLowerCase();

  const typ = $("type-filter")?.value || "";

  const arr = tx.filter(t => {
    const monthMatch =
      String(t.date).slice(0, 7) === selectedMonth;

    const typeMatch =
      !typ || t.type === typ;

    const searchMatch =
      `${t.description} ${t.category}`
        .toLowerCase()
        .includes(q);

    return monthMatch && typeMatch && searchMatch;
  });

  $("transactions-table").innerHTML = arr.length
    ? arr
        .map(
          t => `
            <tr>
              <td>${dateBR(t.date)}</td>

              <td>
                <b>${esc(t.description)}</b>
              </td>

              <td>
                <span class="pill ${t.type}">
                  ${esc(t.category)}
                </span>
              </td>

              <td>
                ${esc(t.payment_method || "—")}
              </td>

              <td class="${t.type}">
                <b>
                  ${t.type === "income" ? "+" : "−"}
                  ${money(t.amount)}
                </b>
              </td>

              <td>
                <button
                  class="delete"
                  data-id="${t.id}"
                >
                  Excluir
                </button>
              </td>
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td
          colspan="6"
          style="text-align:center;color:#98a2b3;padding:35px"
        >
          Nenhum lançamento encontrado.
        </td>
      </tr>
    `;

  document
    .querySelectorAll("[data-id]")
    .forEach(button => {
      button.onclick = () =>
        del(button.dataset.id);
    });
}

/* =========================
   METAS
========================= */

function renderGoals() {
  if (!$("goals-list")) return;

  if (!goals.length) {
    $("goals-list").innerHTML = `
      <div class="panel">
        <p class="muted">
          Você ainda não criou nenhuma meta.
        </p>
      </div>
    `;

    return;
  }

  $("goals-list").innerHTML = goals
    .map(goalCard)
    .join("");

  document
    .querySelectorAll(".goal-add")
    .forEach(button => {
      button.onclick = () =>
        openMovementModal(
          button.dataset.goal,
          "add"
        );
    });

  document
    .querySelectorAll(".goal-remove")
    .forEach(button => {
      button.onclick = () =>
        openMovementModal(
          button.dataset.goal,
          "remove"
        );
    });

  document
    .querySelectorAll(".goal-history")
    .forEach(button => {
      button.onclick = () =>
        openGoalHistory(button.dataset.goal);
    });

  document
    .querySelectorAll(".goal-delete")
    .forEach(button => {
      button.onclick = () =>
        deleteGoal(button.dataset.goal);
    });
}

function goalCard(goal) {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);

  const percentage =
    target > 0
      ? Math.min((current / target) * 100, 100)
      : 0;

  const movementCount = goalMovements.filter(
    movement => movement.goal_id === goal.id
  ).length;

  return `
    <article class="goal">

      <div class="goal-header">
        <div>
          <h3>${esc(goal.name)}</h3>

          <span class="goal-history-count">
            ${movementCount}
            ${movementCount === 1 ? "movimentação" : "movimentações"}
          </span>
        </div>

        <button
          class="goal-delete"
          data-goal="${goal.id}"
          title="Excluir meta"
        >
          Excluir
        </button>
      </div>

      <div class="goal-values">
        <span>${money(current)}</span>
        <span>${money(target)}</span>
      </div>

      <div class="progress">
        <i style="width:${percentage}%"></i>
      </div>

      <div class="goal-values">
        <span>
          ${percentage.toFixed(0)}% concluído
        </span>

        <span>
          faltam ${money(Math.max(target - current, 0))}
        </span>
      </div>

      <div class="goal-actions">

        <button
          class="goal-btn goal-add"
          data-goal="${goal.id}"
        >
          + Adicionar
        </button>

        <button
          class="goal-btn goal-remove"
          data-goal="${goal.id}"
        >
          − Retirar
        </button>

        <button
          class="goal-btn goal-history"
          data-goal="${goal.id}"
        >
          Histórico
        </button>

      </div>

    </article>
  `;
}

/* =========================
   MOVIMENTAR META
========================= */

function openMovementModal(goalId, type) {
  const goal = goals.find(g => g.id === goalId);

  if (!goal) return;

  selectedGoal = goal;

  const title =
    type === "add"
      ? "Adicionar valor"
      : "Retirar valor";

  const description =
    type === "add"
      ? `Adicionar dinheiro à meta "${goal.name}".`
      : `Retirar dinheiro da meta "${goal.name}".`;

  if ($("movement-title")) {
    $("movement-title").textContent = title;
  }

  if ($("movement-description")) {
    $("movement-description").textContent =
      description;
  }

  if ($("movement-type")) {
    $("movement-type").value = type;
  }

  if ($("movement-amount")) {
    $("movement-amount").value = "";
  }

  if ($("movement-message")) {
    $("movement-message").textContent = "";
  }

  open("movement-modal");
}

/* =========================
   SALVAR MOVIMENTAÇÃO
========================= */

if ($("movement-form")) {
  $("movement-form").onsubmit = async e => {
    e.preventDefault();

    if (!selectedGoal) return;

    const type =
      $("movement-type").value;

    const amount =
      Number($("movement-amount").value);

    if (!amount || amount <= 0) {
      return msg(
        $("movement-message"),
        "Digite um valor válido."
      );
    }

    const current =
      Number(selectedGoal.current_amount);

    if (
      type === "remove" &&
      amount > current
    ) {
      return msg(
        $("movement-message"),
        "Você não pode retirar mais do que o valor atual da meta."
      );
    }

    const newAmount =
      type === "add"
        ? current + amount
        : current - amount;

    const movement = await sb
      .from("goal_movements")
      .insert({
        goal_id: selectedGoal.id,
        user_id: user.id,
        type,
        amount
      });

    if (movement.error) {
      return msg(
        $("movement-message"),
        movement.error.message
      );
    }

    const update = await sb
      .from("goals")
      .update({
        current_amount: newAmount
      })
      .eq("id", selectedGoal.id)
      .eq("user_id", user.id);

    if (update.error) {
      return msg(
        $("movement-message"),
        update.error.message
      );
    }

    close("movement-modal");

    selectedGoal = null;

    await load();
  };
}

/* =========================
   HISTÓRICO DA META
========================= */

function openGoalHistory(goalId) {
  const goal = goals.find(g => g.id === goalId);

  if (!goal) return;

  const movements = goalMovements.filter(
    movement => movement.goal_id === goalId
  );

  if ($("history-title")) {
    $("history-title").textContent =
      `Histórico — ${goal.name}`;
  }

  if (!$("history-list")) return;

  $("history-list").innerHTML =
    movements.length
      ? movements
          .map(
            movement => `
              <div class="movement-row">

                <div>
                  <strong>
                    ${
                      movement.type === "add"
                        ? "Valor adicionado"
                        : "Valor retirado"
                    }
                  </strong>

                  <small>
                    ${dateTimeBR(
                      movement.created_at
                    )}
                  </small>
                </div>

                <strong
                  class="${
                    movement.type === "add"
                      ? "income"
                      : "expense"
                  }"
                >
                  ${
                    movement.type === "add"
                      ? "+"
                      : "−"
                  }
                  ${money(movement.amount)}
                </strong>

              </div>
            `
          )
          .join("")
      : `
        <p class="muted">
          Nenhuma movimentação registrada.
        </p>
      `;

  open("history-modal");
}

/* =========================
   EXCLUIR META
========================= */

async function deleteGoal(goalId) {
  const goal = goals.find(
    g => g.id === goalId
  );

  if (!goal) return;

  const confirmed = confirm(
    `Excluir a meta "${goal.name}"?\n\nTodas as movimentações dessa meta também serão excluídas.`
  );

  if (!confirmed) return;

  const result = await sb
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (result.error) {
    alert(result.error.message);
    return;
  }

  await load();
}

/* =========================
   EXCLUIR LANÇAMENTO
========================= */

async function del(id) {
  if (!confirm("Excluir este lançamento?")) {
    return;
  }

  const result = await sb
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (result.error) {
    alert(result.error.message);
    return;
  }

  await load();
}

/* =========================
   AUTENTICAÇÃO
========================= */

$("auth-form").onsubmit = async e => {
  e.preventDefault();

  const signup =
    $("auth-title").dataset.signup === "1";

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  const result = signup
    ? await sb.auth.signUp({
        email,
        password
      })
    : await sb.auth.signInWithPassword({
        email,
        password
      });

  if (result.error) {
    return msg(
      $("auth-message"),
      result.error.message
    );
  }

  if (
    signup &&
    !result.data.session
  ) {
    return msg(
      $("auth-message"),
      "Conta criada. Verifique seu e-mail para confirmar.",
      true
    );
  }

  start(result.data.user);
};

$("toggle-auth").onclick = () => {
  const signup =
    $("auth-title").dataset.signup !== "1";

  $("auth-title").dataset.signup =
    signup ? "1" : "0";

  $("auth-title").textContent =
    signup
      ? "Criar sua conta"
      : "Bem-vindo de volta";

  $("auth-submit").textContent =
    signup
      ? "Criar conta"
      : "Entrar";

  $("toggle-auth").textContent =
    signup
      ? "Já tenho uma conta"
      : "Criar uma conta";

  $("auth-message").textContent = "";
};

/* =========================
   INICIAR APP
========================= */

async function start(u) {
  user = u;

  $("auth-screen").classList.add("hidden");
  $("app-screen").classList.remove("hidden");

  const name =
    u.email.split("@")[0];

  $("hello-name").textContent = name;
  $("user-name").textContent = name;
  $("user-email").textContent = u.email;
  $("avatar").textContent =
    name[0].toUpperCase();

  initMonths();
  fillCats();

  if ($("tx-date")) {
    $("tx-date").value =
      new Date().toISOString().slice(0, 10);
  }

  try {
    await load();
  } catch (error) {
    alert(error.message);
  }
}

/* =========================
   LOGOUT
========================= */

$("logout-btn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

/* =========================
   FILTROS
========================= */

if ($("month-filter")) {
  $("month-filter").onchange = e => {
    selectedMonth = e.target.value;
    render();
  };
}

if ($("search")) {
  $("search").oninput = renderTable;
}

if ($("type-filter")) {
  $("type-filter").onchange = renderTable;
}

/* =========================
   NAVEGAÇÃO
========================= */

document
  .querySelectorAll("[data-page]")
  .forEach(button => {
    button.onclick = () =>
      page(button.dataset.page);
  });

document
  .querySelectorAll("[data-go]")
  .forEach(button => {
    button.onclick = () =>
      page(button.dataset.go);
  });

/* =========================
   MODAIS
========================= */

if ($("open-transaction")) {
  $("open-transaction").onclick =
    () => open("transaction-modal");
}

if ($("open-transaction-quick")) {
  $("open-transaction-quick").onclick =
    () => open("transaction-modal");
}

if ($("open-transaction-2")) {
  $("open-transaction-2").onclick =
    () => open("transaction-modal");
}

if ($("open-goal")) {
  $("open-goal").onclick =
    () => open("goal-modal");
}

if ($("bottom-add")) {
  $("bottom-add").onclick =
    () => open("transaction-modal");
}

document
  .querySelectorAll("[data-close]")
  .forEach(button => {
    button.onclick = () =>
      close(button.dataset.close);
  });

/* =========================
   NOVO LANÇAMENTO
========================= */

$("transaction-form").onsubmit =
  async e => {
    e.preventDefault();

    const result = await sb
      .from("transactions")
      .insert({
        user_id: user.id,
        type:
          document.querySelector(
            "[name=type]:checked"
          ).value,
        amount:
          +$("tx-amount").value,
        category:
          $("tx-category").value,
        description:
          $("tx-description")
            .value
            .trim(),
        date:
          $("tx-date").value,
        payment_method:
          $("tx-payment").value
      });

    if (result.error) {
      return msg(
        $("tx-message"),
        result.error.message
      );
    }

    e.target.reset();

    $("tx-date").value =
      new Date()
        .toISOString()
        .slice(0, 10);

    close("transaction-modal");

    await load();
  };

/* =========================
   NOVA META
========================= */

$("goal-form").onsubmit =
  async e => {
    e.preventDefault();

    const result = await sb
      .from("goals")
      .insert({
        user_id: user.id,
        name:
          $("goal-name")
            .value
            .trim(),
        target_amount:
          +$("goal-target").value,
        current_amount:
          +$("goal-current").value || 0
      });

    if (result.error) {
      return msg(
        $("goal-message"),
        result.error.message
      );
    }

    e.target.reset();

    close("goal-modal");

    await load();
  };

/* =========================
   SESSION
========================= */

sb.auth
  .getSession()
  .then(({ data }) => {
    if (data.session) {
      start(data.session.user);
    }
  });

/* =========================
   LISTENER DE AUTH
========================= */

sb.auth.onAuthStateChange(
  (event, session) => {
    if (
      event === "SIGNED_IN" &&
      session?.user &&
      !user
    ) {
      start(session.user);
    }
  }
);

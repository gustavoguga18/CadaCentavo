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

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));

function msg(el, text, ok = false) {
  if (!el) return;

  el.textContent = text;
  el.style.color = ok ? "#12b76a" : "#f04438";
}

function open(id) {
  $(id)?.classList.remove("hidden");
}

function close(id) {
  $(id)?.classList.add("hidden");
}

function page(pageName) {
  document
    .querySelectorAll(".page")
    .forEach(element => element.classList.add("hidden"));

  $(`${pageName}-page`)?.classList.remove("hidden");

  document
    .querySelectorAll(".nav")
    .forEach(element => {
      element.classList.toggle(
        "active",
        element.dataset.page === pageName
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   MESES
========================= */

function initMonths() {
  const select = $("month-filter");

  if (!select) return;

  select.innerHTML = "";

  const now = new Date();

  for (let i = 0; i < 13; i++) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    const value = date.toISOString().slice(0, 7);

    const label = date.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });

    select.innerHTML += `
      <option value="${value}">
        ${label.charAt(0).toUpperCase() + label.slice(1)}
      </option>
    `;
  }

  select.value = selectedMonth;
}


/* =========================
   CATEGORIAS
========================= */

function fillCats() {
  const select = $("tx-category");

  if (!select) return;

  select.innerHTML = cats
    .map(category => `<option>${category}</option>`)
    .join("");
}


/* =========================
   CARREGAR DADOS
========================= */

async function load() {
  const [transactionsResult, goalsResult] =
    await Promise.all([

      sb
        .from("transactions")
        .select("*")
        .order("date", {
          ascending: false
        })
        .order("created_at", {
          ascending: false
        }),

      sb
        .from("goals")
        .select("*")
        .order("created_at", {
          ascending: false
        })

    ]);

  if (transactionsResult.error)
    throw transactionsResult.error;

  if (goalsResult.error)
    throw goalsResult.error;

  tx = transactionsResult.data || [];
  goals = goalsResult.data || [];

  render();
}


/* =========================
   DASHBOARD
========================= */

function render() {
  const monthTransactions = tx.filter(
    transaction =>
      String(transaction.date).slice(0, 7) === selectedMonth
  );

  const income = monthTransactions
    .filter(transaction => transaction.type === "income")
    .reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount),
      0
    );

  const expense = monthTransactions
    .filter(transaction => transaction.type === "expense")
    .reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount),
      0
    );

  const balance = income - expense;

  if ($("balance"))
    $("balance").textContent = money(balance);

  if ($("income"))
    $("income").textContent = money(income);

  if ($("expense"))
    $("expense").textContent = money(expense);

  if ($("transaction-count"))
    $("transaction-count").textContent =
      monthTransactions.length;

  if ($("balance-status")) {
    $("balance-status").textContent =
      balance >= 0
        ? "Saldo positivo neste mês"
        : "Atenção: despesas acima das entradas";
  }

  renderCategories(monthTransactions);
  renderRecent(monthTransactions);
  renderTable();
  renderGoals();
}


/* =========================
   CATEGORIAS
========================= */

function renderCategories(monthTransactions) {
  const map = {};

  monthTransactions
    .filter(transaction => transaction.type === "expense")
    .forEach(transaction => {
      map[transaction.category] =
        (map[transaction.category] || 0) +
        Number(transaction.amount);
    });

  const entries = Object.entries(map)
    .sort((a, b) => b[1] - a[1]);

  const max = Math.max(
    ...entries.map(item => item[1]),
    1
  );

  if (!$("category-list")) return;

  $("category-list").innerHTML = entries.length

    ? entries
        .map(([category, value]) => `
          <div class="cat-row">

            <span>
              ${esc(category)}
            </span>

            <div class="bar">
              <i style="width:${value / max * 100}%"></i>
            </div>

            <strong>
              ${money(value)}
            </strong>

          </div>
        `)
        .join("")

    : `
      <p class="muted">
        Nenhuma despesa neste mês.
      </p>
    `;
}


/* =========================
   RECENTES
========================= */

function renderRecent(monthTransactions) {
  const recent = monthTransactions.slice(0, 5);

  if (!$("recent-list")) return;

  $("recent-list").innerHTML = recent.length
    ? recent.map(row).join("")
    : `
      <p class="muted">
        Nenhum lançamento neste mês.
      </p>
    `;
}


/* =========================
   LINHA DE LANÇAMENTO
========================= */

function row(transaction) {
  return `
    <div class="tx-row">

      <div>

        <div class="tx-title">
          ${esc(transaction.description)}
        </div>

        <div class="tx-meta">
          ${esc(transaction.category)}
          · ${dateBR(transaction.date)}
          · ${esc(transaction.payment_method || "—")}
        </div>

      </div>

      <strong class="${transaction.type}">
        ${transaction.type === "income" ? "+" : "−"}
        ${money(transaction.amount)}
      </strong>

    </div>
  `;
}


/* =========================
   TABELA
========================= */

function renderTable() {
  if (!$("transactions-table")) return;

  const search =
    ($("search")?.value || "").toLowerCase();

  const type =
    $("type-filter")?.value || "";

  const filtered = tx.filter(transaction => {

    const month =
      String(transaction.date).slice(0, 7) ===
      selectedMonth;

    const matchesType =
      !type || transaction.type === type;

    const text =
      `${transaction.description} ${transaction.category}`
        .toLowerCase();

    const matchesSearch =
      text.includes(search);

    return (
      month &&
      matchesType &&
      matchesSearch
    );
  });

  $("transactions-table").innerHTML =
    filtered.length

      ? filtered
          .map(transaction => `
            <tr>

              <td>
                ${dateBR(transaction.date)}
              </td>

              <td>
                <b>
                  ${esc(transaction.description)}
                </b>
              </td>

              <td>
                <span class="pill ${transaction.type}">
                  ${esc(transaction.category)}
                </span>
              </td>

              <td>
                ${esc(
                  transaction.payment_method || "—"
                )}
              </td>

              <td class="${transaction.type}">
                <b>
                  ${
                    transaction.type === "income"
                      ? "+"
                      : "−"
                  }
                  ${money(transaction.amount)}
                </b>
              </td>

              <td>
                <button
                  class="delete"
                  data-id="${transaction.id}">
                  Excluir
                </button>
              </td>

            </tr>
          `)
          .join("")

      : `
        <tr>
          <td
            colspan="6"
            style="
              text-align:center;
              color:#98a2b3;
              padding:35px;
            "
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
   EXCLUIR LANÇAMENTO
========================= */

async function del(id) {
  if (!confirm("Excluir este lançamento?"))
    return;

  const result = await sb
    .from("transactions")
    .delete()
    .eq("id", id);

  if (result.error) {
    alert(result.error.message);
    return;
  }

  await load();
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
    .map(goal => {

      const target =
        Number(goal.target_amount);

      const current =
        Number(goal.current_amount);

      const percentage =
        target > 0
          ? Math.min(
              current / target * 100,
              100
            )
          : 0;

      const remaining =
        Math.max(
          target - current,
          0
        );

      const completed =
        current >= target;

      return `
        <article class="goal">

          <div class="goal-header">

            <div>
              <h3>
                ${esc(goal.name)}
              </h3>

              ${
                completed
                  ? `
                    <span class="goal-complete">
                      Meta concluída 🎉
                    </span>
                  `
                  : ""
              }

            </div>

            <button
              class="goal-add-button"
              data-add-goal="${goal.id}"
            >
              + Adicionar dinheiro
            </button>

          </div>

          <div class="goal-values">

            <span>
              ${money(current)}
            </span>

            <span>
              ${money(target)}
            </span>

          </div>

          <div class="progress">

            <i
              style="width:${percentage}%">
            </i>

          </div>

          <div class="goal-values">

            <span>
              ${percentage.toFixed(0)}% concluído
            </span>

            <span>
              ${
                remaining > 0
                  ? `faltam ${money(remaining)}`
                  : "Objetivo alcançado"
              }
            </span>

          </div>

        </article>
      `;
    })
    .join("");

  document
    .querySelectorAll("[data-add-goal]")
    .forEach(button => {

      button.onclick = () =>
        openAddGoalModal(
          button.dataset.addGoal
        );

    });
}


/* =========================
   ABRIR MODAL DE ADICIONAR
========================= */

function openAddGoalModal(goalId) {

  const goal =
    goals.find(item => item.id === goalId);

  if (!goal) return;

  selectedGoal = goal;

  const target =
    Number(goal.target_amount);

  const current =
    Number(goal.current_amount);

  const remaining =
    Math.max(target - current, 0);

  if ($("add-goal-name"))
    $("add-goal-name").textContent =
      goal.name;

  if ($("add-goal-current"))
    $("add-goal-current").textContent =
      money(current);

  if ($("add-goal-target"))
    $("add-goal-target").textContent =
      money(target);

  if ($("add-goal-remaining"))
    $("add-goal-remaining").textContent =
      money(remaining);

  if ($("goal-add-amount"))
    $("goal-add-amount").value = "";

  if ($("goal-add-message"))
    $("goal-add-message").textContent = "";

  open("add-goal-modal");

  setTimeout(() => {
    $("goal-add-amount")?.focus();
  }, 100);
}


/* =========================
   ADICIONAR DINHEIRO À META
========================= */

$("add-goal-form")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!selectedGoal)
      return;

    const amount =
      Number(
        $("goal-add-amount").value
      );

    if (!amount || amount <= 0) {

      msg(
        $("goal-add-message"),
        "Digite um valor válido."
      );

      return;
    }

    const current =
      Number(selectedGoal.current_amount);

    const target =
      Number(selectedGoal.target_amount);

    const newAmount =
      current + amount;

    if (newAmount > target) {

      msg(
        $("goal-add-message"),
        `Esse valor ultrapassa a meta. Você pode adicionar no máximo ${money(
          target - current
        )}.`
      );

      return;
    }

    const result = await sb
      .from("goals")
      .update({
        current_amount: newAmount
      })
      .eq("id", selectedGoal.id)
      .eq("user_id", user.id);

    if (result.error) {

      msg(
        $("goal-add-message"),
        result.error.message
      );

      return;
    }

    close("add-goal-modal");

    selectedGoal = null;

    await load();
  }
);


/* =========================
   CRIAR META
========================= */

$("goal-form")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const name =
      $("goal-name").value.trim();

    const target =
      Number($("goal-target").value);

    const current =
      Number($("goal-current").value) || 0;

    if (!name || target <= 0) {

      msg(
        $("goal-message"),
        "Preencha os dados da meta."
      );

      return;
    }

    if (current > target) {

      msg(
        $("goal-message"),
        "O valor inicial não pode ser maior que a meta."
      );

      return;
    }

    const result = await sb
      .from("goals")
      .insert({

        user_id: user.id,

        name,

        target_amount: target,

        current_amount: current

      });

    if (result.error) {

      msg(
        $("goal-message"),
        result.error.message
      );

      return;
    }

    event.target.reset();

    close("goal-modal");

    await load();
  }
);


/* =========================
   LOGIN / CADASTRO
========================= */

$("auth-form")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const signup =
      $("auth-title").dataset.signup === "1";

    const email =
      $("email").value;

    const password =
      $("password").value;

    let result;

    if (signup) {

      result = await sb.auth.signUp({

        email,

        password,

        options: {

          emailRedirectTo:
            window.location.origin +
            window.location.pathname

        }

      });

    } else {

      result =
        await sb.auth.signInWithPassword({

          email,

          password

        });

    }

    if (result.error) {

      msg(
        $("auth-message"),
        result.error.message
      );

      return;
    }

    if (
      signup &&
      !result.data.session
    ) {

      msg(
        $("auth-message"),
        "Conta criada. Verifique seu e-mail para confirmar.",
        true
      );

      return;
    }

    start(result.data.user);
  }
);


/* =========================
   ALTERNAR LOGIN / CADASTRO
========================= */

$("toggle-auth")?.addEventListener(
  "click",
  () => {

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
  }
);


/* =========================
   INICIAR SISTEMA
========================= */

async function start(currentUser) {

  user = currentUser;

  $("auth-screen").classList.add("hidden");

  $("app-screen").classList.remove("hidden");

  const name =
    currentUser.email.split("@")[0];

  $("hello-name").textContent = name;

  $("user-name").textContent = name;

  $("user-email").textContent =
    currentUser.email;

  $("avatar").textContent =
    name[0].toUpperCase();

  initMonths();

  fillCats();

  if ($("tx-date")) {
    $("tx-date").value =
      new Date()
        .toISOString()
        .slice(0, 10);
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

$("logout-btn")?.addEventListener(
  "click",
  async () => {

    await sb.auth.signOut();

    location.reload();

  }
);


/* =========================
   FILTROS
========================= */

$("month-filter")?.addEventListener(
  "change",
  event => {

    selectedMonth =
      event.target.value;

    render();

  }
);

$("search")?.addEventListener(
  "input",
  renderTable
);

$("type-filter")?.addEventListener(
  "change",
  renderTable
);


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

$("open-transaction")?.addEventListener(
  "click",
  () => open("transaction-modal")
);

$("open-transaction-quick")?.addEventListener(
  "click",
  () => open("transaction-modal")
);

$("open-transaction-2")?.addEventListener(
  "click",
  () => open("transaction-modal")
);

$("open-goal")?.addEventListener(
  "click",
  () => open("goal-modal")
);

$("bottom-add")?.addEventListener(
  "click",
  () => open("transaction-modal")
);

document
  .querySelectorAll("[data-close]")
  .forEach(button => {

    button.onclick = () =>
      close(button.dataset.close);

  });


/* =========================
   NOVO LANÇAMENTO
========================= */

$("transaction-form")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const result = await sb
      .from("transactions")
      .insert({

        user_id: user.id,

        type:
          document.querySelector(
            "[name=type]:checked"
          ).value,

        amount:
          Number(
            $("tx-amount").value
          ),

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

      msg(
        $("tx-message"),
        result.error.message
      );

      return;
    }

    event.target.reset();

    $("tx-date").value =
      new Date()
        .toISOString()
        .slice(0, 10);

    close("transaction-modal");

    await load();
  }
);


/* =========================
   FECHAR MODAL CLICANDO FORA
========================= */

document
  .querySelectorAll(".modal")
  .forEach(modal => {

    modal.addEventListener(
      "click",
      event => {

        if (event.target === modal) {
          modal.classList.add("hidden");
        }

      }
    );

  });


/* =========================
   SESSÃO
========================= */

sb.auth
  .getSession()
  .then(({ data }) => {

    if (data.session) {
      start(data.session.user);
    }

  });

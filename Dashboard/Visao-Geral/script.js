document.addEventListener("DOMContentLoaded", iniciarDashboard);
async function iniciarDashboard() {
  const formulario = document.getElementById("login-form");
  const conteudo = document.getElementById("conteudo-dashboard");
  const mensagemErro = document.getElementById("login-erro");

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session) {
    formulario.hidden = true;
    conteudo.hidden = false;
    await carregarDashboard();
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemErro.textContent = "";

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      mensagemErro.textContent = "E-mail ou senha incorretos.";
      console.error("Erro ao entrar:", error.message);
      return;
    }

    formulario.hidden = true;
    conteudo.hidden = false;
    await carregarDashboard();
  });
}

async function carregarDashboard() {
  const { data: marcacoes, error } = await supabaseClient
    .from("marcacoes")
    .select("*")
    .limit(1000);

  if (error) {
    console.error("Erro ao carregar marcações:", error);
    return;
  }

  console.log("Marcações recebidas:", marcacoes);

  atualizarCartoes(marcacoes);
  criarGraficos(marcacoes);
  mostrarProximasMarcacoes(marcacoes);
}

function nozmalizar(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function obterServicos(marcacao) {
  const servicos = marcacao["serviços"] ?? marcacao.servicos;

  if (Array.isArray(servicos)) return servicos;
  if (typeof servicos === "string") return [servicos];
  return [];
}

function obterData(marcacao) {
  return marcacao["dia-marcado"] ?? marcacao.data_servico;
}

function obterHora(marcacao) {
  return marcacao["hora-marcada"] ?? marcacao.hora_servico;
}

function obterNome(marcacao) {
  return marcacao["nome-cliente"] ?? marcacao.nome ?? "Cliente sem nome";
}

function obterTelefone(marcacao) {
  return marcacao.telefone ?? "Sem telefone";
}

function dataLocalISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function inicioDaSemana(data) {
  const inicio =
    typeof data === "string" ? new Date(`${data}T12:00:00`) : new Date(data);

  inicio.setHours(0, 0, 0, 0);

  const dia = inicio.getDay();
  const diasDesdeDomingo = inicio.getDay();

  inicio.setDate(inicio.getDate() - diasDesdeDomingo);
  return inicio;
}

function atualizarCartoes(marcacoes) {
  const hojeISO = dataLocalISO(new Date());
  const segunda = inicioDaSemana(hojeISO);
  const segundaISO = dataLocalISO(segunda);

  const proximaSegunda = new Date(segunda);
  proximaSegunda.setDate(proximaSegunda.getDate() + 7);
  const proximaSegundaISO = dataLocalISO(proximaSegunda);

  const ativas = marcacoes.filter(
    (marcacao) => normalizar(marcacao.status) !== "cancelada",
  );

  const totalHoje = ativas.filter(
    (marcacao) => obterData(marcacao) === hojeISO,
  ).length;

  const totalSemana = ativas.filter((marcacao) => {
    const data = obterData(marcacao);
    return data >= segundaISO && data < proximaSegundaISO;
  }).length;

  const precos = {
    "lavagem completa": 30,
    "lavegam completa": 30,
    "revitalizacao de farois": 50,
    farois: 50,
    polimento: 100,
    estofe: 80,
  };

  const receita = ativas.reduce((total, marcacao) => {
    const subtotal = obterServicos(marcacao).reduce((soma, servico) => {
      return soma + (precos[normalizar(servico)] || 0);
    }, 0);

    return total + subtotal;
  }, 0);

  const concluidos = marcacoes.filter((marcacao) =>
    ["concluida", "concluido"].includes(normalizar(marcacao.status)),
  ).length;

  document.getElementById("total-hoje").textContent = totalHoje;
  document.getElementById("total-semana").textContent = totalSemana;
  document.getElementById("total-receita").textContent =
    `${receita.toFixed(2)} €`;
  document.getElementById("total-concluidos").textContent = concluidos;
}

function criarGraficos(marcacoes) {
  const segunda = inicioDaSemana(new Date());
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const contagemDias = Array(7).fill(0);
  const contagemServicos = {};

  marcacoes.forEach((marcacao) => {
    if (normalizar(marcacao.status) === "cancelada") return;

    const dataServico = obterData(marcacao);
    if (!dataServico) return;

    const data = new Date(`${dataServico}T12:00:00`);
    const indiceDia = Math.round((data - segunda) / 86400000);

    if (indiceDia >= 0 && indiceDia < 7) {
      contagemDias[indiceDia]++;
    }

    obterServicos(marcacao).forEach((servico) => {
      contagemServicos[servico] = (contagemServicos[servico] || 0) + 1;
    });
  });

  new Chart(document.getElementById("grafico-marcacoes"), {
    type: "bar",
    data: {
      labels: dias,
      datasets: [
        {
          label: "Marcações",
          data: contagemDias,
          backgroundColor: "#cc0000",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    },
  });

  new Chart(document.getElementById("grafico-servicos"), {
    type: "doughnut",
    data: {
      labels: Object.keys(contagemServicos),
      datasets: [
        {
          data: Object.values(contagemServicos),
          backgroundColor: ["#cc0000", "#555", "#999", "#e08a8a"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function mostrarProximasMarcacoes(marcacoes) {
  const lista = document.getElementById("lista-proximas");

  if (!lista) {
    console.error('Não encontrei o elemento com id="lista-proximas".');
    return;
  }

  const hojeISO = dataLocalISO(new Date());

  const proximas = marcacoes
    .filter((marcacao) => {
      const data = obterData(marcacao);
      const status = normalizar(marcacao.status);

      return (
        data >= hojeISO &&
        !["cancelada", "concluida", "concluido"].includes(status)
      );
    })
    .sort((a, b) => {
      const dataHoraA = `${obterData(a)} ${obterHora(a)}`;
      const dataHoraB = `${obterData(b)} ${obterHora(b)}`;

      return dataHoraA.localeCompare(dataHoraB);
    })
    .slice(0, 5);

  if (proximas.length === 0) {
    lista.textContent = "Não há próximas marcações.";
    return;
  }
  const icones = {
    cliente: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);transform: ;msFilter:;"><path d="M7.5 6.5C7.5 8.981 9.519 11 12 11s4.5-2.019 4.5-4.5S14.481 2 12 2 7.5 4.019 7.5 6.5zM20 21h1v-1c0-3.859-3.141-7-7-7h-4c-3.86 0-7 3.141-7 7v1h17z"></path></svg>`,

    telefone: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);transform: ;msFilter:;"><path d="m20.487 17.14-4.065-3.696a1.001 1.001 0 0 0-1.391.043l-2.393 2.461c-.576-.11-1.734-.471-2.926-1.66-1.192-1.193-1.553-2.354-1.66-2.926l2.459-2.394a1 1 0 0 0 .043-1.391L6.859 3.513a1 1 0 0 0-1.391-.087l-2.17 1.861a1 1 0 0 0-.29.649c-.015.25-.301 6.172 4.291 10.766C11.305 20.707 16.323 21 17.705 21c.202 0 .326-.006.359-.008a.992.992 0 0 0 .648-.291l1.86-2.171a.997.997 0 0 0-.085-1.39z"></path></svg>`,

    servico: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);transform: ;msFilter:;"><path d="m20.772 10.155-1.368-4.104A2.995 2.995 0 0 0 16.559 4H7.441a2.995 2.995 0 0 0-2.845 2.051l-1.368 4.104A2 2 0 0 0 2 12v5c0 .738.404 1.376 1 1.723V21a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2h12v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2.277A1.99 1.99 0 0 0 22 17v-5a2 2 0 0 0-1.228-1.845zM7.441 6h9.117c.431 0 .813.274.949.684L18.613 10H5.387l1.105-3.316A1 1 0 0 1 7.441 6zM5.5 16a1.5 1.5 0 1 1 .001-3.001A1.5 1.5 0 0 1 5.5 16zm13 0a1.5 1.5 0 1 1 .001-3.001A1.5 1.5 0 0 1 18.5 16z"></path></svg>`,

    data: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);transform: ;msFilter:;"><path d="M7 11h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z"></path><path d="M5 22h14c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2h-2V2h-2v2H9V2H7v2H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2zM19 8l.001 12H5V8h14z"></path></svg>`,

    hora: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);transform: ;msFilter:;"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path><path d="M13 7h-2v6h6v-2h-4z"></path></svg>`,
  };

  const tabela = document.createElement("table");
  tabela.className = "tabela-marcacoes";

  const cabecalho = document.createElement("thead");
  cabecalho.innerHTML = `
    <tr> 
      
      <th>Cliente</th>
      <th>Telefone</th>
      <th>Serviço</th>
      <th>Data</th>
      <th>Hora</th>
      <th>Estado</th>
      
      
    </tr>
  `;

  const corpo = document.createElement("tbody");

  proximas.forEach((marcacao) => {
    const linha = document.createElement("tr");

    const nome = obterNome(marcacao);
    const telefone = obterTelefone(marcacao);
    const servicos = obterServicos(marcacao).join(", ");
    const dataOriginal = obterData(marcacao);
    const hora = obterHora(marcacao) || "—";

    const dataFormatada = dataOriginal
      ? new Date(`${dataOriginal}T12:00:00`).toLocaleDateString("pt-PT")
      : "—";

    const campos = [
      { icone: icones.cliente, valor: nome },
      { icone: icones.telefone, valor: telefone },
      { icone: icones.servico, valor: servicos || "—" },
      { icone: icones.data, valor: dataFormatada },
      { icone: icones.hora, valor: String(hora).slice(0, 5) },
    ];

    campos.forEach(({ icone, valor }) => {
      const celula = document.createElement("td");
      const conteudo = document.createElement("span");
      const texto = document.createElement("span");
      const modelo = document.createElement("template");
      const estadoOriginal = String(marcacao.status || "Pendente");
      const estadoNormalizado = normalizar(estadoOriginal);
      conteudo.className = "dado-com-icone";
      texto.textContent = valor;
      modelo.innerHTML = icone;

      const svg = modelo.content.firstElementChild;
      svg.classList.add("icone-info");
      svg.setAttribute("aria-hidden", "true");

      conteudo.append(svg, texto);
      celula.appendChild(conteudo);
      linha.appendChild(celula);
    });

    const estadoOriginal = String(marcacao.status || "Pendente");
    const estadoNormalizado = normalizar(estadoOriginal);

    let classeEstado = "Pendente";

    if (estadoNormalizado.includes("conclu")) {
      classeEstado = "Concluido";
    } else if (estadoNormalizado.includes("cancel")) {
      classeEstado = "Cancelado";
    }

    const celulaEstado = document.createElement("td");
    const grupoEstado = document.createElement("span");
    const etiquetaEstado = document.createElement("span");
    const botaoConcluir = document.createElement("button");

    etiquetaEstado.className = `estado estado-${classeEstado}`;
    etiquetaEstado.textContent = estadoOriginal;

    botaoConcluir.type = "button";
    botaoConcluir.className = "btn-concluir";
    botaoConcluir.setAttribute("aria-label", "Concluir serviço");
    botaoConcluir.title = "Concluir serviço";
    botaoConcluir.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="m9 16.17-3.88-3.88L3.71 13.7 9 19l12-12-1.41-1.41z"/>
  </svg>
`;

    botaoConcluir.addEventListener("click", async () => {
      botaoConcluir.disabled = true;

      const { error } = await supabaseClient
        .from("marcacoes")
        .update({ status: "concluido" })
        .eq("id", marcacao.id);

      if (error) {
        console.error("Erro ao concluir o serviço:", error);
        alert("Não foi possível atualizar o estado.");
        botaoConcluir.disabled = false;
        return;
      }

      window.location.reload();
    });

    grupoEstado.className = "estado-acoes";
    grupoEstado.append(etiquetaEstado, botaoConcluir);

    celulaEstado.appendChild(grupoEstado);
    linha.appendChild(celulaEstado);

    corpo.appendChild(linha);
  });

  tabela.append(cabecalho, corpo);
  lista.replaceChildren(tabela);
}

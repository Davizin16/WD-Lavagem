document.addEventListener("DOMContentLoaded", async function () {
  const { data, error } = await supabaseClient.from("servicos").select("*");

  if (error) {
    console.error("Erro ao consultar os serviços:", error);
  } else {
    console.log("Serviços recebidos do Supabase:", data);
  }
  const lavagem = document.getElementById("btn-lavagem");
  const farol = document.getElementById("btn-farol");
  const polimento = document.getElementById("btn-polimento");
  const estofe = document.getElementById("btn-estofe");
  const btRemoveServico = document.querySelectorAll(".remove-serv");

  // aparecere resumo da lavagem
  lavagem.addEventListener("click", function () {
    const resumoMarcLavagem = document.getElementById("resumo-lavagem");
    resumoMarcLavagem.classList.add("resumo-lavagem");
    resumoMarcLavagem.style.display = "flex";
  });

  // aparecer resumo do farol
  farol.addEventListener("click", function () {
    const resumoMarcFarol = document.getElementById("resumo-farol");
    resumoMarcFarol.classList.add("resumo-farol");
    resumoMarcFarol.style.display = "flex";
  });

  // aparecer resumo polimento
  polimento.addEventListener("click", function () {
    const resumoMarcPolimento = document.getElementById("resumo-polimento");
    resumoMarcPolimento.classList.add("resumo-polimento");
    resumoMarcPolimento.style.display = "flex";
  });

  // aparecer resumo estofe

  estofe.addEventListener("click", function () {
    const resumoMarcEstofe = document.getElementById("resumo-estofe");
    resumoMarcEstofe.classList.add("resumo-estofe");
    resumoMarcEstofe.style.display = "flex";
  });

  //remover serviço
  btRemoveServico.forEach(function (botao) {
    botao.addEventListener("click", function () {
      const resumo = botao.closest(
        "#resumo-lavagem, #resumo-farol, #resumo-polimento, #resumo-estofe",
      );

      if (resumo) {
        resumo.style.display = "none";
      }
    });
  });

  // mostrar a data escolhida
  const campoData = document.getElementById("data");
  const textoData = document.querySelector("#dt-confirm p");
  campoData.addEventListener("change", async function () {
    if (!campoData.value) return;
    const [ano, mes, dia] = campoData.value.split("-");
    textoData.textContent = `Data ${dia}/${mes}/${ano}`;
    await atualizarHorariosDisponiveis();
  });
  // mostrar a hora

  const botoesHora = document.querySelectorAll(".horarios button");
  const textoHora = document.querySelector("#hr-confirm p");

  // CONSULTAR HORÁRIOS OCUPADOS
  async function atualizarHorariosDisponiveis() {
    const diaSelecionado = campoData.value;
    console.log("Data Selecionada:", diaSelecionado);
    if (!diaSelecionado) return;

    const { data, error } = await supabaseClient.rpc("horarios_ocupados", {
      data_escolhida: diaSelecionado,
    });

    console.log("marcaç~pes encontradas:", data);
    console.log("Erro:", error);
    if (error) {
      console.error("Erro ao consultar horários:", error);
      return;
    }

    const horariosOcupados = data.map(function (marcacao) {
      return marcacao.hora.slice(0, 5);
    });

    botoesHora.forEach(function (botao) {
      const horaBotao = botao.textContent.trim();

      if (horariosOcupados.includes(horaBotao)) {
        botao.disabled = true;
        botao.classList.add("horario-ocupado");

        if (botao.classList.contains("hora-selecionada")) {
          botao.classList.remove("hora-selecionada");
          textoHora.textContent = "Hora:";
        }
      } else {
        botao.disabled = false;
        botao.classList.remove("horario-ocupado");
      }
    });
  }

  botoesHora.forEach(function (botao) {
    botao.type = "button";
    botao.addEventListener("click", function () {
      textoHora.textContent = `Hora: ${botao.textContent.trim()}`;
      botoesHora.forEach(function (outroBotao) {
        outroBotao.classList.remove("hora-selecionada");
      });
      botao.classList.add("hora-selecionada");
    });
  });

  // enviar dados
  const form = document.getElementById("form-marcacao");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const dia = campoData.value;

    const hora = document
      .querySelector(".hora-selecionada")
      ?.textContent.trim();

    // RECOLHER SERVIÇOS SELECIONADOS
    const servicosSelecionados = [
      ["resumo-lavagem", "Lavagem Completa"],
      ["resumo-farol", "Faróis"],
      ["resumo-polimento", "Polimento"],
      ["resumo-estofe", "Estofos"],
    ];

    const servicos = [];

    servicosSelecionados.forEach(function ([id, nomeServico]) {
      const elemento = document.getElementById(id);

      if (elemento && elemento.style.display === "flex") {
        servicos.push(nomeServico);
      }
    });

    // VALIDAR CAMPOS
    if (!nome || !telefone || !dia || !hora || servicos.length === 0) {
      alert("Preencha todos os campos e escolha pelo menos um serviço.");
      return;
    }

    // PREPARAR DADOS
    const dadosMarcacao = {
      nome_cliente: nome,
      telefone: telefone,
      "dia-marcado": dia,
      "hora-marcada": hora.replace("Hora:", "").trim(),
      serviços: servicos.join(", "),
    };

    console.log("Dados a enviar:", dadosMarcacao);

    // GUARDAR NO SUPABASE
    const { error } = await supabaseClient
      .from("agendamentos")
      .insert([dadosMarcacao]);

    if (error) {
      console.error("Erro ao guardar agendamento:", error);
      alert("Não foi possível realizar a marcação. Consulta a consola.");
      return;
    }

    alert("Marcação realizada com sucesso!");

    form.reset();

    // LIMPAR RESUMOS E HORA SELECIONADA
    servicosSelecionados.forEach(function ([id]) {
      document.getElementById(id).style.display = "none";
    });

    botoesHora.forEach(function (botao) {
      botao.classList.remove("hora-selecionada");
    });

    textoData.textContent = "Data:";
    textoHora.textContent = "Hora:";
  });
});

export type Question = {
  id: number;
  disciplina: string;
  assunto: string;
  banca: string;
  orgao: string;
  ano: number;
  enunciado: string;
  alternativas: string[];
  correta: number;
  comentario: string;
};

export const questions: Question[] = [
  { id: 1, disciplina: "Português", assunto: "Crase", banca: "CESPE/CEBRASPE", orgao: "TRF 1ª Região", ano: 2024,
    enunciado: "Assinale a alternativa em que o emprego do acento indicativo de crase está correto.",
    alternativas: ["Fui à pé até o trabalho.", "Entreguei o relatório à diretora.", "Começou à chover forte.", "Refiro-me à pessoas específicas.", "Ficamos frente à frente."],
    correta: 1, comentario: "Há crase em 'à diretora': o verbo entregar exige a preposição 'a' e 'diretora' admite o artigo feminino 'a'." },
  { id: 2, disciplina: "Direito Constitucional", assunto: "Direitos Fundamentais", banca: "FGV", orgao: "TJ-SP", ano: 2023,
    enunciado: "Segundo a Constituição Federal de 1988, a casa é asilo inviolável do indivíduo. É permitido nela penetrar sem consentimento do morador:",
    alternativas: ["Apenas durante o dia, em qualquer hipótese.", "Em caso de flagrante delito, a qualquer hora.", "Somente com ordem do delegado.", "Nunca, sem exceções.", "Apenas à noite, com ordem judicial."],
    correta: 1, comentario: "Art. 5º, XI: flagrante delito, desastre ou prestar socorro a qualquer hora; por determinação judicial, apenas durante o dia." },
  { id: 3, disciplina: "Raciocínio Lógico", assunto: "Proposições", banca: "VUNESP", orgao: "PM-SP", ano: 2024,
    enunciado: "A negação da proposição 'Todo policial é atento' é:",
    alternativas: ["Nenhum policial é atento.", "Algum policial não é atento.", "Todo policial é desatento.", "Algum policial é atento.", "Nenhum atento é policial."],
    correta: 1, comentario: "A negação de 'Todo A é B' é 'Algum A não é B'." },
  { id: 4, disciplina: "Direito Administrativo", assunto: "Atos Administrativos", banca: "CESPE/CEBRASPE", orgao: "INSS", ano: 2022,
    enunciado: "O atributo do ato administrativo que permite à Administração executá-lo diretamente, sem necessidade de recorrer ao Judiciário, denomina-se:",
    alternativas: ["Presunção de legitimidade", "Tipicidade", "Autoexecutoriedade", "Imperatividade", "Motivação"],
    correta: 2, comentario: "Autoexecutoriedade é a possibilidade de a Administração executar seus atos por meios próprios." },
  { id: 5, disciplina: "Informática", assunto: "Segurança da Informação", banca: "FCC", orgao: "Banco do Brasil", ano: 2023,
    enunciado: "O tipo de malware que sequestra dados criptografando-os e exige pagamento para liberá-los é o:",
    alternativas: ["Spyware", "Worm", "Ransomware", "Adware", "Keylogger"],
    correta: 2, comentario: "Ransomware criptografa os dados da vítima e exige resgate." },
  { id: 6, disciplina: "Português", assunto: "Concordância Verbal", banca: "FGV", orgao: "Senado Federal", ano: 2022,
    enunciado: "Assinale a frase com concordância verbal correta.",
    alternativas: ["Fazem dois anos que não o vejo.", "Haviam muitos candidatos na sala.", "Existem muitas dúvidas sobre o edital.", "Precisa-se de vendedores e aluga-se casas.", "Houveram problemas na prova."],
    correta: 2, comentario: "'Existir' é pessoal e concorda com o sujeito 'muitas dúvidas'. 'Fazer' (tempo) e 'haver' (existir) são impessoais." },
  { id: 7, disciplina: "Direito Constitucional", assunto: "Organização do Estado", banca: "VUNESP", orgao: "Câmara de SP", ano: 2024,
    enunciado: "Compete privativamente à União legislar sobre:",
    alternativas: ["Direito tributário", "Direito penal", "Educação e cultura", "Proteção ao meio ambiente", "Orçamento"],
    correta: 1, comentario: "Art. 22, I: direito civil, comercial, penal, processual etc. são competência privativa da União. Os demais são concorrentes (art. 24)." },
  { id: 8, disciplina: "Raciocínio Lógico", assunto: "Sequências", banca: "FCC", orgao: "TRT 2ª Região", ano: 2023,
    enunciado: "Qual o próximo termo da sequência: 2, 6, 12, 20, 30, ...?",
    alternativas: ["40", "42", "44", "36", "38"],
    correta: 1, comentario: "As diferenças são 4, 6, 8, 10, 12. Logo, 30 + 12 = 42." },
];

export const unique = (k: keyof Question) =>
  Array.from(new Set(questions.map((q) => String(q[k])))).sort();

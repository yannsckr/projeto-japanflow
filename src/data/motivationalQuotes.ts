export interface MotivationalQuote {
  id: string;
  text: string;
  author: string;
  source?: string;
}

export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  {
    id: 'aurelius-present',
    text: 'Cada um de nós vive apenas agora, este breve instante.',
    author: 'Marco Aurélio',
    source: 'Meditações, III.10',
  },
  {
    id: 'aurelius-future',
    text: 'Nunca deixe o futuro perturbá-lo. Você o enfrentará, se precisar, com a mesma razão que hoje o arma contra o presente.',
    author: 'Marco Aurélio',
    source: 'Meditações, VII.8',
  },
  {
    id: 'seneca-courage',
    text: 'Às vezes, até viver é um ato de coragem.',
    author: 'Sêneca',
    source: 'Cartas a Lucílio, LXXVIII',
  },
  {
    id: 'seneca-live-now',
    text: 'Comece a viver de uma vez e considere cada dia como uma vida separada.',
    author: 'Sêneca',
    source: 'Cartas a Lucílio, CI',
  },
  {
    id: 'seneca-difficulty',
    text: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.',
    author: 'Sêneca',
    source: 'Cartas a Lucílio, CIV',
  },
  {
    id: 'epictetus-purpose',
    text: 'Primeiro diga a si mesmo o que você quer ser; depois faça o que precisa ser feito.',
    author: 'Epicteto',
    source: 'Discursos, III.23.1',
  },
  {
    id: 'epictetus-habit',
    text: 'Aquilo que você deseja tornar um hábito, pratique.',
    author: 'Epicteto',
    source: 'Discursos, II.18.4',
  },
  {
    id: 'epictetus-difficulties',
    text: 'São as dificuldades que mostram o que os homens são.',
    author: 'Epicteto',
    source: 'Discursos',
  },
  {
    id: 'franklin-resolution',
    text: 'Decida executar o que deve ser feito; execute sem falhar aquilo que decidiu.',
    author: 'Benjamin Franklin',
    source: 'Autobiografia — Resolução',
  },
  {
    id: 'franklin-industry',
    text: 'Não perca tempo. Esteja sempre ocupado em algo útil e elimine todas as ações desnecessárias.',
    author: 'Benjamin Franklin',
    source: 'Autobiografia — Indústria',
  },
  {
    id: 'edison-genius',
    text: 'Gênio é um por cento inspiração e noventa e nove por cento transpiração.',
    author: 'Thomas Edison',
    source: 'Harper’s Monthly, 1932',
  },
  {
    id: 'edison-hustle',
    text: 'Tudo chega àquele que se mantém em movimento enquanto espera.',
    author: 'Thomas Edison',
    source: 'Thomas Alva Edison: Sixty Years of an Inventor’s Life',
  },
  {
    id: 'thoreau-elevate',
    text: 'Poucos fatos são tão encorajadores quanto a capacidade humana de elevar a própria vida por esforço consciente.',
    author: 'Henry David Thoreau',
    source: 'Walden',
  },
  {
    id: 'virgil-labor',
    text: 'O trabalho persistente vence tudo.',
    author: 'Virgílio',
    source: 'Geórgicas, I.145',
  },
  {
    id: 'voltaire-work',
    text: 'O trabalho nos poupa de três grandes males: o tédio, o vício e a necessidade.',
    author: 'Voltaire',
    source: 'Cândido, cap. 30',
  },
  {
    id: 'haskins-within',
    text: 'O que ficou para trás e o que está diante de nós são pequenos diante do que existe dentro de nós.',
    author: 'Henry S. Haskins',
    source: 'Meditations in Wall Street',
  },
];

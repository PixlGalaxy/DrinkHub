export type Language = 'en' | 'es';

export type Bilingual = { en: string; es: string };

export function pick(value: string | Bilingual | undefined, lang: Language): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.en ?? '';
}

type Strings = Record<string, string>;

const en: Strings = {
  // Lobby
  'lobby.tagline': 'Draw cards, complete challenges, answer truths — or take a sip.',
  'lobby.subtitle': 'Start a new room or join an existing one',
  'lobby.create': 'Create a Room',
  'lobby.create.subtitle': 'Be the host',
  'lobby.join': 'Join a Room',
  'lobby.join.subtitle': 'Got a code?',
  'lobby.your_name': 'Your Name',
  'lobby.your_name.placeholder': 'Enter your name',
  'lobby.room_code': 'Room Code',
  'lobby.create_room_btn': 'Create Room',
  'lobby.join_room_btn': 'Join Room',
  'lobby.error.name_required': 'Enter your name to continue.',
  'lobby.error.code_length': 'Room code must be 6 characters.',
  'lobby.language': 'Language',
  'lobby.stats.challenges': 'Challenges',
  'lobby.stats.truths': 'Truths',
  'lobby.stats.rules': 'Rules',
  'lobby.stats.penalties': 'Penalties',

  // Common
  'common.back': 'Back',

  // Room code
  'room_code.label': 'Room Code',
  'room_code.copied': 'Copied to clipboard!',
  'room_code.tap_to_copy': 'Tap to copy',

  // Game flow
  'game.connecting': 'Connecting to room...',
  'game.loading': 'Loading...',
  'game.connection_lost': 'Connection lost.',
  'game.reconnecting': 'Reconnecting automatically...',
  'game.rejoin': 'Re-join',
  'game.back_to_lobby': 'Back to Lobby',
  'game.share_code': 'Share this code with your friends so they can join the game',
  'game.waiting_for_players': 'Waiting for players',
  'game.need_more_to_start': 'Need {count} more to start',
  'game.ready_to_start': 'Ready to start!',
  'game.players': 'Players',
  'game.start_game': 'Start Game',
  'game.waiting_for_more': 'Waiting for more players...',
  'game.delete_room': 'Delete Room',
  'game.waiting_for_host': 'Waiting for {host} to start',
  'game.your_turn': 'Your turn!',
  'game.current_turn': "{name}'s turn",
  'game.active_rules_count': '{count} active rules',
  'game.tap_to_draw': 'Tap the deck to draw your card',
  'game.tap_to_reveal': 'Tap the card to reveal it',
  'game.waiting_to_reveal': 'Waiting for {name} to reveal the card...',
  'game.next_turn': 'Next Turn',
  'game.waiting_for_player': 'Waiting for {name}...',
  'game.no_active_rules': 'No active rules',
  'game.rules_appear_here': 'Rules from cards appear here',
  'game.error.generic': 'Something went wrong.',

  // Players
  'player.you': '(you)',
  'player.turn': 'Turn',

  // Active rules block
  'rules.active': 'Active Rules',
  'rules.rounds_left': '{count}r left',

  // Cards
  'card.challenge': 'Challenge',
  'card.truth': 'Truth',
  'card.rule': 'Rule',
  'card.penalty': 'Penalty',
  'card.rounds': '{count} rounds',
  'card.tap_reveal': 'Tap to reveal',
  'card.tap_reveal_a11y': 'Card face down — tap to reveal',
  'card.skip_label': 'Or skip it: ',
  'card.draw': 'Draw Card',

  // Navbar
  'nav.room': 'Room',
  'nav.leave': 'Leave room',
  'nav.language': 'Language',
};

const es: Strings = {
  'lobby.tagline': 'Saca cartas, completa retos, responde verdades — o toma un sorbo.',
  'lobby.subtitle': 'Crea una nueva sala o únete a una existente',
  'lobby.create': 'Crear sala',
  'lobby.create.subtitle': 'Sé el anfitrión',
  'lobby.join': 'Unirse a sala',
  'lobby.join.subtitle': '¿Tienes un código?',
  'lobby.your_name': 'Tu nombre',
  'lobby.your_name.placeholder': 'Escribe tu nombre',
  'lobby.room_code': 'Código de sala',
  'lobby.create_room_btn': 'Crear sala',
  'lobby.join_room_btn': 'Unirse',
  'lobby.error.name_required': 'Escribe tu nombre para continuar.',
  'lobby.error.code_length': 'El código debe tener 6 caracteres.',
  'lobby.language': 'Idioma',
  'lobby.stats.challenges': 'Retos',
  'lobby.stats.truths': 'Verdades',
  'lobby.stats.rules': 'Reglas',
  'lobby.stats.penalties': 'Penalidades',

  'common.back': 'Atrás',

  'room_code.label': 'Código de sala',
  'room_code.copied': '¡Copiado al portapapeles!',
  'room_code.tap_to_copy': 'Toca para copiar',

  'game.connecting': 'Conectando a la sala...',
  'game.loading': 'Cargando...',
  'game.connection_lost': 'Conexión perdida.',
  'game.reconnecting': 'Reconectando automáticamente...',
  'game.rejoin': 'Reconectar',
  'game.back_to_lobby': 'Volver al lobby',
  'game.share_code': 'Comparte este código con tus amigos para que se unan al juego',
  'game.waiting_for_players': 'Esperando jugadores',
  'game.need_more_to_start': 'Faltan {count} para empezar',
  'game.ready_to_start': '¡Listos para empezar!',
  'game.players': 'Jugadores',
  'game.start_game': 'Empezar partida',
  'game.waiting_for_more': 'Esperando más jugadores...',
  'game.delete_room': 'Eliminar sala',
  'game.waiting_for_host': 'Esperando a que {host} empiece',
  'game.your_turn': '¡Tu turno!',
  'game.current_turn': 'Turno de {name}',
  'game.active_rules_count': '{count} reglas activas',
  'game.tap_to_draw': 'Toca el mazo para sacar tu carta',
  'game.tap_to_reveal': 'Toca la carta para revelarla',
  'game.waiting_to_reveal': 'Esperando a que {name} revele la carta...',
  'game.next_turn': 'Siguiente turno',
  'game.waiting_for_player': 'Esperando a {name}...',
  'game.no_active_rules': 'Sin reglas activas',
  'game.rules_appear_here': 'Las reglas de cartas aparecen aquí',
  'game.error.generic': 'Algo salió mal.',

  'player.you': '(tú)',
  'player.turn': 'Turno',

  'rules.active': 'Reglas activas',
  'rules.rounds_left': '{count}r restantes',

  'card.challenge': 'Reto',
  'card.truth': 'Verdad',
  'card.rule': 'Regla',
  'card.penalty': 'Penalidad',
  'card.rounds': '{count} rondas',
  'card.tap_reveal': 'Toca para revelar',
  'card.tap_reveal_a11y': 'Carta boca abajo — toca para revelar',
  'card.skip_label': 'O sáltalo: ',
  'card.draw': 'Sacar carta',

  'nav.room': 'Sala',
  'nav.leave': 'Salir de la sala',
  'nav.language': 'Idioma',
};

const TABLES: Record<Language, Strings> = { en, es };

export type StringKey = keyof typeof en;

export function t(
  key: StringKey,
  lang: Language,
  vars?: Record<string, string | number>,
): string {
  const raw = TABLES[lang][key] ?? en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    raw,
  );
}

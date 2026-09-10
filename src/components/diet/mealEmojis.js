// Emojis de los tiempos de comida del editor de dieta. Compartidos por el
// resumen lateral (DietSummaryPanel) y el editor principal (tabs + selector de icono).

// Emojis representativos para cada tiempo de comida por defecto.
const MEAL_EMOJIS = { m1: "🍳", m2: "🥘", m3: "🍎", m4: "🌙" };

// Si la comida tiene un `icon` explícito (elegido por el usuario), gana sobre el por defecto.
export const getMealEmoji = (meal) => meal?.icon || MEAL_EMOJIS[meal?.id] || "🍽️";

// Catálogo de emojis disponibles en el selector de icono del tiempo de comida.
export const MEAL_EMOJI_OPTIONS = [
  "🍳","🥐","🥞","🥯","🥖","🥪","🍞","🥗","🥘","🍲",
  "🍛","🍜","🍝","🍣","🍱","🍙","🌮","🌯","🥙","🥟",
  "🍕","🍔","🌭","🍟","🍗","🍖","🥩","🐟","🥚","🧀",
  "🥕","🥦","🥑","🍅","🌽","🍠","🍎","🍌","🍇","🍓",
  "🍊","🍉","🍐","🥝","🥭","🍑","🍒","🍍","🍋","🥥",
  "🥛","🧃","🍵","☕","🥤","🍯","🍪","🧁","🍰","🌙",
  "⭐","🍽️",
];

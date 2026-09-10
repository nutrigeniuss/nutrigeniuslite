// =============================================================================
// Lista de intercambios — catálogo base del planificador por intercambios
// =============================================================================
// Basado en las listas de intercambio latinoamericanas estándar, con alimentos
// y medidas caseras de uso peruano (papa nativa, cañihua, chancaca, marcas
// locales de galletas y yogures).
//
// LA IDEA DEL SISTEMA, que explica toda la forma de estos datos: dentro de un
// grupo, una porción de cualquier alimento aporta APROXIMADAMENTE los mismos
// macronutrientes. Por eso los valores nutricionales (kcal, protein, carbs,
// fat) viven en el GRUPO y no en el alimento: el paciente puede cambiar arroz
// por papa sin recalcular nada, que es justo lo que hace práctico el método.
//
// Forma de cada grupo:
//   key         identificador estable; se guarda en los planes, NO renombrar
//   label       nombre completo
//   shortLabel  versión corta para encabezados estrechos
//   color/headerBg  clases de Tailwind del grupo en la tabla
//   kcal, protein, carbs, fat  aporte de UNA porción (el "intercambio")
//   foods[]     alimentos equivalentes dentro del grupo
//
// Forma de cada alimento:
//   grams_raw     gramos en crudo
//   grams_cooked  gramos ya cocido — cambian mucho por absorción de agua
//                 (20 g de arroz crudo son 48 g cocidos). `null` cuando el
//                 alimento no se cocina o no se mide cocido (pan, harinas,
//                 azúcar), no cuando el dato falta.
//   measure       medida casera, que es como el nutricionista lo prescribe:
//                 el paciente no tiene balanza, tiene cucharas y tazas.
//
// Los grupos proteicos están separados por CONTENIDO DE GRASA (magros, bajos,
// moderados, altos) porque a igual proteína el aporte calórico cambia mucho:
// no es lo mismo intercambiar pechuga por chicharrón. Lo mismo para lácteos
// (enteros / descremados / azucarados) y cereales (con y sin grasa).
// =============================================================================
export const EXCHANGE_GROUPS = [
  {
    key: "cereales_tuberculos",
    label: "Cereales y Tubérculos",
    shortLabel: "Cereales y Tubérculos",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    headerBg: "bg-amber-50",
    kcal: 77, protein: 2, carbs: 15, fat: 1,
    foods: [
      { id: "ct1", name: "Arroz blanco", grams_raw: 20, grams_cooked: 48, measure: "2 cdas llenas crudas o 1/3 taza cocida" },
      { id: "ct2", name: "Avena espesa cocida", grams_raw: 24, grams_cooked: 180, measure: "2 cdas colmadas o 3/4 taza cocida" },
      { id: "ct3", name: "Avena hojuela", grams_raw: 12, grams_cooked: 240, measure: "1 cda colmada cruda o 1 taza avena líquida" },
      { id: "ct4", name: "Cañihua gris", grams_raw: 22, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct5", name: "Cañihua parda", grams_raw: 22, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct6", name: "Fideos variados", grams_raw: 20, grams_cooked: 44, measure: "1/3 taza cocida" },
      { id: "ct7", name: "Fideos tallarin", grams_raw: 20, grams_cooked: 48, measure: "1/3 taza cocida" },
      { id: "ct8", name: "Kiwicha cocida", grams_raw: 25, grams_cooked: 50, measure: "2 cdas colmadas o 1/3 taza cocida" },
      { id: "ct9", name: "Kiwicha pop", grams_raw: 25, grams_cooked: null, measure: "4 cdas colmadas crudas" },
      { id: "ct10", name: "Maíz alazán, jora seca", grams_raw: 20, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct11", name: "Maíz amarillo crudo", grams_raw: 20, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct12", name: "Maíz blanco crudo", grams_raw: 20, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct13", name: "Maíz blanco, chochoca", grams_raw: 22, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct14", name: "Maíz blanco, harina", grams_raw: 22, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct15", name: "Maíz morado, harina de (api)", grams_raw: 22, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct16", name: "Maíz popcorn", grams_raw: 22, grams_cooked: 22, measure: "2 cdas colmadas crudas o 2 tazas al ras cocidas" },
      { id: "ct17", name: "Maíz chullpi (cancha)", grams_raw: 24, grams_cooked: 24, measure: "2 cdas colmadas crudas o cocidas" },
      { id: "ct18", name: "Maíz, choclo cocido", grams_raw: 60, grams_cooked: 63, measure: "2/3 mazorca cruda o 1/3 taza cocido" },
      { id: "ct19", name: "Maíz, harina", grams_raw: 22, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct20", name: "Maíz, maicena", grams_raw: 20, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct21", name: "Maíz, para mote", grams_raw: 20, grams_cooked: 43, measure: "2 cdas llenas crudas o 1/3 taza cocida" },
      { id: "ct22", name: "Maíz, polenta cruda", grams_raw: 20, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct23", name: "Pan chapla", grams_raw: null, grams_cooked: 24, measure: "1 unidad" },
      { id: "ct24", name: "Pan ciabatta", grams_raw: null, grams_cooked: 24, measure: "1/2 unidad" },
      { id: "ct25", name: "Pan de molde", grams_raw: null, grams_cooked: 25, measure: "1 unidad" },
      { id: "ct26", name: "Pan francés", grams_raw: null, grams_cooked: 28, measure: "1 unidad" },
      { id: "ct27", name: "Pan integral", grams_raw: null, grams_cooked: 28, measure: "1 unidad" },
      { id: "ct28", name: "Quinua blanca", grams_raw: 25, grams_cooked: 48, measure: "2 cdas llenas crudas o 1/3 taza cocida" },
      { id: "ct29", name: "Quinua, harina", grams_raw: 25, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct30", name: "Quinua, hojuelas", grams_raw: 24, grams_cooked: null, measure: "2 cdas colmadas crudas" },
      { id: "ct31", name: "Trigo", grams_raw: 20, grams_cooked: 50, measure: "2 cdas colmadas crudas o 1/3 taza cocida" },
      { id: "ct32", name: "Trigo, sémola", grams_raw: 22, grams_cooked: null, measure: "2 cdas colmadas crudas" },
      { id: "ct33", name: "Trigo, harina", grams_raw: 20, grams_cooked: null, measure: "2 cdas llenas crudas" },
      { id: "ct34", name: "Trigo, resbalado", grams_raw: 20, grams_cooked: 49, measure: "2 cdas llenas crudas o 1/3 taza cocida" },
      { id: "ct35", name: "Camote amarillo", grams_raw: 75, grams_cooked: 75, measure: "1/2 unidad pequeña cocida" },
      { id: "ct36", name: "Camote morado", grams_raw: 60, grams_cooked: 59, measure: "1/2 unidad pequeña cocida" },
      { id: "ct37", name: "Arracacha o racacha", grams_raw: 65, grams_cooked: 63, measure: "1/2 unidad pequeña cocida" },
      { id: "ct38", name: "Harina de chuño", grams_raw: 22, grams_cooked: null, measure: "2 cdas colmadas crudas" },
      { id: "ct39", name: "Mashua", grams_raw: 200, grams_cooked: 200, measure: "3 unidades medianas cocidas" },
      { id: "ct40", name: "Oca sin cáscara", grams_raw: 110, grams_cooked: 105, measure: "5 unidades pequeñas cocidas" },
      { id: "ct41", name: "Olluco sin cáscara", grams_raw: 100, grams_cooked: 100, measure: "4 unidades pequeñas cocidas" },
      { id: "ct42", name: "Papa amarilla", grams_raw: 65, grams_cooked: 64, measure: "1 unidad pequeña cocida" },
      { id: "ct43", name: "Papa blanca", grams_raw: 80, grams_cooked: 80, measure: "3/4 unidad pequeña cocida" },
      { id: "ct44", name: "Papa canchan", grams_raw: 100, grams_cooked: 98, measure: "3/4 pequeña cocida" },
      { id: "ct45", name: "Papa negra andina", grams_raw: 100, grams_cooked: 98, measure: "3/4 unidad pequeña" },
      { id: "ct46", name: "Papa seca", grams_raw: 22, grams_cooked: 94, measure: "2 cdas llenas crudas o 1/2 taza cocida" },
      { id: "ct47", name: "Papa yungay cocida", grams_raw: 75, grams_cooked: 74, measure: "3/4 unidad pequeña cocida" },
      { id: "ct48", name: "Papa amarilis", grams_raw: 100, grams_cooked: 98, measure: "1 unidad pequeña cocida" },
      { id: "ct49", name: "Papa tumbay", grams_raw: 75, grams_cooked: 74, measure: "3/4 unidad pequeña cocida" },
      { id: "ct50", name: "Papa nativa peruanita", grams_raw: 85, grams_cooked: 83, measure: "3/4 unidad pequeña cocida" },
      { id: "ct51", name: "Pituca o taro", grams_raw: 75, grams_cooked: 74, measure: "1/2 unidad pequeña cocida" },
      { id: "ct52", name: "Yuca amarilla", grams_raw: 42, grams_cooked: 45, measure: "1 rodaja pequeña cocida" },
      { id: "ct53", name: "Papa huayro sin cáscara", grams_raw: 90, grams_cooked: 88, measure: "3/4 unidad pequeña cocida" },
    ]
  },
  {
    key: "cereales_con_grasa",
    label: "Cereales con Grasa",
    shortLabel: "Cereales c/Grasa",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    headerBg: "bg-orange-50",
    kcal: 95, protein: 2, carbs: 15, fat: 3,
    foods: [
      { id: "cg1", name: "Cereal bar", grams_raw: null, grams_cooked: 20, measure: "1 unidad" },
      { id: "cg2", name: "Galleta de soda (San Jorge)", grams_raw: null, grams_cooked: 20, measure: "1/2 paquete o 6 unidades" },
      { id: "cg3", name: "Galleta de vainilla (Field)", grams_raw: null, grams_cooked: 19, measure: "1/2 paquete o 4 unidades" },
      { id: "cg4", name: "Galleta dulce con relleno (Casino)", grams_raw: null, grams_cooked: 18, measure: "1 y 1/2 unidad" },
      { id: "cg5", name: "Galleta dulce con rellena chocolate (Coronita)", grams_raw: null, grams_cooked: 18, measure: "2 unidades" },
      { id: "cg6", name: "Galletas morochas", grams_raw: null, grams_cooked: 19, measure: "5 unidades" },
      { id: "cg7", name: "Granola", grams_raw: null, grams_cooked: 24, measure: "1 y 1/2 cdas colmadas" },
      { id: "cg8", name: "Pan de maíz", grams_raw: null, grams_cooked: 28, measure: "1 unidad" },
      { id: "cg9", name: "Pan de yema", grams_raw: null, grams_cooked: 28, measure: "1 unidad" },
      { id: "cg10", name: "Chancay (bizcocho)", grams_raw: null, grams_cooked: 30, measure: "1 unidad" },
    ]
  },
  {
    key: "menestras",
    label: "Menestras",
    shortLabel: "Menestras",
    color: "bg-teal-100 text-teal-700 border-teal-200",
    headerBg: "bg-teal-50",
    kcal: 97, protein: 7, carbs: 15, fat: 1,
    foods: [
      { id: "men1", name: "Arvejón cocido", grams_raw: 40, grams_cooked: 88, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men2", name: "Frejol amarillo común cocido", grams_raw: 38, grams_cooked: 93, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men3", name: "Frejol bayo cocido", grams_raw: 38, grams_cooked: 88, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men4", name: "Frejol bayo americano cocido", grams_raw: 38, grams_cooked: 101, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men5", name: "Frejol caballero cocido", grams_raw: 38, grams_cooked: 90, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men6", name: "Frejol california cocido", grams_raw: 38, grams_cooked: 90, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men7", name: "Frejol canario cocido", grams_raw: 38, grams_cooked: 86, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men8", name: "Frejol castilla cocido", grams_raw: 38, grams_cooked: 81, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men9", name: "Frejol negro cocido", grams_raw: 35, grams_cooked: 89, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men10", name: "Frejol nuña cocido", grams_raw: 34, grams_cooked: 71, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men11", name: "Frejol panamito", grams_raw: 38, grams_cooked: 81, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men12", name: "Frejol red kidney", grams_raw: 30, grams_cooked: 94, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men13", name: "Frejol white kidney", grams_raw: 35, grams_cooked: 90, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men14", name: "Frejol zarandaja", grams_raw: 38, grams_cooked: 88, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men15", name: "Garbanzo", grams_raw: 35, grams_cooked: 103, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men16", name: "Habas secas sin cáscara", grams_raw: 35, grams_cooked: 112, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men17", name: "Lentejas chicas", grams_raw: 36, grams_cooked: 84, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men18", name: "Lentejas grandes", grams_raw: 40, grams_cooked: 84, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men19", name: "Pallar seco", grams_raw: 40, grams_cooked: 89, measure: "1/2 taza cocida o 4 cdas colmadas" },
      { id: "men20", name: "Pallar sin cáscara", grams_raw: 35, grams_cooked: 91, measure: "1/2 taza cocida o 4 cdas colmadas" },
    ]
  },
  {
    key: "verduras",
    label: "Hortalizas y Verduras",
    shortLabel: "Hortalizas y Verduras",
    color: "bg-green-100 text-green-700 border-green-200",
    headerBg: "bg-green-50",
    kcal: 29, protein: 2, carbs: 4, fat: 0.5,
    foods: [
      { id: "v1", name: "Acelga, hojas (sin tallo)", grams_raw: 200, grams_cooked: 200, measure: "2 tazas crudas o 1 taza cocida" },
      { id: "v2", name: "Alcachofa, base o fondo cocida", grams_raw: null, grams_cooked: 100, measure: "1/2 taza cocida" },
      { id: "v3", name: "Apio", grams_raw: 300, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v4", name: "Arverja verde cocida", grams_raw: null, grams_cooked: 40, measure: "1/4 taza cocida" },
      { id: "v5", name: "Berenjena cocida", grams_raw: null, grams_cooked: 200, measure: "1 y 1/2 tazas cocidas" },
      { id: "v6", name: "Berros", grams_raw: 100, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v7", name: "Beterraga cocida", grams_raw: null, grams_cooked: 150, measure: "1 taza cocida" },
      { id: "v8", name: "Brócoli cocido", grams_raw: null, grams_cooked: 120, measure: "1 taza cocida" },
      { id: "v9", name: "Caigua cruda", grams_raw: 150, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v10", name: "Calabaza italiana cocida", grams_raw: null, grams_cooked: 150, measure: "1 taza cocida" },
      { id: "v11", name: "Cebolla de cabeza picada", grams_raw: 50, grams_cooked: null, measure: "1/2 taza cruda" },
      { id: "v12", name: "Cebolla china picada", grams_raw: 60, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v13", name: "Champiñón picado crudo", grams_raw: 100, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v14", name: "Col china sin tallo picado", grams_raw: 100, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v15", name: "Chiclayo o calabaza cocida picada", grams_raw: null, grams_cooked: 120, measure: "1 taza cocida" },
      { id: "v16", name: "Chonta rallada", grams_raw: 50, grams_cooked: null, measure: "1/2 taza cruda" },
      { id: "v17", name: "Col blanca picada", grams_raw: 100, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v18", name: "Col crespa o repollo, sin cogollo picada", grams_raw: 200, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v19", name: "Colantao entero cocida", grams_raw: null, grams_cooked: 80, measure: "1 taza cocida" },
      { id: "v20", name: "Coliflor con tallo y sin hojas cocida", grams_raw: null, grams_cooked: 150, measure: "1 y 1/2 tazas cocidas" },
      { id: "v21", name: "Coliflor sin tallo y sin hojas cocida", grams_raw: null, grams_cooked: 200, measure: "2 tazas cocidas" },
      { id: "v22", name: "Espárragos cocidos", grams_raw: 200, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v23", name: "Espinaca negra sin tronco picada", grams_raw: 200, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v24", name: "Frejolito chino germinado", grams_raw: 200, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v25", name: "Lechuga americana deshojada", grams_raw: 300, grams_cooked: null, measure: "3 tazas crudas" },
      { id: "v26", name: "Lechuga de seda deshojada", grams_raw: 200, grams_cooked: null, measure: "3 tazas crudas" },
      { id: "v27", name: "Nabo picado", grams_raw: 200, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v28", name: "Pepinillo rojo sin semilla picado", grams_raw: 130, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v29", name: "Rabanitos en rodajas", grams_raw: 200, grams_cooked: null, measure: "2 tazas crudas" },
      { id: "v30", name: "Tomate italiano con cascara", grams_raw: 150, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v31", name: "Tomate redondo con cáscara", grams_raw: 120, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v32", name: "Tomate, salsa", grams_raw: 150, grams_cooked: null, measure: "1 taza cruda" },
      { id: "v33", name: "Vainita cocidas", grams_raw: null, grams_cooked: 105, measure: "1 taza cocida" },
      { id: "v34", name: "Zanahoria cocida", grams_raw: null, grams_cooked: 120, measure: "1 taza cocida" },
      { id: "v35", name: "Zapallo macre cocido", grams_raw: null, grams_cooked: 75, measure: "1/2 taza cocida" },
    ]
  },
  {
    key: "frutas",
    label: "Frutas",
    shortLabel: "Frutas",
    color: "bg-red-100 text-red-700 border-red-200",
    headerBg: "bg-red-50",
    kcal: 64, protein: 1, carbs: 15, fat: 0,
    foods: [
      { id: "f1", name: "Abridores", grams_raw: 100, grams_cooked: null, measure: "1 unidad mediana" },
      { id: "f2", name: "Aguaymanto", grams_raw: 120, grams_cooked: null, measure: "23 unidades pequeñas o 3/4 taza" },
      { id: "f3", name: "Airampo", grams_raw: 130, grams_cooked: null, measure: "1 unidad mediana cruda o 3/4 taza" },
      { id: "f4", name: "Anona", grams_raw: 140, grams_cooked: null, measure: "1 unidad pequeña cruda o 3/4 taza" },
      { id: "f5", name: "Arándano", grams_raw: 120, grams_cooked: null, measure: "3/4 taza crudo" },
      { id: "f6", name: "Blanquillo", grams_raw: 130, grams_cooked: null, measure: "2 unidades pequeñas crudas" },
      { id: "f7", name: "Capulí", grams_raw: 90, grams_cooked: null, measure: "15 unidades pequeñas crudas o 3/4 taza" },
      { id: "f8", name: "Carambola", grams_raw: 300, grams_cooked: null, measure: "3 unidades grandes crudas" },
      { id: "f9", name: "Chirimoya", grams_raw: 80, grams_cooked: null, measure: "1/2 unidad pequeña cruda o 1/2 taza" },
      { id: "f10", name: "Ciruela peruana", grams_raw: 70, grams_cooked: null, measure: "7 unidades medianas crudas" },
      { id: "f11", name: "Cocona", grams_raw: 160, grams_cooked: null, measure: "1 unidad grande" },
      { id: "f12", name: "Damasco", grams_raw: 27, grams_cooked: null, measure: "4 unidades pequeñas" },
      { id: "f13", name: "Durazno-melocotón", grams_raw: 140, grams_cooked: null, measure: "2 unidades pequeñas" },
      { id: "f14", name: "Fresa", grams_raw: 200, grams_cooked: null, measure: "17 unidades medianas o 1 y 1/2 tazas" },
      { id: "f15", name: "Granada desgranada", grams_raw: 80, grams_cooked: null, measure: "3/4 taza cruda" },
      { id: "f16", name: "Granadilla", grams_raw: 200, grams_cooked: null, measure: "2 unidades grandes" },
      { id: "f17", name: "Guanábana", grams_raw: 130, grams_cooked: null, measure: "1/2 unidad pequeña" },
      { id: "f18", name: "Guayaba", grams_raw: 150, grams_cooked: null, measure: "3 unidades pequeñas" },
      { id: "f19", name: "Guindones", grams_raw: 27, grams_cooked: null, measure: "3 unidades medianas" },
      { id: "f20", name: "Higo seco", grams_raw: 40, grams_cooked: null, measure: "2 unidades medianas" },
      { id: "f21", name: "Jugo de naranja", grams_raw: 190, grams_cooked: null, measure: "2 unidades medianas o 3/4 taza" },
      { id: "f22", name: "Kaki", grams_raw: 90, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f23", name: "Kiwi", grams_raw: 180, grams_cooked: null, measure: "2 unidades medianas" },
      { id: "f24", name: "Lima", grams_raw: 450, grams_cooked: null, measure: "5 unidades pequeñas o 3 tazas" },
      { id: "f25", name: "Limón, jugo", grams_raw: 160, grams_cooked: null, measure: "7 unidades grandes o 3/4 de taza" },
      { id: "f26", name: "Lúcuma", grams_raw: 60, grams_cooked: null, measure: "1/2 unidad pequeña o 1/3 taza" },
      { id: "f27", name: "Mamey maduro", grams_raw: 220, grams_cooked: null, measure: "1/2 unidad crudo o 1 y 1/2 tazas" },
      { id: "f28", name: "Mandarina", grams_raw: 220, grams_cooked: null, measure: "2 unidades medianas o 1 y 1/2 tazas" },
      { id: "f29", name: "Mango", grams_raw: 100, grams_cooked: null, measure: "1/2 unidad pequeña o 1/2 taza" },
      { id: "f30", name: "Manzana chilena verde", grams_raw: 160, grams_cooked: null, measure: "1 unidad mediana" },
      { id: "f31", name: "Manzana de agua", grams_raw: 170, grams_cooked: null, measure: "3 unidades pequeñas" },
      { id: "f32", name: "Manzana delicia roja con cáscara", grams_raw: 110, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f33", name: "Manzana israel con cáscara", grams_raw: 140, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f34", name: "Manzana nacional", grams_raw: 110, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f35", name: "Manzana Santa Rosa (Golden) con cáscara", grams_raw: 100, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f36", name: "Manzana winter con cáscara", grams_raw: 120, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f37", name: "Maracuyá, jugo", grams_raw: 100, grams_cooked: null, measure: "1/2 taza" },
      { id: "f38", name: "Marañon", grams_raw: 190, grams_cooked: null, measure: "1 unidad grande" },
      { id: "f39", name: "Melón", grams_raw: 300, grams_cooked: null, measure: "1 tajada mediana o 2 tazas" },
      { id: "f40", name: "Membrillo", grams_raw: 150, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f41", name: "Mora", grams_raw: 120, grams_cooked: null, measure: "3/4 taza" },
      { id: "f42", name: "Naranja", grams_raw: 190, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f43", name: "Naranja de huando", grams_raw: 180, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f44", name: "Naranja tangelo", grams_raw: 280, grams_cooked: null, measure: "1 unidad grande" },
      { id: "f45", name: "Níspero", grams_raw: 130, grams_cooked: null, measure: "9 unidades medianas" },
      { id: "f46", name: "Pacae o guaba", grams_raw: 100, grams_cooked: null, measure: "2 unidades pequeñas o 1/2 taza" },
      { id: "f47", name: "Papaya", grams_raw: 230, grams_cooked: null, measure: "1 tajada mediana o 1 y 1/2 tazas" },
      { id: "f48", name: "Pasa sin pepa", grams_raw: 25, grams_cooked: null, measure: "2 cucharadas llenas" },
      { id: "f49", name: "Pepino dulce", grams_raw: 210, grams_cooked: null, measure: "1 y 1/2 taza" },
      { id: "f50", name: "Pera chilena", grams_raw: 140, grams_cooked: null, measure: "1 unidad pequeña o 1 taza" },
      { id: "f51", name: "Pera de agua", grams_raw: 150, grams_cooked: null, measure: "1 unidad pequeña o 1 taza" },
      { id: "f52", name: "Piña", grams_raw: 180, grams_cooked: null, measure: "1 rodaja pequeña o 1 taza" },
      { id: "f53", name: "Pitahaya", grams_raw: 100, grams_cooked: null, measure: "1/2 unidad mediana o 1/2 taza" },
      { id: "f54", name: "Plátano de isla", grams_raw: 75, grams_cooked: null, measure: "1 unidad pequeña o 1/2 taza" },
      { id: "f55", name: "Plátano de seda", grams_raw: 80, grams_cooked: null, measure: "1/2 unidad mediana o 1/2 taza" },
      { id: "f56", name: "Pomarosa", grams_raw: 180, grams_cooked: null, measure: "1 unidad mediana" },
      { id: "f57", name: "Sandía", grams_raw: 270, grams_cooked: null, measure: "1 y 1/2 tazas" },
      { id: "f58", name: "Toronja", grams_raw: 190, grams_cooked: null, measure: "1 unidad pequeña" },
      { id: "f59", name: "Tumbo costeño", grams_raw: 250, grams_cooked: null, measure: "1 tajada mediana o 2 tazas" },
      { id: "f60", name: "Tumbo serrano", grams_raw: 200, grams_cooked: null, measure: "2 unidades medianas o 1 y 1/2 tazas" },
      { id: "f61", name: "Tuna roja", grams_raw: 190, grams_cooked: null, measure: "2 unidades medianas o 1 taza" },
      { id: "f62", name: "Tuna verde", grams_raw: 120, grams_cooked: null, measure: "2 unidades pequeñas o 3/4 taza" },
      { id: "f63", name: "Uva borgoña", grams_raw: 70, grams_cooked: null, measure: "14 unidades medianas o 1/3 taza" },
      { id: "f64", name: "Uva italia", grams_raw: 90, grams_cooked: null, measure: "19 unidades medianas o 1/2 taza" },
      { id: "f65", name: "Zapote", grams_raw: 80, grams_cooked: null, measure: "1/2 unidad pequeña o 1/2 taza" },
    ]
  },
  {
    key: "lacteos_enteros",
    label: "Lácteos Enteros",
    shortLabel: "Lácteos Enteros",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50",
    kcal: 152, protein: 8, carbs: 12, fat: 8,
    foods: [
      { id: "le1", name: "Leche en polvo entera", grams_raw: 30, grams_cooked: null, measure: "3 cucharadas llenas" },
      { id: "le2", name: "Leche evaporada entera", grams_raw: 120, grams_cooked: null, measure: "1/2 taza" },
      { id: "le3", name: "Leche fresca de cabra", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "le4", name: "Leche fresca de vaca", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "le5", name: "Leche fresca entera (plusa)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "le6", name: "Yogurt de leche entera", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "le7", name: "Queso andino", grams_raw: 30, grams_cooked: null, measure: "1 tajada delgada" },
      { id: "le8", name: "Queso fresco de vaca", grams_raw: 40, grams_cooked: null, measure: "1 tajada delgada" },
      { id: "le9", name: "Queso paria", grams_raw: 35, grams_cooked: null, measure: "1 tajada delgada" },
    ]
  },
  {
    key: "lacteos_descremados",
    label: "Lácteos Descremados",
    shortLabel: "Lácteos Desc.",
    color: "bg-sky-100 text-sky-700 border-sky-200",
    headerBg: "bg-sky-50",
    kcal: 85, protein: 8, carbs: 12, fat: 0.5,
    foods: [
      { id: "ld1", name: "Leche en polvo descremada", grams_raw: 30, grams_cooked: null, measure: "3 cucharadas llenas" },
      { id: "ld2", name: "Leche evaporada descremada", grams_raw: 120, grams_cooked: null, measure: "1/2 taza" },
      { id: "ld3", name: "Leche fresca de vaca descremada", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "ld4", name: "Yogurt natural de leche descremada", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
    ]
  },
  {
    key: "lacteos_azucarados",
    label: "Lácteos Azucarados",
    shortLabel: "Lácteos Azucar.",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    headerBg: "bg-indigo-50",
    kcal: 210, protein: 7, carbs: 32, fat: 6,
    foods: [
      { id: "la1", name: "Yogurt bebible de vainilla batimix (Gloria)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "la2", name: "Yogurt bebible fresa (Gloria)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "la3", name: "Yogurt bebible sabor natural (Gloria)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "la4", name: "Yogurt bebible vainilla (Gloria)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "la5", name: "Yogurt bebible yopi mix (Laive)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
      { id: "la6", name: "Yogurt griego batido con iel (Gloria)", grams_raw: 240, grams_cooked: null, measure: "1 taza" },
    ]
  },
  {
    key: "azucares",
    label: "Azúcares",
    shortLabel: "Azúcares",
    color: "bg-pink-100 text-pink-700 border-pink-200",
    headerBg: "bg-pink-50",
    kcal: 60, protein: 0, carbs: 15, fat: 0,
    foods: [
      { id: "az1", name: "Azúcar granulada o refinada", grams_raw: 15, grams_cooked: null, measure: "1 cucharada o 2 cucharaditas colmadas" },
      { id: "az2", name: "Azúcar rubia", grams_raw: 15, grams_cooked: null, measure: "1 cucharada llena o 2 cucharaditas colmadas" },
      { id: "az3", name: "Chancaca", grams_raw: 18, grams_cooked: null, measure: "1 cucharadita colmada" },
      { id: "az4", name: "Mermelada de durazno", grams_raw: 25, grams_cooked: null, measure: "1 cucharada colmada" },
      { id: "az5", name: "Mermelada de fresa", grams_raw: 25, grams_cooked: null, measure: "1 cucharada colmada" },
      { id: "az6", name: "Miel de abeja", grams_raw: 18, grams_cooked: null, measure: "1 cucharada y 1 cucharadita colmada" },
      { id: "az7", name: "Miel de caña", grams_raw: 18, grams_cooked: null, measure: "1 cucharada y 1 cucharadita colmada" },
    ]
  },
  {
    key: "proteicos_magros",
    label: "Alimentos Proteicos Magros",
    shortLabel: "Prot. Magros",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    headerBg: "bg-rose-50",
    kcal: 34, protein: 7, carbs: 0, fat: 0.5,
    foods: [
      { id: "pm1", name: "Pescado tramboyo crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm2", name: "Pescado trucha rosada cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm3", name: "Pollo, carne pulpa cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm4", name: "Pollo, sangre cocida", grams_raw: 40, grams_cooked: 40, measure: "3 cucharadas llenas cocidas" },
      { id: "pm5", name: "Pota cruda", grams_raw: 40, grams_cooked: 28, measure: "1/4 taza picada" },
      { id: "pm6", name: "Res, carne pulpa cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 trozo mediano" },
      { id: "pm7", name: "Pescado cojinova cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm8", name: "Pescado lenguado cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm9", name: "Pescado merluza cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm10", name: "Pescado mero cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm11", name: "Pescado pampanito cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm12", name: "Pescado pejerrey cruda", grams_raw: 35, grams_cooked: 25, measure: "2 unidades medianas cocidas" },
      { id: "pm13", name: "Pescado perico cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm14", name: "Pescado tilapia cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm15", name: "Pescado toyo cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm16", name: "Alpaca carne pulpa cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete trozo" },
      { id: "pm17", name: "Bazo de res", grams_raw: 35, grams_cooked: 30, measure: "2 cucharadas colmadas cocidas" },
      { id: "pm18", name: "Bofe de pulmón de res", grams_raw: 40, grams_cooked: 28, measure: "1/4 taza picada" },
      { id: "pm19", name: "Cuy, carne pulpa cruda", grams_raw: 35, grams_cooked: 21, measure: "1/2 pierna mediana" },
      { id: "pm20", name: "Molleja de pollo cruda", grams_raw: 40, grams_cooked: 25, measure: "2 unidades medianas" },
      { id: "pm21", name: "Pescado atún, enlatado en agua", grams_raw: null, grams_cooked: 30, measure: "2 cucharadas colmadas" },
      { id: "pm22", name: "Pescado bonito, musculo claro cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm23", name: "Pescado cabrilla cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pm24", name: "Pescado chita cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
    ]
  },
  {
    key: "proteicos_bajos_grasa",
    label: "Alimentos Proteicos Bajos en Grasa",
    shortLabel: "Prot. Bajos Grasa",
    color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    headerBg: "bg-fuchsia-50",
    kcal: 46, protein: 7, carbs: 0, fat: 2,
    foods: [
      { id: "pb1", name: "Res, carne molida crudo", grams_raw: 35, grams_cooked: 30, measure: "2 cucharadas llenas" },
      { id: "pb2", name: "Res, corazón", grams_raw: 40, grams_cooked: 30, measure: "1/3 filete mediano" },
      { id: "pb3", name: "Res, hígado", grams_raw: 35, grams_cooked: 26, measure: "1/3 filete o 2 cdas colmadas" },
      { id: "pb4", name: "Res, riñon", grams_raw: 40, grams_cooked: 30, measure: "1/4 taza picada" },
      { id: "pb5", name: "Res cuadril, churrasco", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb6", name: "Pescado bonito, parte oscura", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb7", name: "Pescado bonito, músculo oscuro", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb8", name: "Pescado caballa, fresco crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb9", name: "Pescado corvina crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb10", name: "Pescado jurel, fresco crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb11", name: "Pescado lisa crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb12", name: "Pescado machete crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb13", name: "Pescado sardina fresco crudo", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb14", name: "Pollo, hígado crudo", grams_raw: 40, grams_cooked: 28, measure: "1 unidad pequeña" },
      { id: "pb15", name: "Cerdo, carne magra cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb16", name: "Choros, crudo", grams_raw: 50, grams_cooked: 29, measure: "5 unidades o 1/3 de taza" },
      { id: "pb17", name: "Conejo, carne pulpa cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb18", name: "Cordero, pierna cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 unidad" },
      { id: "pb19", name: "Gallina, pechuga de (sin piel) cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb20", name: "Gallina, pierna de (sin piel)", grams_raw: 35, grams_cooked: 25, measure: "1/3 unidad" },
      { id: "pb21", name: "Llama, carne fresca cruda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pb22", name: "Pescado atún, enlatado en aceite", grams_raw: null, grams_cooked: 30, measure: "2 cucharadas colmadas" },
      { id: "pb23", name: "Pescado atún fresco", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
    ]
  },
  {
    key: "proteicos_moderados_grasa",
    label: "Alimentos Proteicos Moderados en Grasa",
    shortLabel: "Prot. Mod. Grasa",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    headerBg: "bg-purple-50",
    kcal: 73, protein: 7, carbs: 0, fat: 5,
    foods: [
      { id: "pmo1", name: "Huevo de codorniz crudo", grams_raw: 50, grams_cooked: 50, measure: "5 unidades medianas" },
      { id: "pmo2", name: "Huevo de gallina crudo", grams_raw: 51, grams_cooked: 50, measure: "1 unidad mediana" },
      { id: "pmo3", name: "Huevo de gallina frito", grams_raw: 52, grams_cooked: 49, measure: "1 unidad mediana" },
      { id: "pmo4", name: "Pollo, alas sin piel", grams_raw: 35, grams_cooked: 28, measure: "1/2 unidad pequeña" },
    ]
  },
  {
    key: "proteicos_altos_grasa",
    label: "Alimentos Proteicos Altos en Grasa",
    shortLabel: "Prot. Altos Grasa",
    color: "bg-red-100 text-red-700 border-red-200",
    headerBg: "bg-red-50",
    kcal: 100, protein: 7, carbs: 0, fat: 8,
    foods: [
      { id: "pa1", name: "Carnero, pulpa gorda", grams_raw: 35, grams_cooked: 26, measure: "1/3 filete mediano" },
      { id: "pa2", name: "Carnero, pulpa semigorda", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pa3", name: "Cerdo, carne sin hueso", grams_raw: 35, grams_cooked: 25, measure: "2 cucharadas llenas" },
      { id: "pa4", name: "Cerdo, costilla", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
      { id: "pa5", name: "Cerdo, patas semigordas", grams_raw: 35, grams_cooked: 25, measure: "1 trozo pequeño" },
      { id: "pa6", name: "Pato, carne de", grams_raw: 35, grams_cooked: 25, measure: "1/3 filete mediano" },
    ]
  },
  {
    key: "grasas_con_proteinas",
    label: "Alimentos Grasos con Proteínas",
    shortLabel: "Grasas c/Prot.",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    headerBg: "bg-yellow-50",
    kcal: 49, protein: 1, carbs: 0, fat: 5,
    foods: [
      { id: "gp1", name: "Nuez", grams_raw: 7, grams_cooked: null, measure: "3 medias mitades medianas" },
      { id: "gp2", name: "Almendra", grams_raw: 8, grams_cooked: null, measure: "6 unidades medianas" },
      { id: "gp3", name: "Castaña peruana (Nuez de brasil)", grams_raw: 7, grams_cooked: null, measure: "1 unidad mediana" },
      { id: "gp4", name: "Chía", grams_raw: 12, grams_cooked: null, measure: "1 cucharada colmada" },
      { id: "gp5", name: "Linaza", grams_raw: 10, grams_cooked: null, measure: "1 cucharada llena" },
      { id: "gp6", name: "Palta", grams_raw: 40, grams_cooked: null, measure: "1/4 unidad pequeña" },
      { id: "gp7", name: "Pecana", grams_raw: 7, grams_cooked: null, measure: "1 unidad mediana" },
      { id: "gp8", name: "Semilla de ajonjoli", grams_raw: 10, grams_cooked: null, measure: "1 cucharada llena" },
      { id: "gp9", name: "Semilla de girasol", grams_raw: 8, grams_cooked: null, measure: "1 cucharada llena" },
      { id: "gp10", name: "Maní tostado (sin pelicula)", grams_raw: 10, grams_cooked: null, measure: "14 unidades o 1 cucharada llena" },
    ]
  },
  {
    key: "grasas_sin_proteinas",
    label: "Alimentos Grasos sin Proteínas",
    shortLabel: "Grasas s/Prot.",
    color: "bg-lime-100 text-lime-700 border-lime-200",
    headerBg: "bg-lime-50",
    kcal: 45, protein: 0, carbs: 0, fat: 5,
    foods: [
      { id: "gs1", name: "Coco rallado", grams_raw: 8, grams_cooked: null, measure: "1 cucharada colmada" },
      { id: "gs2", name: "Manteca de cerdo", grams_raw: 5, grams_cooked: null, measure: "1 cucharadita al ras" },
      { id: "gs3", name: "Manteca vegetal", grams_raw: 5, grams_cooked: null, measure: "1 cucharadita al ras" },
      { id: "gs4", name: "Mantequilla", grams_raw: 6, grams_cooked: null, measure: "1 cucharadita al ras" },
      { id: "gs5", name: "Margarina", grams_raw: 8, grams_cooked: null, measure: "1 cucharadita llena" },
      { id: "gs6", name: "Mayonesa", grams_raw: 7, grams_cooked: null, measure: "1 cucharadita llena" },
      { id: "gs7", name: "Tocino", grams_raw: 10, grams_cooked: null, measure: "1 tira delgada" },
      { id: "gs8", name: "Aceite de algodón", grams_raw: 5, grams_cooked: null, measure: "1 cucharada" },
      { id: "gs9", name: "Aceite de girasol", grams_raw: 5, grams_cooked: null, measure: "1 cucharada" },
      { id: "gs10", name: "Aceite de maíz", grams_raw: 5, grams_cooked: null, measure: "1 cucharada" },
      { id: "gs11", name: "Aceite de soya", grams_raw: 5, grams_cooked: null, measure: "1 cucharada" },
      { id: "gs12", name: "Aceite de olivo", grams_raw: 5, grams_cooked: null, measure: "1 cucharada" },
      { id: "gs13", name: "Aceituna de botija", grams_raw: 16, grams_cooked: null, measure: "4 unidades pequeñas" },
    ]
  },
];

// Esqueleto de un plan nuevo: cinco tiempos de comida con horarios habituales.
// Es solo el punto de partida — el nutricionista agrega, quita y renombra.
const DEFAULT_MEALS = [
  { id: "m1", name: "Desayuno", time: "08:00" },
  { id: "m2", name: "Media mañana", time: "10:30" },
  { id: "m3", name: "Almuerzo", time: "13:00" },
  { id: "m4", name: "Media tarde", time: "16:30" },
  { id: "m5", name: "Cena", time: "20:00" },
];

// Columnas visibles al abrir un plan: 7 de los 15 grupos. No es una limitación
// del modelo sino de la pantalla — con los quince a la vez la tabla se vuelve
// ilegible. Se eligieron los de uso más frecuente en un plan estándar; el resto
// se agrega desde la barra de herramientas cuando el caso lo pide (un plan
// hipercalórico querrá "cereales con grasa", uno renal los proteicos por
// contenido de grasa).
export const DEFAULT_GROUP_KEYS = [
  "cereales_tuberculos",
  "menestras",
  "verduras",
  "frutas",
  "lacteos_descremados",
  "proteicos_bajos_grasa",
  "grasas_sin_proteinas",
];

// Dos juegos de etiquetas para los mismos grupos, a propósito:
//
//   NUTRITIONIST_*  abreviadas ("Prot bajo gras."), para los encabezados de la
//                   matriz de trabajo, donde cada columna mide pocos píxeles.
//   PATIENT_*       completas ("Proteínas bajos en grasa"), para lo que se
//                   imprime y se lleva el paciente, que no conoce las
//                   abreviaturas del oficio.
//
// La clave del grupo es la misma en ambos; solo cambia cómo se muestra.
export const NUTRITIONIST_GROUP_LABELS = {
  cereales_tuberculos: "Cereales y tub.",
  cereales_con_grasa: "Cereales con gras.",
  menestras: "Menestras",
  verduras: "Verduras",
  frutas: "Frutas",
  lacteos_enteros: "Lácteos ent.",
  lacteos_descremados: "Lácteos descr.",
  lacteos_azucarados: "Lácteos azuc.",
  azucares: "Azúcares",
  proteicos_magros: "Prot mag.",
  proteicos_bajos_grasa: "Prot bajo gras.",
  proteicos_moderados_grasa: "Prot Mod gras.",
  proteicos_altos_grasa: "Prot alto gras.",
  grasas_con_proteinas: "Grasa con prot",
  grasas_sin_proteinas: "Grasas",
};

export const PATIENT_GROUP_LABELS = {
  cereales_tuberculos: "Cereales y Tubérculos",
  cereales_con_grasa: "Cereales con Grasa",
  menestras: "Menestras",
  verduras: "Verduras",
  frutas: "Frutas",
  lacteos_enteros: "Lácteos Enteros",
  lacteos_descremados: "Lácteos Descremados",
  lacteos_azucarados: "Lácteos Azucarados",
  azucares: "Azúcares",
  proteicos_magros: "Proteínas magras",
  proteicos_bajos_grasa: "Proteínas bajos en grasa",
  proteicos_moderados_grasa: "Proteínas moderadas en grasa",
  proteicos_altos_grasa: "Proteínas altos en grasa",
  grasas_con_proteinas: "Grasas con proteínas",
  grasas_sin_proteinas: "Grasas",
};

export const getNutritionistGroupLabel = (group) =>
  NUTRITIONIST_GROUP_LABELS[group.key] || group.shortLabel || group.label;

export const getPatientGroupLabel = (group) =>
  PATIENT_GROUP_LABELS[group.key] || group.label;

export const createDefaultMeals = () =>
  DEFAULT_MEALS.map(m => ({
    ...m,
    exchanges: EXCHANGE_GROUPS.reduce((acc, g) => ({ ...acc, [g.key]: 0 }), {})
  }));

/**
 * Totales del plan: suma el número de intercambios de cada comida por los
 * macros de SU GRUPO, no del alimento elegido.
 *
 * Es la consecuencia directa del sistema: el plan se prescribe en cantidad de
 * intercambios por grupo ("2 de cereales en el desayuno"), y recién al llevarlo
 * a la mesa el paciente decide si esos 2 son arroz o papa. Por eso los totales
 * no dependen de qué alimento termine eligiendo.
 *
 * `groups` permite calcular solo sobre las columnas visibles; sin él usa los 15.
 */
export const calcTotals = (meals, groups) => {
  const activeGroups = groups || EXCHANGE_GROUPS;
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  meals.forEach(meal => {
    activeGroups.forEach(g => {
      const n = parseFloat(meal.exchanges?.[g.key] || 0);
      totals.kcal += n * g.kcal;
      totals.protein += n * g.protein;
      totals.carbs += n * g.carbs;
      totals.fat += n * g.fat;
    });
  });
  return totals;
};
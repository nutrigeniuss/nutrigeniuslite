import fs from 'node:fs';

const path = 'c:/Users/LENOVO/.cursor/worktrees/nutrigenius-lite-calc/0ae2/src/components/diet/FoodSearch.jsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  /const handleAddRecipe = \(recipe\) => \{[\s\S]*?setTimeout\(\(\) => setAdded\(a => \{ const c = \{ \.\.\.a \}; delete c\[recipe\.id\]; return c; \}\), 1500\);\n  \};\n\n/,
  '',
);

s = s.replace(
  /\/\/ Current search value[\s\S]*?const TABS = \[[\s\S]*?\];/,
  `const currentSearch = foodSearch;
  const setCurrentSearch = setFoodSearch;

  const TABS = [
    { key: "alimentos", label: "Mis Alimentos", count: allFoods.length },
  ];`,
);

s = s.replace(
  /placeholder=\{tab === "usda"[\s\S]*?\}/,
  'placeholder="Buscar alimento... (presiona / para enfocar)"',
);

s = s.replace(/\{\/\* Recipes use a visual grid[\s\S]*?\) : null\}\n\n/, '');
s = s.replace(/\{tab !== "recetas" && currentSearch\.trim\(\) &&/, '{currentSearch.trim() &&');
s = s.replace(/\{\/\* RECETAS render[\s\S]*?\}\)\n              \)\}\n\n/, '');
s = s.replace(
  /quantityLabel=\{tab === "recetas" \? "Porciones" : "Cant\."\}/,
  'quantityLabel="Cant."',
);
s = s.replace(/const parseUSDAFood = \(food\) => \{[\s\S]*?\};\n\n/, '');
s = s.replace(/import \{ supabase \} from "@\/api\/supabaseClient";\n/, '');

// Empty-catalog banner after tabs header close of first inner flex - insert once
if (!s.includes('No hay base de alimentos cargada')) {
  s = s.replace(
    /\{TABS\.map\(t => \{[\s\S]*?\}\)\}\n      <\/div>\n\n      \{\/\* Search/,
    (match) =>
      match.replace(
        '{/* Search',
        `{allFoods.length === 0 ? (
        <div className="mx-6 mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay base de alimentos. Súbela en <strong>Maestro → Alimentos</strong> (JSON) o agrega alimentos uno a uno.
        </div>
      ) : null}

      {/* Search`,
      ),
  );
}

fs.writeFileSync(path, s);
console.log({
  RecipeGrid: s.includes('RecipeGridView'),
  filteredRecipes: s.includes('filteredRecipes'),
  usdaSearch: s.includes('usdaSearch'),
  recipeSearch: s.includes('recipeSearch'),
  buildRecipe: s.includes('buildRecipeIngredientItem'),
  searchUsda: s.includes('searchUsdaFoods'),
  getUsdaUnits: s.includes('getUsdaUnits'),
});

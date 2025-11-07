// Script pour ajouter un menu d'exemple
const menuItems = [
  // Apéritifs
  { name: "Kir Royal", description: "Champagne et crème de cassis", price: 8.50, category: "aperitif" },
  { name: "Cocktail Maison", description: "Rhum, fruits de la passion et menthe", price: 9.00, category: "aperitif" },

  // Entrées
  { name: "Salade César", description: "Salade verte, parmesan, croûtons, sauce césar", price: 12.00, category: "entree" },
  { name: "Foie Gras Mi-Cuit", description: "Foie gras maison, chutney de figues", price: 18.00, category: "entree" },
  { name: "Carpaccio de Bœuf", description: "Lamelles de bœuf, roquette, parmesan", price: 14.50, category: "entree" },

  // Plats
  { name: "Entrecôte Grillée", description: "300g avec frites maison et salade", price: 24.00, category: "plat" },
  { name: "Saumon Grillé", description: "Filet de saumon, légumes de saison", price: 22.00, category: "plat" },
  { name: "Risotto aux Champignons", description: "Risotto crémeux, champignons de saison", price: 18.50, category: "plat" },
  { name: "Magret de Canard", description: "Magret laqué au miel, gratin dauphinois", price: 26.00, category: "plat" },

  // Desserts
  { name: "Tiramisu Maison", description: "Tiramisu traditionnel aux amaretti", price: 7.50, category: "dessert" },
  { name: "Tarte Tatin", description: "Tarte aux pommes caramélisées, glace vanille", price: 8.00, category: "dessert" },
  { name: "Mousse au Chocolat", description: "Mousse onctueuse, chantilly", price: 6.50, category: "dessert" },

  // Boissons froides
  { name: "Coca-Cola", description: "33cl", price: 3.50, category: "boisson_froide" },
  { name: "Jus d'Orange Frais", description: "Pressé minute", price: 4.50, category: "boisson_froide" },
  { name: "Eau Minérale", description: "50cl", price: 2.50, category: "boisson_froide" },

  // Boissons chaudes
  { name: "Café Expresso", description: "Café italien", price: 2.50, category: "boisson_chaude" },
  { name: "Thé Earl Grey", description: "Thé anglais bergamote", price: 3.00, category: "boisson_chaude" },
  { name: "Chocolat Chaud", description: "Chocolat chaud maison, chantilly", price: 4.50, category: "boisson_chaude" },

  // Boissons alcoolisées
  { name: "Vin Rouge", description: "Côtes du Rhône, verre", price: 5.50, category: "boisson_alcoolise" },
  { name: "Vin Blanc", description: "Sancerre, verre", price: 6.00, category: "boisson_alcoolise" },
  { name: "Bière Pression", description: "33cl", price: 4.50, category: "boisson_alcoolise" }
];

async function addMenuItems() {
  for (const item of menuItems) {
    try {
      const response = await fetch('http://localhost:5000/api/menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          stockQuantity: 50,
          imageUrl: ''
        }),
      });

      if (response.ok) {
        console.log(`✅ Ajouté: ${item.name}`);
      } else {
        console.log(`❌ Erreur pour: ${item.name}`);
      }
    } catch (error) {
      console.log(`❌ Erreur réseau pour: ${item.name}`);
    }
  }
}

// Exécuter si on lance le script directement
if (typeof window === 'undefined') {
  // Node.js environment
  const fetch = require('node-fetch');
  addMenuItems();
} else {
  // Browser environment
  console.log('Utilisez addMenuItems() pour ajouter le menu');
}
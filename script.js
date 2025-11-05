document.addEventListener('DOMContentLoaded', function () {
    const webApp = window.Telegram.WebApp;

    // --- НАСТРОЙКИ ---
    // ⚠️ ВСТАВЬТЕ СЮДА ВАШУ CSV-ССЫЛКУ ИЗ GOOGLE SHEETS
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9X0GUMusSveT9KojVe4g2EhG3C_MTsEzjfnEkDLyc0fhO56Z8ALs0jX1c-0ffuyXo2vkO1vdD8ank/pub?gid=0&single=true&output=csv';
    const CURRENCY = '₽';

    // --- Глобальные переменные ---
    let menuData = []; // Плоский список всех блюд
    const cart = {};
    const pages = {
        categories: document.getElementById('page-categories'),
        items: document.getElementById('page-items'),
        cart: document.getElementById('page-cart')
    };
    
    // --- Элементы UI ---
    const searchInput = document.getElementById('search-input');
    const categoryGrid = document.getElementById('category-grid');
    const itemsList = document.getElementById('items-list');
    const categoryTitle = document.getElementById('category-title');
    const backToCategoriesBtn = document.getElementById('back-to-categories');
    const floatingCartBtn = document.getElementById('floating-cart-button');
    const backFromCartBtn = document.getElementById('back-from-cart');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartTotalPrice = document.getElementById('cart-total-price');

    // --- Навигация ---
    function showPage(pageName) {
        Object.values(pages).forEach(page => page.classList.remove('active'));
        pages[pageName].classList.add('active');
        if (pageName === 'categories') {
            renderCategories();
        }
    }
    
    backToCategoriesBtn.addEventListener('click', () => showPage('categories'));
    floatingCartBtn.addEventListener('click', () => showPage('cart'));
    backFromCartBtn.addEventListener('click', () => {
        // Возвращаемся на предыдущий активный экран
        if (pages.items.dataset.wasActive) {
            showPage('items');
        } else {
            showPage('categories');
        }
    });

    // --- Загрузка и обработка данных ---
    async function loadMenu() {
        try {
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const csvText = await response.text();
            const rows = csvText.split('\n').slice(1);
            menuData = rows.map(row => {
                const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                if (columns.length < 4) return null;
                const clean = columns.map(c => c.trim().replace(/^"|"$/g, ''));
                return {
                    id: clean[0],
                    category: clean[1],
                    name: clean[2],
                    price: parseFloat(clean[3])
                };
            }).filter(item => item && item.id && item.category && item.name && !isNaN(item.price));
            
            renderCategories();
        } catch (error) {
            console.error('Failed to load menu:', error);
            categoryGrid.innerHTML = '<p style="color:red">Ошибка загрузки меню.</p>';
        }
    }

    // --- Рендеринг (отображение) ---
    function renderCategories() {
        const categories = [...new Set(menuData.map(item => item.category))];
        categoryGrid.innerHTML = '';
        categories.forEach(cat => {
            const card = document.createElement('div');
            card.className = 'category-card';
            // В будущем здесь будет картинка
            card.innerHTML = `<div class="image-container"></div><p>${cat}</p>`;
            card.addEventListener('click', () => {
                renderItems(cat);
                showPage('items');
            });
            categoryGrid.appendChild(card);
        });
    }

    function renderItems(category, itemsToRender = null) {
        const items = itemsToRender || menuData.filter(item => item.category === category);
        itemsList.innerHTML = '';
        categoryTitle.innerText = category || 'Результаты поиска';

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'menu-item';
            li.innerHTML = `
                <div class="item-info">
                    <p>${item.name}</p>
                    <p class="item-price">${item.price} ${CURRENCY}</p>
                </div>
                <div class="item-controls">
                    <button class="btn-minus" data-id="${item.id}">-</button>
                    <span id="quantity-${item.id}">${cart[item.id] || 0}</span>
                    <button class="btn-plus" data-id="${item.id}">+</button>
                </div>`;
            itemsList.appendChild(li);
        });
        pages.items.dataset.wasActive = 'true';
        pages.categories.dataset.wasActive = 'false';
    }

    function updateCartView() {
        cartItemsList.innerHTML = '';
        let totalItems = 0;
        let totalPrice = 0;

        Object.keys(cart).forEach(id => {
            const item = menuData.find(m => m.id === id);
            const quantity = cart[id];
            if (!item || quantity <= 0) return;

            totalItems += quantity;
            totalPrice += item.price * quantity;

            const li = document.createElement('li');
            li.className = 'cart-item';
            li.innerHTML = `
                <div class="item-info">
                    <p>${item.name}</p>
                    <p class="item-price">${item.price} ${CURRENCY}</p>
                </div>
                <div class="item-controls">
                    <button class="btn-minus" data-id="${item.id}">-</button>
                    <span>${quantity}</span>
                    <button class="btn-plus" data-id="${item.id}">+</button>
                </div>`;
            cartItemsList.appendChild(li);
        });

        cartTotalPrice.innerText = `${totalPrice} ${CURRENCY}`;

        if (totalItems > 0) {
            floatingCartBtn.classList.add('visible');
            floatingCartBtn.classList.remove('hidden');
            document.getElementById('floating-cart-text').innerText = `Корзина (${totalItems})`;
            webApp.MainButton.setText(`Оформить заказ (${totalPrice} ${CURRENCY})`);
            webApp.MainButton.show();
        } else {
            floatingCartBtn.classList.add('hidden');
            floatingCartBtn.classList.remove('visible');
            webApp.MainButton.hide();
        }
    }

    // --- Логика корзины ---
    function addToCart(id) {
        cart[id] = (cart[id] || 0) + 1;
        updateItemQuantity(id);
        updateCartView();
    }
    function removeFromCart(id) {
        if (cart[id]) {
            cart[id]--;
            if (cart[id] <= 0) delete cart[id];
            updateItemQuantity(id);
            updateCartView();
        }
    }
    function updateItemQuantity(id) {
        const el = document.getElementById(`quantity-${id}`);
        if (el) el.innerText = cart[id] || 0;
    }

    // --- Поиск ---
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 1) {
            const results = menuData.filter(item => item.name.toLowerCase().includes(query));
            renderItems('Результаты поиска', results);
            showPage('items');
        } else if (query.length === 0) {
            showPage('categories');
        }
    });

    // --- Обработчики кнопок (+/-) ---
    document.body.addEventListener('click', e => {
        const plus = e.target.closest('.btn-plus');
        const minus = e.target.closest('.btn-minus');
        if (plus) addToCart(plus.dataset.id);
        if (minus) removeFromCart(minus.dataset.id);
    });
    
    // --- Отправка заказа ---
    webApp.onEvent('mainButtonClicked', function () {
        const orderData = { cart: {}, totalPrice: 0, userInfo: webApp.initDataUnsafe.user };
        let total = 0;
        Object.keys(cart).forEach(id => {
            const item = menuData.find(m => m.id === id);
            if (item) {
                orderData.cart[item.name] = { quantity: cart[id], price: item.price };
                total += item.price * cart[id];
            }
        });
        orderData.totalPrice = total;
        webApp.sendData(JSON.stringify(orderData));
    });

    // --- Инициализация ---
    webApp.expand();
    loadMenu();
});